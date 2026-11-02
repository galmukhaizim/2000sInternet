#!/usr/bin/env python3
"""LoRA fine-tune of the designer model on the design + repair datasets.

    python training/finetune.py --base Qwen/Qwen2.5-Coder-1.5B-Instruct --out training/checkpoints/retro-designer
    python training/finetune.py --unsloth --epochs 2 --lr 2e-4            # faster on consumer GPUs

Datasets are JSONL rows with `prompt` (system+user chat messages) and
`completion` (assistant message); TRL's SFTTrainer computes loss on the
completion only. Needs a CUDA GPU (a 1.5B model trains comfortably on 12-16 GB
with LoRA r=16, 4-bit base optional via --load-4bit).
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from common import DATA


def load_rows(paths: list[Path], seed: int) -> list[dict]:
    rows = []
    for p in paths:
        if p.exists():
            with p.open() as f:
                rows += [json.loads(l) for l in f if l.strip()]
    random.Random(seed).shuffle(rows)
    return [{"prompt": r["prompt"], "completion": r["completion"]} for r in rows]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-Coder-1.5B-Instruct")
    ap.add_argument("--design", default=str(DATA / "design.jsonl"))
    ap.add_argument("--repair", default=str(DATA / "repair.jsonl"))
    ap.add_argument("--out", default=str(Path(__file__).with_name("checkpoints") / "retro-designer"))
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--alpha", type=int, default=32)
    ap.add_argument("--max-len", type=int, default=6144)
    ap.add_argument("--batch", type=int, default=2)
    ap.add_argument("--grad-accum", type=int, default=8)
    ap.add_argument("--eval-frac", type=float, default=0.05)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--unsloth", action="store_true", help="use Unsloth for faster LoRA (pip install unsloth)")
    ap.add_argument("--load-4bit", action="store_true", help="load the base in 4-bit (QLoRA)")
    args = ap.parse_args()

    rows = load_rows([Path(args.design), Path(args.repair)], args.seed)
    if len(rows) < 20:
        raise SystemExit(f"only {len(rows)} examples — generate more with make_dataset.py / make_repair_dataset.py")
    n_eval = max(1, int(len(rows) * args.eval_frac))
    from datasets import Dataset

    train_ds = Dataset.from_list(rows[n_eval:])
    eval_ds = Dataset.from_list(rows[:n_eval])
    print(f"train {len(train_ds)}  eval {len(eval_ds)}  base {args.base}")

    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
    if args.unsloth:
        from unsloth import FastLanguageModel

        model, tokenizer = FastLanguageModel.from_pretrained(model_name=args.base, max_seq_length=args.max_len, load_in_4bit=args.load_4bit)
        model = FastLanguageModel.get_peft_model(model, r=args.rank, lora_alpha=args.alpha, lora_dropout=0.0, target_modules=target_modules, use_gradient_checkpointing="unsloth", random_state=args.seed)
    else:
        import torch
        from peft import LoraConfig, get_peft_model
        from transformers import AutoModelForCausalLM, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(args.base)
        kwargs = {"torch_dtype": torch.bfloat16, "device_map": "auto"}
        if args.load_4bit:
            from transformers import BitsAndBytesConfig

            kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_quant_type="nf4")
        model = AutoModelForCausalLM.from_pretrained(args.base, **kwargs)
        model = get_peft_model(model, LoraConfig(r=args.rank, lora_alpha=args.alpha, lora_dropout=0.05, target_modules=target_modules, task_type="CAUSAL_LM"))
        model.print_trainable_parameters()

    from trl import SFTConfig, SFTTrainer

    cfg = SFTConfig(
        output_dir=args.out,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        per_device_train_batch_size=args.batch,
        gradient_accumulation_steps=args.grad_accum,
        max_length=args.max_len,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=100,
        save_steps=200,
        save_total_limit=3,
        bf16=True,
        gradient_checkpointing=not args.unsloth,
        report_to="none",
        seed=args.seed,
        completion_only_loss=True,
    )
    trainer = SFTTrainer(model=model, processing_class=tokenizer, args=cfg, train_dataset=train_ds, eval_dataset=eval_ds)
    trainer.train()
    trainer.save_model(args.out)
    tokenizer.save_pretrained(args.out)
    print(f"adapter saved to {args.out}; next: training/convert_webllm.sh {args.out}")


if __name__ == "__main__":
    main()
