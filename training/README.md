# Training pipeline

Scripts to fine-tune your own designer model and ship it to the userscript.
Nothing here runs automatically; nothing here is required to use retro-web with
the off-the-shelf model.

```
scrape_pages.py          Playwright → page summaries (same summarizer as the userscript) + HTML snapshots
make_dataset.py          Claude teacher → (summary + manifest + style → CSS with directives), validated
make_repair_dataset.py   corrupt good designs → inspector report → (broken CSS + report → patch)
finetune.py              LoRA SFT with TRL (or Unsloth) on both datasets
convert_webllm.sh        merge adapter → MLC convert/gen_config → (optional) upload to Hugging Face
styles.json              the sub-style list (shared with the userscript at build time)
common.py                shared helpers; prompts come from `node userscript/scripts/prompts-cli.mjs`
```

Prompts, manifest text and styles are read from the **built userscript library**
(`npm run build` first), so the teacher sees exactly what the in-browser model
will see and the student learns the exact output format (CSS + `/* icon-request */`
+ `/* apply-class */` lines).

## 0. Setup

```bash
npm run build                                   # dist/retro.lib.js is needed by every step
python -m venv .venv && source .venv/bin/activate
pip install anthropic playwright && playwright install chromium
export ANTHROPIC_API_KEY=sk-ant-...             # from the environment only — never committed
```

## 1. Scrape pages

```bash
python training/scrape_pages.py --sites training/sites.txt --screenshots
```

Writes `training/data/summaries.jsonl` and `training/data/pages/<id>.html`
(stylesheets inlined, scripts removed). Add more URLs to `sites.txt` — aim for
a few hundred diverse pages. `training/data/` is git-ignored.

## 2. Teacher dataset

```bash
python training/make_dataset.py --dry-run             # see one prompt
python training/make_dataset.py --per-page 3 --concurrency 4
```

Default teacher is `claude-opus-5-5` (`--model`, or `TEACHER_MODEL`); `--effort`
sets reasoning depth. Every output is validated with the userscript's own
validator against the page snapshot (`userscript/scripts/validate-cli.mjs`);
rejects go to `design.rejected.jsonl` with the reason. Accepted rows are
prompt/completion chat pairs. Re-running skips (page, style) pairs already done.

## 3. Repair dataset

```bash
python training/make_repair_dataset.py --per-design 2 --corruptions 3
```

Corrupts rules of accepted designs (margins, icon offsets, removed icon vars,
centering, contrast, font size, hidden elements, overflow, clipping), renders
each broken design in Chromium (`userscript/scripts/inspect-cli.mjs`) to get the
real inspector report, and pairs it with the restoring patch.

## 4. Fine-tune

```bash
pip install torch transformers datasets peft trl accelerate   # GPU machine
python training/finetune.py --base Qwen/Qwen2.5-Coder-1.5B-Instruct --epochs 2
# or: pip install unsloth && python training/finetune.py --unsloth --load-4bit
```

LoRA r=16 on all attention/MLP projections, completion-only loss, 5% held out.
Checkpoints go to `training/checkpoints/` (git-ignored).

## 5. Convert for WebLLM and upload

```bash
pip install --pre -U -f https://mlc.ai/wheels mlc-llm-nightly-cpu mlc-ai-nightly-cpu huggingface_hub
huggingface-cli login
training/convert_webllm.sh training/checkpoints/retro-designer <hf-user>/retro-designer-1.5B-q4f16_1-MLC
```

Then in the userscript panel → **Advanced** → *HF model* paste
`https://huggingface.co/<hf-user>/retro-designer-1.5B-q4f16_1-MLC` and save.
The host loads it with the prebuilt Qwen2-1.5B q4f16_1 WebGPU library (same
architecture); set *Model lib* only if you compiled your own `.wasm`
(`COMPILE_WASM=1`).

## 6. Compare

```bash
node eval/run.mjs --label base
node eval/run.mjs --label finetune   # after switching the model in the panel/settings
node eval/compare.mjs eval/out/base/summary.json eval/out/finetune/summary.json
```
