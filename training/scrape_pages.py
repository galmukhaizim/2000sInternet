#!/usr/bin/env python3
"""Visit a list of sites with Playwright and save page summaries + HTML snapshots.

    python training/scrape_pages.py --sites training/sites.txt --out training/data
    python training/scrape_pages.py --sites training/sites.txt --limit 20 --screenshots

Uses the SAME summarizer as the userscript (RetroWebLib.summarizePage from the
built library), so training inputs match runtime inputs. Each page produces:
  data/pages/<id>.html        DOM snapshot with external stylesheets inlined
  data/summaries.jsonl        {id, url, title, summary_text, summary_data, page_type, tokens}
Requires:  pip install playwright && playwright install chromium
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

from common import DATA, LIB, append_jsonl, ensure_built, read_jsonl

INLINE_STYLES_JS = """
async () => {
  // Inline same-origin stylesheets so the snapshot renders offline; keep others as <link>.
  for (const link of [...document.querySelectorAll('link[rel~="stylesheet"]')]) {
    try {
      const res = await fetch(link.href);
      if (!res.ok) continue;
      const css = await res.text();
      const style = document.createElement('style');
      style.setAttribute('data-inlined', link.href);
      style.textContent = css.replace(/url\\((['"]?)(?!data:|https?:|\\/\\/)([^'")]+)\\1\\)/g, (m, q, u) => `url("${new URL(u, link.href).href}")`);
      link.replaceWith(style);
    } catch (e) { /* cross-origin without CORS: leave the link */ }
  }
  // Drop scripts so the snapshot is static when re-rendered.
  for (const s of document.querySelectorAll('script, noscript')) s.remove();
  const panel = document.querySelector('retro-web-panel'); if (panel) panel.remove();
  return document.documentElement.outerHTML;
}
"""


def page_id(url: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", url.lower().replace("https://", "").replace("http://", ""))[:60].strip("-") + "-" + hashlib.sha1(url.encode()).hexdigest()[:6]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sites", default=str(Path(__file__).with_name("sites.txt")), help="text file, one URL per line (# comments ok)")
    ap.add_argument("--out", default=str(DATA))
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--screenshots", action="store_true")
    ap.add_argument("--viewport", default="1280x900")
    ap.add_argument("--token-budget", type=int, default=1500)
    ap.add_argument("--timeout", type=int, default=45000)
    args = ap.parse_args()
    ensure_built()
    from playwright.sync_api import sync_playwright

    out = Path(args.out)
    pages_dir = out / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    done = {r["id"] for r in read_jsonl(out / "summaries.jsonl")}
    urls = [u.strip() for u in Path(args.sites).read_text().splitlines() if u.strip() and not u.startswith("#")]
    if args.limit:
        urls = urls[: args.limit]
    w, h = (int(x) for x in args.viewport.split("x"))
    lib = LIB.read_text()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for url in urls:
            pid = page_id(url)
            if pid in done:
                print(f"skip {url} (done)")
                continue
            ctx = browser.new_context(viewport={"width": w, "height": h}, ignore_https_errors=True)
            page = ctx.new_page()
            t0 = time.time()
            try:
                page.goto(url, wait_until="load", timeout=args.timeout)
                page.wait_for_timeout(1500)
                page.add_script_tag(content=lib)
                summary = page.evaluate("(b) => RetroWebLib.summarizePage(document, { tokenBudget: b })", args.token_budget)
                tokens = page.evaluate("(t) => RetroWebLib.estimateTokens(t)", summary["text"])
                html = page.evaluate(INLINE_STYLES_JS)
                (pages_dir / f"{pid}.html").write_text("<!doctype html>\n" + html)
                if args.screenshots:
                    page.screenshot(path=str(pages_dir / f"{pid}.png"))
                append_jsonl(out / "summaries.jsonl", [{"id": pid, "url": url, "title": summary["data"].get("title"), "page_type": summary["data"].get("pageType"), "summary_text": summary["text"], "summary_data": summary["data"], "tokens": tokens, "html_path": str((pages_dir / f"{pid}.html").relative_to(out.parent)), "scraped_at": time.time()}])
                print(f"ok   {url} ({tokens} tokens, {time.time() - t0:.1f}s)")
            except Exception as e:  # noqa: BLE001
                print(f"FAIL {url}: {e}", file=sys.stderr)
            finally:
                ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
