// Renders a saved page with the asset library + a design CSS in real Chromium
// and runs the inspector (and optionally the deterministic fallbacks).
//   node userscript/scripts/inspect-cli.mjs --html page.html --css design.css [--apply-class '[{"selector":..,"className":..}]'] [--block-images] [--screenshot out.png]
//   cat items.jsonl | node userscript/scripts/inspect-cli.mjs --jsonl -   # {id, html|html_path, css, applyClass?}
// Output per item: { id, issues, total, counts, text, baselineTotal, fallbackCss }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LIB_PATH, readJsonLines } from './lib-loader.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));
const here = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

export async function inspectExample(page, lib, { html, css, applyClass = [], iconVars = [], screenshot }) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.addScriptTag({ content: lib });
  const result = await page.evaluate(
    async ({ css, applyClass, iconVars }) => {
      const L = window.RetroWebLib;
      const baseline = L.snapshotVisibility(document);
      const base = L.inspectPage(document);
      const slots = L.createSlots(document);
      slots.library.set(L.LIBRARY_CSS);
      const v = L.validateCss(css, { doc: document, mode: 'design' });
      slots.design.set(v.css);
      const ac = L.validateApplyClass(applyClass, { doc: document, classNames: L.libraryClassNames() });
      L.applyClassDirectives(ac.applied);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)));
      const r = L.inspectPage(document, { baseline, iconVars: [...new Set([...iconVars, ...v.iconVars])] });
      const fb = L.buildFallbackCss(r.issues, { doc: document });
      return { issues: r.issues.map(({ type, selector, detail }) => ({ type, selector, detail })), total: r.total, counts: r.counts, text: r.text, baselineTotal: base.total, validated: { kept: v.kept, dropped: v.dropped.length }, fallbackCss: L.validateCss(fb.css, { doc: document, mode: 'patch' }).css };
    },
    { css, applyClass, iconVars },
  );
  if (screenshot) await page.screenshot({ path: screenshot });
  return result;
}

async function main() {
  const lib = fs.readFileSync(LIB_PATH, 'utf8');
  const browser = await chromium.launch({ executablePath: process.env.RETRO_CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: Number(args.width || 1280), height: Number(args.height || 900) } });
  if (args['block-images']) await context.route(/\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PLACEHOLDER_PNG }));
  if (args.offline) await context.route(/^https?:\/\//, (route) => route.abort());
  const page = await context.newPage();
  try {
    if (args.jsonl) {
      for (const item of readJsonLines(args.jsonl)) {
        const html = item.html || fs.readFileSync(path.resolve(item.html_path), 'utf8');
        try {
          const r = await inspectExample(page, lib, { html, css: item.css, applyClass: item.applyClass || [], iconVars: item.iconVars || [] });
          process.stdout.write(JSON.stringify({ id: item.id, ...r }) + '\n');
        } catch (e) {
          process.stdout.write(JSON.stringify({ id: item.id, error: String(e && e.message) }) + '\n');
        }
      }
    } else {
      if (!args.html) {
        console.error('usage: inspect-cli --html page.html [--css design.css] [--jsonl file]');
        process.exit(2);
      }
      const r = await inspectExample(page, lib, { html: fs.readFileSync(args.html, 'utf8'), css: args.css ? fs.readFileSync(args.css, 'utf8') : '', applyClass: args['apply-class'] ? JSON.parse(args['apply-class']) : [], screenshot: args.screenshot });
      process.stdout.write(JSON.stringify(r, null, 1) + '\n');
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
void here;
