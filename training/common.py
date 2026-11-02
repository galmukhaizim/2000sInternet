"""Shared helpers for the retro-web training pipeline.

Everything model-facing (prompts, manifest text, styles) is read from the built
userscript library so the teacher sees exactly what the in-browser model sees.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = HERE / "data"
LIB = ROOT / "userscript" / "dist" / "retro.lib.js"
NODE = os.environ.get("NODE", "node")


def ensure_built() -> None:
    if not LIB.exists():
        sys.exit("userscript/dist/retro.lib.js missing — run `npm run build` first")


def load_prompts() -> dict:
    """Prompts, manifest text, styles and library names from the JS source of truth."""
    ensure_built()
    out = subprocess.run([NODE, str(ROOT / "userscript" / "scripts" / "prompts-cli.mjs")], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def describe_style(s: dict) -> str:
    return f"{s['name']}: {s['description']} Palette: {', '.join(s['palette'])}. Fonts: {', '.join(s['fonts'])}. Motifs: {', '.join(s['motifs'])}."


def design_user_prompt(summary_text: str, manifest_text: str, style: dict) -> str:
    # Mirrors designMessages() in userscript/src/model/prompts.js
    return "\n".join([f"STYLE: {describe_style(style)}", "", manifest_text, "", "PAGE SUMMARY:", summary_text, "", "Write the CSS now."])


def repair_user_prompt(css: str, report_text: str, style: dict | None) -> str:
    # Mirrors repairMessages() in userscript/src/model/prompts.js
    return "\n".join([f"STYLE: {style['name'] if style else 'retro'}", "", "CURRENT CSS:", css, "", "REPORT:", report_text, "", "Write the CSS patch now."])


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def append_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def run_node_cli(script: str, args: list[str], stdin_text: str | None = None) -> str:
    cmd = [NODE, str(ROOT / "userscript" / "scripts" / script), *args]
    out = subprocess.run(cmd, input=stdin_text, check=True, capture_output=True, text=True)
    if out.stderr.strip():
        print(out.stderr, file=sys.stderr)
    return out.stdout
