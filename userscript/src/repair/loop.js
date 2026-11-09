// Self-correction loop: inspect → model patch → validate → apply → re-inspect,
// up to N rounds; leftovers get deterministic fallbacks and are logged.
import { inspectPage } from './inspect.js';
import { buildFallbackCss } from './fallbacks.js';
import { generatePatch } from '../model/designer.js';
import { validateCss, parseCss } from '../validate.js';
import { estimateTokens } from '../assets/index.js';

function settle(doc, ms) {
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  return new Promise((resolve) => {
    const done = () => setTimeout(resolve, ms);
    if (win && typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(done);
    else done();
  });
}

// Keeps the CSS the model sees within budget: rules whose selectors appear in
// the report first, then the rest in order.
export function trimCssForReport(css, issues, maxTokens = 1400) {
  if (estimateTokens(css) <= maxTokens) return css;
  const { rules } = parseCss(css);
  const words = new Set();
  for (const i of issues) for (const w of String(i.selector).split(/[\s>+~.#:()\[\],]+/)) if (w && w.length > 1) words.add(w.toLowerCase());
  const lines = css.split('\n').filter((l) => l.trim());
  const scored = lines.map((l, idx) => {
    const sel = l.split('{')[0].toLowerCase();
    let score = 0;
    for (const w of words) if (sel.includes(w)) score += 2;
    return { l, idx, score };
  });
  void rules;
  const keep = [];
  let tokens = 0;
  for (const s of [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx)) {
    const t = estimateTokens(s.l);
    if (tokens + t > maxTokens) continue;
    keep.push(s);
    tokens += t;
  }
  return keep.sort((a, b) => a.idx - b.idx).map((s) => s.l).join('\n');
}

export async function runRepairLoop({ client, doc, designCss, style, settings, baseline, iconVars = [], slots, signal, status = () => {}, measure, inspect = inspectPage, patcher = generatePatch, settleMs = 250, validateOptions = {}, unevenParents = null, ignore = null }) {
  const maxRounds = Math.max(0, Number(settings.maxRepairRounds) || 0);
  const opts = { baseline, iconVars, measure, tolerance: settings.inspectTolerance, unevenParents, ignore };
  let patchCss = '';
  const rounds = [];
  let report = inspect(doc, opts);
  const initial = report;
  for (let round = 1; round <= maxRounds; round++) {
    if (!report.issues.length) break;
    if (signal && signal.aborted) break;
    status(`repair round ${round}/${maxRounds}: ${report.total} issue(s)…`);
    const current = trimCssForReport([designCss, patchCss].filter(Boolean).join('\n'), report.issues);
    let patch;
    try {
      patch = await patcher({
        client,
        doc,
        css: current,
        reportText: report.text,
        style,
        settings,
        signal,
        validateOptions,
        onChunk: ({ css }) => slots && slots.patch.set([patchCss, css].filter(Boolean).join('\n')),
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      rounds.push({ round, before: report.total, after: report.total, kept: 0, error: String(e && e.message) });
      break;
    }
    if (patch.css) patchCss = [patchCss, patch.css].filter(Boolean).join('\n');
    if (slots) slots.patch.set(patchCss);
    await settle(doc, settleMs);
    const next = inspect(doc, opts);
    rounds.push({ round, before: report.total, after: next.total, kept: patch.kept, dropped: patch.dropped.length });
    report = next;
    if (!patch.kept) break; // model produced nothing usable; stop burning rounds
  }
  let fallbackCss = '';
  let fixed = [];
  if (report.issues.length) {
    const fb = buildFallbackCss(report.issues, { doc });
    let v = validateCss(fb.css, { doc, mode: 'patch', ...validateOptions });
    // a padding fix refused as too broad leaves the icon under the text: drop the icon instead
    const refused = v.dropped.filter((d) => /too-broad/.test(d.reason) && /^padding/.test(d.prop || ''));
    if (refused.length) {
      const extra = [...new Set(refused.map((d) => d.selector))].map((sel) => `${sel} { background-image: none; }`).join('\n');
      v = validateCss(fb.css + '\n' + extra, { doc, mode: 'patch', ...validateOptions });
      fb.fixed.push(...refused.map((d) => ({ type: 'icon-overlaps-text', selector: d.selector, note: 'icon removed (too many elements for padding)' })));
    }
    fallbackCss = v.css;
    fixed = fb.fixed;
    if (slots) slots.fallback.set([slots.fallback.css, fallbackCss].filter(Boolean).join('\n'));
    if (fallbackCss) {
      await settle(doc, settleMs);
      report = inspect(doc, opts);
    }
  }
  return {
    patchCss,
    fallbackCss,
    report: { text: report.text, issues: report.issues.map(({ type, selector, detail }) => ({ type, selector, detail })), counts: report.counts, total: report.total, initial: initial.total, rounds, fixedByFallback: fixed },
    remaining: report.total,
  };
}
