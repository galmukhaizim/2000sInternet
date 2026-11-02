#!/usr/bin/env bash
# Merge the LoRA adapter into the base model, convert to WebLLM/MLC format and
# (optionally) upload to Hugging Face.
#
#   training/convert_webllm.sh training/checkpoints/retro-designer [hf-user/retro-designer-1.5B-q4f16_1-MLC]
#
# Env: BASE (default Qwen/Qwen2.5-Coder-1.5B-Instruct), QUANT (q4f16_1), CONTEXT (8192),
#      CONV_TEMPLATE (qwen2), COMPILE_WASM=1 to also compile a model_lib (needs emscripten + TVM web runtime).
# Needs: pip install peft transformers huggingface_hub  and  mlc_llm (https://llm.mlc.ai/docs/install/mlc_llm.html)
set -euo pipefail
ADAPTER="${1:?adapter dir}"
HF_REPO="${2:-}"
BASE="${BASE:-Qwen/Qwen2.5-Coder-1.5B-Instruct}"
QUANT="${QUANT:-q4f16_1}"
CONTEXT="${CONTEXT:-8192}"
CONV_TEMPLATE="${CONV_TEMPLATE:-qwen2}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MERGED="$HERE/merged/$(basename "$ADAPTER")"
OUT="$HERE/mlc-out/$(basename "$ADAPTER")-$QUANT-MLC"
MODEL_ID="$(basename "$OUT")"

echo "== 1/4 merge LoRA into $BASE -> $MERGED"
python - "$ADAPTER" "$MERGED" "$BASE" <<'PY'
import sys, torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
adapter, merged, base = sys.argv[1:4]
tok = AutoTokenizer.from_pretrained(adapter)
model = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.bfloat16)
model = PeftModel.from_pretrained(model, adapter).merge_and_unload()
model.save_pretrained(merged, safe_serialization=True)
tok.save_pretrained(merged)
print("merged ->", merged)
PY

echo "== 2/4 convert weights ($QUANT) -> $OUT"
mkdir -p "$OUT"
mlc_llm convert_weight "$MERGED" --quantization "$QUANT" -o "$OUT"

echo "== 3/4 generate mlc-chat-config.json"
mlc_llm gen_config "$MERGED" --quantization "$QUANT" --conv-template "$CONV_TEMPLATE" \
  --context-window-size "$CONTEXT" --prefill-chunk-size 1024 -o "$OUT"

if [[ "${COMPILE_WASM:-0}" == "1" ]]; then
  echo "== 3b compile WebGPU model_lib"
  mlc_llm compile "$OUT/mlc-chat-config.json" --device webgpu -o "$OUT/$MODEL_ID-webgpu.wasm"
else
  echo "   (skipping wasm compile: the prebuilt Qwen2-1.5B-Instruct-$QUANT lib from binary-mlc-llm-libs works for a merged Qwen2.5-1.5B; set COMPILE_WASM=1 to build your own)"
fi

if [[ -n "$HF_REPO" ]]; then
  echo "== 4/4 upload to https://huggingface.co/$HF_REPO"
  huggingface-cli upload "$HF_REPO" "$OUT" . --repo-type model
  cat <<EOT

Done. In the retro-web panel → Advanced set:
  HF model : https://huggingface.co/$HF_REPO
  Model lib: (leave empty to use the prebuilt Qwen2 1.5B $QUANT lib, or the URL of your compiled .wasm)
EOT
else
  echo "== 4/4 skipped upload (pass a hf repo as 2nd arg). Output: $OUT"
fi
