#!/usr/bin/env python3
"""Build repair examples: (broken CSS + inspector report) -> correct patch.

    python training/make_repair_dataset.py --in training/data/design.jsonl --out training/data/repair.jsonl --per-design 2

Takes accepted designs, deliberately corrupts a few rules (shifted margins,
off-center icons, removed icon variables, broken centering, lowered contrast,
tiny fonts, hidden elements, overflow), renders the page + broken CSS in Chromium
through userscript/scripts/inspect-cli.mjs to get the real issue report, and pairs
(broken CSS + report) with the patch that restores the original rules. Examples
whose corruption produced no report lines are skipped (nothing to learn).
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path

from common import DATA, ROOT, append_jsonl, load_prompts, read_jsonl, repair_user_prompt, run_node_cli

RULE_RE = re.compile(r"([^{}]+)\{([^{}]*)\}")


def split_rules(css: str) -> list[tuple[str, str]]:
    """Top-level `selector { decls }` pairs (at-rules and directives are left out of corruption)."""
    css_no_comments = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    return [(m.group(1).strip(), m.group(2).strip()) for m in RULE_RE.finditer(css_no_comments) if not m.group(1).strip().startswith("@")]


def set_decl(decls: str, prop: str, value: str) -> str:
    parts = [d.strip() for d in decls.split(";") if d.strip()]
    parts = [d for d in parts if not d.lower().startswith(prop + ":")]
    parts.append(f"{prop}: {value}")
    return "; ".join(parts) + ";"


def drop_decl(decls: str, prop_re: str) -> str:
    parts = [d.strip() for d in decls.split(";") if d.strip() and not re.match(prop_re, d.strip(), re.I)]
    return "; ".join(parts) + ";"


CORRUPTIONS = {
    "shift-margins": lambda d, rng: set_decl(d, "margin", rng.choice(["-40px 0 0 0", "0 0 90px", "60px 0 2px", "0"])) if re.search(r"margin|padding", d) else None,
    "collapse-padding": lambda d, rng: set_decl(d, "padding", "0") if re.search(r"padding", d) else None,
    "offset-icon": lambda d, rng: set_decl(d, "background-position", rng.choice(["4px -8px", "0 12px", "right top"])) if "background-position" in d else None,
    "uncenter-icon": lambda d, rng: drop_decl(d, r"(align-items|vertical-align)") if re.search(r"align-items|vertical-align", d) else None,
    "remove-icon-var": lambda d, rng: re.sub(r"var\(--icon-([\w-]+)\)", r"var(--icon-missing-\1)", d, count=1) if "var(--icon-" in d else None,
    "break-centering": lambda d, rng: drop_decl(d, r"(text-align|justify-content|margin\s*:\s*0 auto)") if re.search(r"text-align|justify-content|margin\s*:\s*0 auto", d) else None,
    "low-contrast": lambda d, rng: set_decl(d, "color", rng.choice(["#8a8a8a", "#9c9c9c", "#777"])) if re.search(r"(^|;)\s*color\s*:", d) else None,
    "tiny-font": lambda d, rng: set_decl(d, "font-size", rng.choice(["7px", "8px", "9px"])) if "font-size" in d else None,
    "hide": lambda d, rng: set_decl(d, "visibility", "hidden"),
    "overflow": lambda d, rng: set_decl(d, "width", rng.choice(["1800px", "150vw"])) if re.search(r"width|padding|margin", d) else None,
    "clip": lambda d, rng: set_decl(set_decl(d, "overflow", "hidden"), "white-space", "nowrap"),
}


def corrupt(css: str, rng: random.Random, n: int) -> tuple[str, str, list[str]]:
    """Returns (broken_css, patch_css, kinds). The patch is the original rules that were corrupted."""
    rules = split_rules(css)
    if len(rules) < 4:
        return css, "", []
    broken = css
    patch_rules = []
    kinds = []
    tries = 0
    while len(kinds) < n and tries < 40:
        tries += 1
        sel, decls = rng.choice(rules)
        kind = rng.choice(list(CORRUPTIONS))
        new = CORRUPTIONS[kind](decls, rng)
        if not new or new == decls:
            continue
        original = f"{sel} {{{decls}}}"
        if original not in broken:
            # formatting differences: locate by selector + decl start
            m = re.search(re.escape(sel) + r"\s*\{[^{}]*\}", broken)
            if not m:
                continue
            original = m.group(0)
        broken = broken.replace(original, f"{sel} {{ {new} }}", 1)
        patch_rules.append(f"{sel} {{ {decls.strip()} }}")
        kinds.append(kind)
    return broken, "\n".join(patch_rules), kinds


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default=str(DATA / "design.jsonl"))
    ap.add_argument("--out", default=str(DATA / "repair.jsonl"))
    ap.add_argument("--summaries", default=str(DATA / "summaries.jsonl"))
    ap.add_argument("--per-design", type=int, default=2)
    ap.add_argument("--corruptions", type=int, default=3, help="rules corrupted per example")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--block-images", action="store_true", default=True)
    args = ap.parse_args()

    prompts = load_prompts()
    styles = {s["id"]: s for s in prompts["styles"]}
    pages = {s["id"]: s for s in read_jsonl(Path(args.summaries))}
    designs = read_jsonl(Path(args.inp))
    if args.limit:
        designs = designs[: args.limit]
    rng = random.Random(args.seed)
    out_path = Path(args.out)
    done = {r["id"] for r in read_jsonl(out_path)}

    # 1. build corrupted variants
    items = []
    for d in designs:
        page = pages.get(d["page_id"])
        if not page:
            continue
        css = d["completion"][0]["content"]
        for k in range(args.per_design):
            ex_id = f"{d['id']}__r{k}"
            if ex_id in done:
                continue
            broken, patch, kinds = corrupt(css, rng, args.corruptions)
            if not kinds:
                continue
            items.append({"id": ex_id, "html_path": str(ROOT / page["html_path"]), "css": broken, "patch": patch, "kinds": kinds, "style": d["style"], "page_id": d["page_id"]})
    print(f"{len(items)} corrupted designs to inspect")
    if not items:
        return

    # 2. inspect them in Chromium (one browser, many pages)
    stdin = "\n".join(json.dumps({"id": i["id"], "html_path": i["html_path"], "css": i["css"]}) for i in items) + "\n"
    cli_args = ["--jsonl", "-"] + (["--block-images"] if args.block_images else [])
    reports = {}
    for line in run_node_cli("inspect-cli.mjs", cli_args, stdin_text=stdin).splitlines():
        if line.strip():
            r = json.loads(line)
            reports[r["id"]] = r

    # 3. pair (broken css + report) -> patch
    kept = skipped = 0
    for i in items:
        r = reports.get(i["id"])
        if not r or r.get("error") or not r.get("issues"):
            skipped += 1
            continue
        user = repair_user_prompt(i["css"], r["text"], styles.get(i["style"]))
        row = {"id": i["id"], "page_id": i["page_id"], "style": i["style"], "kinds": i["kinds"], "issues": r["issues"], "prompt": [{"role": "system", "content": prompts["repairSystemPrompt"]}, {"role": "user", "content": user}], "completion": [{"role": "assistant", "content": i["patch"]}]}
        append_jsonl(out_path, [row])
        kept += 1
    print(f"kept {kept}, skipped {skipped} (no issues detected) -> {out_path}")


if __name__ == "__main__":
    main()
