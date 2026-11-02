#!/usr/bin/env python3
"""Generate (summary + manifest + style -> CSS with icon-requests) examples with Claude as the teacher.

    export ANTHROPIC_API_KEY=...          # never commit it
    python training/make_dataset.py --per-page 3 --out training/data/design.jsonl
    python training/make_dataset.py --model claude-opus-5-5 --effort high --concurrency 4 --limit 50

Every teacher output is run through the SAME validator as the userscript
(userscript/scripts/validate-cli.mjs over the saved HTML snapshot); outputs that
fail (too few rules, dangerous/dropped rules, parse errors) are discarded and
logged to data/design.rejected.jsonl. Accepted rows are stored as chat
prompt/completion pairs ready for finetune.py:
  {"id", "page_id", "style", "prompt": [{"role":"system",...},{"role":"user",...}], "completion": [{"role":"assistant","content": css}], "stats"}
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from common import DATA, ROOT, append_jsonl, design_user_prompt, load_prompts, read_jsonl, run_node_cli

DEFAULT_TEACHER = os.environ.get("TEACHER_MODEL", "claude-opus-5-5")


def teacher_call(client, model: str, effort: str, system: str, user: str, max_tokens: int) -> dict:
    """One Messages API call. Thinking stays adaptive (default); effort controls depth.
    Server-side refusal fallbacks are enabled so a policy decline on the primary model
    is retried on a fallback model inside the same request."""
    resp = client.beta.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort},
        betas=["server-side-fallback-2026-07-01"],
        extra_body={"fallbacks": "default"},
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    return {"text": text, "stop_reason": resp.stop_reason, "model": resp.model, "usage": {"input": resp.usage.input_tokens, "output": resp.usage.output_tokens}}


def validate(html_path: Path, css: str) -> dict:
    row = json.dumps({"id": "x", "html_path": str(html_path), "css": css, "mode": "design"})
    out = run_node_cli("validate-cli.mjs", ["--jsonl", "-"], stdin_text=row + "\n")
    return json.loads(out.strip().splitlines()[-1])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--summaries", default=str(DATA / "summaries.jsonl"))
    ap.add_argument("--out", default=str(DATA / "design.jsonl"))
    ap.add_argument("--model", default=DEFAULT_TEACHER)
    ap.add_argument("--effort", default="medium", choices=["low", "medium", "high", "xhigh", "max"])
    ap.add_argument("--per-page", type=int, default=2, help="styles sampled per page")
    ap.add_argument("--limit", type=int, default=0, help="max pages")
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--max-tokens", type=int, default=4096)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true", help="print one prompt and exit")
    args = ap.parse_args()

    prompts = load_prompts()
    styles = prompts["styles"]
    summaries = read_jsonl(Path(args.summaries))
    if not summaries:
        sys.exit("no summaries — run scrape_pages.py first")
    if args.limit:
        summaries = summaries[: args.limit]
    rng = random.Random(args.seed)
    out_path = Path(args.out)
    done = {(r["page_id"], r["style"]) for r in read_jsonl(out_path)}
    jobs = []
    for s in summaries:
        for style in rng.sample(styles, k=min(args.per_page, len(styles))):
            if (s["id"], style["id"]) in done:
                continue
            jobs.append((s, style))
    print(f"{len(jobs)} teacher calls with {args.model} (effort {args.effort})")
    if args.dry_run:
        s, style = jobs[0]
        print("SYSTEM:\n" + prompts["designSystemPrompt"] + "\n\nUSER:\n" + design_user_prompt(s["summary_text"], prompts["manifestText"], style))
        return

    import anthropic

    client = anthropic.Anthropic()  # key from ANTHROPIC_API_KEY (or `ant auth login` profile)

    def work(job):
        s, style = job
        user = design_user_prompt(s["summary_text"], prompts["manifestText"], style)
        t0 = time.time()
        r = teacher_call(client, args.model, args.effort, prompts["designSystemPrompt"], user, args.max_tokens)
        if r["stop_reason"] == "refusal" or not r["text"].strip():
            return {"reject": {"page_id": s["id"], "style": style["id"], "reason": "refusal-or-empty", "stop_reason": r["stop_reason"]}}
        v = validate(ROOT / s["html_path"], r["text"])
        base = {"page_id": s["id"], "style": style["id"], "model": r["model"], "usage": r["usage"], "seconds": round(time.time() - t0, 1), "stats": {k: v[k] for k in ("kept", "dropped", "errors")}}
        if not v["ok"]:
            return {"reject": {**base, "reason": "validation", "dropped": v["droppedRules"][:10], "parse_errors": v["parseErrors"][:5], "raw": r["text"]}}
        # Store the raw teacher output (with directives) as the completion: that is what the student must learn to emit.
        return {"accept": {**base, "id": f"{s['id']}__{style['id']}", "prompt": [{"role": "system", "content": prompts["designSystemPrompt"]}, {"role": "user", "content": user}], "completion": [{"role": "assistant", "content": r["text"].strip()}], "icon_requests": v["iconRequests"], "apply_class": v["applyClass"]}}

    accepted = rejected = 0
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futures = [ex.submit(work, j) for j in jobs]
        for f in as_completed(futures):
            try:
                res = f.result()
            except Exception as e:  # noqa: BLE001
                print(f"error: {e}", file=sys.stderr)
                continue
            if "accept" in res:
                append_jsonl(out_path, [res["accept"]])
                accepted += 1
            else:
                append_jsonl(out_path.with_suffix(".rejected.jsonl"), [res["reject"]])
                rejected += 1
            print(f"accepted {accepted} rejected {rejected}", end="\r")
    print(f"\naccepted {accepted}, rejected {rejected} -> {out_path}")


if __name__ == "__main__":
    main()
