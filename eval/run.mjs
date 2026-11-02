// retro-web eval harness.
//
//   node eval/run.mjs                      real model host (dist/host) + eval/sites.json
//   node eval/run.mjs --fixtures --mock    offline: local fixture pages + canned mock host (no GPU)
//   node eval/run.mjs --sites my.json --rounds 2 --style win98 --label qwen-coder-1.5b
//
// For each site: load, screenshot BEFORE, inspect the original page, inject the
// GM shim + built userscript, wait for the design (+ repair) to finish, screenshot
// AFTER, collect the site record (CSS, report, stats), then write
// <out>/report.html + <out>/summary.json (+ per-site files) for comparing model versions.
//
// Flags: --out DIR (default eval/out/<label-or-timestamp>) --host URL --headed
//        --timeout MS (default 240000) --no-model (inspector + fallbacks only, rounds 0)
//        --chromium PATH --viewport WxH --limit N --filter substring
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHostServer } from '../userscript/host/serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const args = parseArgs(process.argv.slice(2));
const label = args.label || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.resolve(args.out || path.join(here, 'out', label));
const timeout = Number(args.timeout || 240000);
const [vpW, vpH] = String(args.viewport || '1280x900').split('x').map(Number);
const HOST_PORT = Number(args['host-port'] || 4173);
const FIXTURE_PORT = Number(args['fixture-port'] || 4174);

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

function serveStatic(root, port) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.normalize(path.join(root, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const shim = fs.readFileSync(path.join(ROOT, 'eval/gm-shim.js'), 'utf8');
  const bundle = fs.readFileSync(path.join(ROOT, 'userscript/dist/retro.user.js'), 'utf8');
  const lib = fs.readFileSync(path.join(ROOT, 'userscript/dist/retro.lib.js'), 'utf8');

  // sites
  let sites;
  let fixtureServer = null;
  if (args.fixtures) {
    fixtureServer = await serveStatic(path.join(ROOT, 'eval/fixtures'), FIXTURE_PORT);
    sites = fs
      .readdirSync(path.join(ROOT, 'eval/fixtures'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => ({ name: f.replace('.html', ''), url: `http://127.0.0.1:${FIXTURE_PORT}/${f}` }));
  } else {
    sites = JSON.parse(fs.readFileSync(path.resolve(args.sites || path.join(here, 'sites.json')), 'utf8'));
  }
  if (args.filter) sites = sites.filter((s) => s.name.includes(args.filter) || s.url.includes(args.filter));
  if (args.limit) sites = sites.slice(0, Number(args.limit));

  // model host
  let hostServer = null;
  let hostUrl = args.host;
  if (!hostUrl) {
    if (args.mock) hostServer = await serveStatic(path.join(ROOT, 'eval/mock-host'), HOST_PORT);
    else {
      if (!fs.existsSync(path.join(ROOT, 'userscript/dist/host/host.js'))) throw new Error('dist/host/host.js missing — run `npm run build` first');
      hostServer = createHostServer();
      await new Promise((r) => hostServer.listen(HOST_PORT, '127.0.0.1', r));
    }
    hostUrl = `http://localhost:${HOST_PORT}/`;
  }

  const rounds = args['no-model'] ? 0 : args.rounds != null ? Number(args.rounds) : undefined;
  const settings = { hostUrl, autoDesign: true, settleDelayMs: 400 };
  if (rounds != null) settings.maxRepairRounds = rounds;
  if (args.style) settings.style = args.style;
  if (args.model) settings.modelId = args.model;
  const apiKey = process.env.ANTHROPIC_API_KEY || '';

  const browser = await chromium.launch({
    headless: !args.headed,
    executablePath: args.chromium || process.env.RETRO_CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', ...(args['chrome-args'] ? String(args['chrome-args']).split(' ') : [])],
  });
  const results = [];
  console.log(`[eval] ${sites.length} site(s) → ${outDir}${args.mock ? ' (mock host)' : ''}`);
  for (const site of sites) {
    const siteDir = path.join(outDir, site.name);
    fs.mkdirSync(siteDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: vpW, height: vpH }, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const result = { name: site.name, url: site.url, ok: false };
    const t0 = Date.now();
    const logs = [];
    page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 300)}`);
    });
    try {
      await page.goto(site.url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(siteDir, 'before.png'), fullPage: false });
      // inspector on the untouched page (how messy the original is)
      await page.addScriptTag({ content: lib });
      result.before = await page.evaluate(() => {
        const r = RetroWebLib.inspectPage(document);
        return { total: r.total, counts: r.counts };
      });
      result.summaryTokens = await page.evaluate(() => RetroWebLib.estimateTokens(RetroWebLib.summarizePage(document).text));
      // API bridge: Node performs the request and injects the key; the page only sees a sentinel
      await page.exposeBinding('__retroNodeFetch', async (_src, req) => {
        const headers = { ...req.headers };
        if (headers['x-api-key'] === 'env') headers['x-api-key'] = apiKey;
        const res = await fetch(req.url, { method: req.method, headers, body: req.data || undefined });
        return { status: res.status, responseText: await res.text() };
      });
      await page.evaluate((seed) => {
        window.__retroSeed = { values: seed };
      }, { settings, ...(apiKey ? { apiKey: 'env' } : {}) });
      await page.addScriptTag({ content: shim });
      await page.addScriptTag({ content: bundle });
      await page.waitForFunction(() => ['done', 'error', 'disabled'].includes(document.documentElement.dataset.retroWebState), null, { timeout });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(siteDir, 'after.png'), fullPage: false });
      const state = await page.evaluate(() => document.documentElement.dataset.retroWebState);
      const record = await page.evaluate((h) => window.__retroGMStore.get('site:' + h) || null, new URL(site.url).hostname);
      result.state = state;
      if (record) {
        result.style = record.style;
        result.stats = record.stats;
        result.report = record.report;
        result.iconResults = record.iconResults;
        fs.writeFileSync(path.join(siteDir, 'design.css'), [record.css, record.patchCss, record.fallbackCss, record.iconCss].filter(Boolean).join('\n\n/* --- */\n\n'));
        fs.writeFileSync(path.join(siteDir, 'record.json'), JSON.stringify(record, null, 1));
      }
      // independent re-inspection of the final page
      result.after = await page.evaluate(() => {
        const r = RetroWebLib.inspectPage(document);
        return { total: r.total, counts: r.counts, text: r.text };
      });
      result.ok = state === 'done';
      if (state === 'error') result.error = await page.evaluate(() => (document.querySelector('retro-web-panel') ? 'see panel' : 'no panel'));
    } catch (e) {
      result.error = String(e && e.message).slice(0, 300);
    }
    result.ms = Date.now() - t0;
    result.logs = logs.slice(0, 20);
    results.push(result);
    fs.writeFileSync(path.join(siteDir, 'result.json'), JSON.stringify(result, null, 1));
    console.log(`[eval] ${site.name}: ${result.ok ? 'ok' : 'FAIL'} ${result.style || ''} issues ${result.before ? result.before.total : '?'} → ${result.report ? result.report.initial + ' → ' + result.report.total : '?'} (${(result.ms / 1000).toFixed(1)}s)${result.error ? ' ' + result.error : ''}`);
    await context.close();
  }
  await browser.close();
  if (hostServer) hostServer.close();
  if (fixtureServer) fixtureServer.close();

  const summary = { label, when: new Date().toISOString(), modelId: settings.modelId || '(default)', mock: !!args.mock, rounds: rounds == null ? 'default' : rounds, sites: results.map(({ logs, ...r }) => r) };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
  fs.writeFileSync(path.join(outDir, 'report.html'), renderReport(summary, results));
  const okCount = results.filter((r) => r.ok).length;
  const remaining = results.reduce((a, r) => a + (r.report ? r.report.total : 0), 0);
  console.log(`[eval] done: ${okCount}/${results.length} ok, ${remaining} issue(s) remaining in total → ${path.join(outDir, 'report.html')}`);
}

export function renderReport(summary, results) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const counts = (c) => (c ? Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', ') : '');
  const rows = results
    .map((r) => {
      const rep = r.report || {};
      const rounds = (rep.rounds || []).map((x) => `${x.before}→${x.after}`).join(' · ');
      return `<tr class="${r.ok ? 'ok' : 'fail'}">
<td><b>${esc(r.name)}</b><br><a href="${esc(r.url)}">${esc(r.url)}</a><br><small>${esc(r.state || r.error || '')}</small></td>
<td>${esc(r.style || '')}<br><small>${r.stats ? `${r.stats.kept} rules, ${r.stats.dropped} dropped, ${Math.round(r.stats.ms / 1000)}s` : ''}</small></td>
<td>${r.before ? r.before.total : '?'}<br><small>${esc(counts(r.before && r.before.counts))}</small></td>
<td>${rep.initial != null ? rep.initial : '?'} → <b>${rep.total != null ? rep.total : '?'}</b><br><small>${esc(rounds)}${rep.fixedByFallback && rep.fixedByFallback.length ? ` · ${rep.fixedByFallback.length} fallback` : ''}</small><br><small>${esc(counts(rep.counts))}</small></td>
<td><a href="${esc(r.name)}/before.png"><img src="${esc(r.name)}/before.png"></a></td>
<td><a href="${esc(r.name)}/after.png"><img src="${esc(r.name)}/after.png"></a></td>
<td><details><summary>issues / css</summary><pre>${esc(rep.text || '')}</pre><a href="${esc(r.name)}/design.css">design.css</a> · <a href="${esc(r.name)}/record.json">record.json</a>${r.logs && r.logs.length ? `<pre>${esc(r.logs.join('\n'))}</pre>` : ''}</details></td>
</tr>`;
    })
    .join('\n');
  const total = results.reduce((a, r) => a + (r.report ? r.report.total : 0), 0);
  const initial = results.reduce((a, r) => a + (r.report ? r.report.initial : 0), 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>retro-web eval ${esc(summary.label)}</title>
<style>
body{font:12px Tahoma,Verdana,sans-serif;background:#c0c0c0;margin:16px;color:#000}
h1{font-size:16px;background:linear-gradient(90deg,#000080,#1084d0);color:#fff;padding:4px 8px;margin:0 0 8px}
table{border-collapse:collapse;background:#fff;width:100%}th,td{border:1px solid #808080;padding:6px;vertical-align:top;text-align:left}
th{background:#e0e0e0}img{width:260px;border:1px solid #000}tr.fail td{background:#ffe6e6}pre{white-space:pre-wrap;font-size:11px;max-width:420px;max-height:260px;overflow:auto;background:#f8f8f8;border:1px inset #fff;padding:4px}
.sum{background:#fff;border:2px outset #fff;padding:8px;margin-bottom:10px}
</style></head><body>
<h1>retro-web eval — ${esc(summary.label)}</h1>
<div class="sum">model <b>${esc(summary.modelId)}</b>${summary.mock ? ' (mock host)' : ''} · repair rounds ${esc(summary.rounds)} · ${esc(summary.when)} · ${results.filter((r) => r.ok).length}/${results.length} sites ok · issues after design ${initial} → <b>${total}</b> remaining</div>
<table><tr><th>site</th><th>style / stats</th><th>issues on original</th><th>issues after design → after repair</th><th>before</th><th>after</th><th>details</th></tr>
${rows}
</table></body></html>`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
