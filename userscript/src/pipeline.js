// Orchestrates one page: cached CSS → or summarize → model → validate → apply
// (progressively) → icons → repair → cache. Extension points for later phases:
//   hooks.resolveIcons(requests, ctx) -> Promise<{ css, resolved, failed }>   (phase 4)
//   hooks.repair(ctx) -> Promise<{ css, report, remaining }>                   (phase 5)
import { summarizePage } from './summarize.js';
import { validateApplyClass, applyClassDirectives, removeClassDirectives } from './validate.js';
import { libraryClassNames, libraryIconNames } from './assets/index.js';
import { pickStyle, getStyle } from './model/styles.js';
import { ModelClient, describeModelError } from './model/engine.js';
import { generateDesign } from './model/designer.js';
import * as storage from './storage.js';

export function createPipeline({ doc, hostname, slots, panel, setState, getSettings, hooks = {} }) {
  let client = null;
  let clientKey = null;
  let controller = null;
  let appliedClasses = [];
  let lastResult = null;

  function status(text, kind) {
    panel && panel.setStatus(text, kind);
  }

  function getClient(settings) {
    const key = [settings.hostUrl, settings.modelId, JSON.stringify(settings.customModel || null), settings.contextWindow].join('|');
    if (client && clientKey === key) return client;
    if (client) client.dispose();
    clientKey = key;
    client = new ModelClient({
      doc,
      hostUrl: settings.hostUrl,
      modelId: settings.modelId,
      customModel: settings.customModel,
      contextWindow: settings.contextWindow,
      onProgress: ({ text, progress }) => {
        setState('loading-model', { text, progress });
        status(shortenProgress(text), '');
        panel && panel.setProgress(progress);
      },
    });
    return client;
  }

  function clearApplied() {
    removeClassDirectives(appliedClasses);
    appliedClasses = [];
  }

  function applyDirectives(list) {
    const { applied } = validateApplyClass(list, { doc, classNames: libraryClassNames() });
    applyClassDirectives(applied);
    appliedClasses.push(...applied);
    return applied.map((a) => ({ selector: a.selector, className: a.className, count: a.count }));
  }

  // Library names + anything the icon resolver defined.
  function placeholderIconCss(requests, defined) {
    const lib = new Set(libraryIconNames());
    const lines = [];
    for (const r of requests) if (!lib.has(r.name) && !defined.has('--icon-' + r.name)) lines.push(`--icon-${r.name}: var(--icon-placeholder);`);
    return lines.length ? `:root { ${lines.join(' ')} }` : '';
  }

  function applyCached(record) {
    if (!record || !record.css) return false;
    clearApplied();
    slots.icons.set(record.iconCss || '');
    slots.design.set(record.css);
    slots.patch.set(record.patchCss || '');
    slots.fallback.set(record.fallbackCss || '');
    applyDirectives(record.applyClass || []);
    lastResult = record;
    return true;
  }

  function restore() {
    stop();
    clearApplied();
    slots.icons.clear();
    slots.design.clear();
    slots.patch.clear();
    slots.fallback.clear();
  }

  function stop() {
    if (controller) {
      controller.abort();
      controller = null;
    }
  }

  async function runDesign({ styleId } = {}) {
    stop();
    const settings = getSettings();
    const ctl = (controller = new AbortController());
    const signal = ctl.signal;
    const style = pickStyle(styleId || settings.style);
    const t0 = Date.now();
    panel && panel.setBusy(true);
    panel && panel.setStyle(style.id);
    try {
      clearApplied();
      slots.design.clear();
      slots.patch.clear();
      slots.fallback.clear();
      slots.icons.clear();
      setState('designing', { style: style.id });
      status(`summarizing page…`);
      const summary = summarizePage(doc, { tokenBudget: settings.summaryTokenBudget });
      status(`loading designer model…`);
      const c = getClient(settings);
      await c.load();
      if (signal.aborted) return null;
      panel && panel.setProgress(null);
      setState('designing', { style: style.id });
      status(`designing (${style.name})…`);
      let rules = 0;
      const pendingIcons = [];
      const design = await generateDesign({
        client: c,
        doc,
        summaryText: summary.text,
        style,
        settings,
        signal,
        onChunk: ({ css, applyClass, iconRequests, result }) => {
          slots.design.set(css);
          if (applyClass.length) applyDirectives(applyClass);
          if (iconRequests.length) pendingIcons.push(...iconRequests);
          rules = result.kept;
          status(`designing (${style.name})… ${rules} rules`);
        },
      });
      if (signal.aborted) return null;

      // icons: resolver (phase 4) or placeholders
      const iconRequests = design.iconRequests;
      const referenced = new Set(design.iconVars);
      for (const r of iconRequests) referenced.add('--icon-' + r.name);
      let iconCss = '';
      let iconReport = { resolved: [], failed: [] };
      if (hooks.resolveIcons && iconRequests.length) {
        status(`resolving ${iconRequests.length} icon request(s)…`);
        try {
          iconReport = await hooks.resolveIcons(iconRequests, { signal, settings });
          iconCss = iconReport.css || '';
        } catch (e) {
          console.warn('[retro-web] icon resolution failed', e);
        }
      }
      const definedVars = new Set((iconCss.match(/--icon-[\w-]+(?=\s*:)/g) || []));
      const placeholders = placeholderIconCss(iconRequests, definedVars);
      slots.icons.set([iconCss, placeholders].filter(Boolean).join('\n'));

      let patchCss = '';
      let fallbackCss = '';
      let report = null;
      if (hooks.repair) {
        setState('repairing', { style: style.id });
        status('inspecting layout…');
        const rep = await hooks.repair({ client: c, doc, design, style, settings, signal, slots, status, applyDirectives });
        if (rep) {
          patchCss = rep.patchCss || '';
          fallbackCss = rep.fallbackCss || '';
          report = rep.report || null;
          slots.patch.set(patchCss);
          slots.fallback.set(fallbackCss);
        }
      }
      if (signal.aborted) return null;

      const record = storage.saveSiteRecord(hostname, {
        css: design.css,
        patchCss,
        fallbackCss,
        iconCss: slots.icons.css,
        applyClass: appliedClasses.map((a) => ({ selector: a.selector, className: a.className })),
        iconRequests,
        iconResults: (iconReport.results || []).map((r) => ({ name: r.name, source: r.source, alias: r.alias, reason: r.reason })),
        style: style.id,
        report,
        stats: {
          promptTokens: design.promptTokens,
          outputChars: design.rawText.length,
          kept: design.kept,
          dropped: design.dropped.length,
          errors: design.errors.length,
          usage: design.usage || null,
          ms: Date.now() - t0,
          iconsResolved: iconReport.resolved.length,
          iconsFailed: iconReport.failed.length,
        },
      });
      lastResult = record;
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      const remaining = report && report.issues ? report.issues.length : 0;
      status(`done: ${style.name} · ${design.kept} rules · ${secs}s${remaining ? ` · ${remaining} issue(s) left` : ''}`, 'ok');
      panel && panel.setReport(formatReport(record));
      setState('done', { style: style.id, rules: design.kept });
      return record;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        status('cancelled');
        setState('idle');
        return null;
      }
      console.warn('[retro-web] design failed', e);
      status('error: ' + describeModelError(e), 'err');
      setState('error', { message: describeModelError(e), code: e && e.code });
      return null;
    } finally {
      if (controller === ctl) controller = null;
      panel && panel.setBusy(false);
      panel && panel.setProgress(null);
    }
  }

  return { runDesign, applyCached, restore, stop, getLastResult: () => lastResult, getStyle };
}

function shortenProgress(text) {
  const t = String(text || '');
  const m = /\[(\d+)\/(\d+)\]/.exec(t);
  if (/Loading model from cache/i.test(t) && m) return `loading model from cache ${m[1]}/${m[2]}`;
  if (/Fetching param cache/i.test(t) && m) return `downloading model ${m[1]}/${m[2]} (first time only)`;
  if (/Loading GPU shader/i.test(t)) return 'compiling GPU shaders…';
  if (/Finish loading/i.test(t)) return 'model ready';
  return t.length > 70 ? t.slice(0, 69) + '…' : t;
}

export function formatReport(record) {
  if (!record) return '(nothing yet)';
  const L = [];
  L.push(`style: ${record.style} · rules: ${record.stats ? record.stats.kept : '?'} · dropped: ${record.stats ? record.stats.dropped : '?'} · ${record.stats ? Math.round(record.stats.ms / 1000) + 's' : ''}`);
  if (record.iconRequests && record.iconRequests.length) L.push(`icon requests: ${record.iconRequests.map((r) => r.name).join(', ')}`);
  if (record.iconResults && record.iconResults.length) L.push(`icons: ${record.iconResults.map((r) => `${r.name}←${r.source}${r.alias ? '(' + r.alias + ')' : ''}${r.reason ? ' [' + r.reason + ']' : ''}`).join(', ')}`);
  if (record.applyClass && record.applyClass.length) L.push(`classes: ${record.applyClass.map((a) => `${a.selector}→.${a.className}`).join(', ')}`);
  if (record.report && record.report.text) L.push('', 'ISSUES:', record.report.text);
  else L.push('', 'ISSUES: (none recorded)');
  return L.join('\n');
}
