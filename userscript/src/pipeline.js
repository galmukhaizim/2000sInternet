// Orchestrates one page: cached CSS → or summarize → model → validate → apply
// (progressively) → icons → repair → cache. Extension points for later phases:
//   hooks.resolveIcons(requests, ctx) -> Promise<{ css, resolved, failed }>   (phase 4)
//   hooks.repair(ctx) -> Promise<{ css, report, remaining }>                   (phase 5)
import { summarizePage } from './summarize.js';
import { validateApplyClass, applyClassDirectives, removeClassDirectives } from './validate.js';
import { libraryClassNames, libraryIconNames } from './assets/index.js';
import { pickStyle, getStyle } from './model/styles.js';
import { ModelClient, ModelUnavailableError, describeModelError } from './model/engine.js';
import { generateDesign } from './model/designer.js';
import { snapshotVisibility, inspectPage, issueKeys } from './repair/inspect.js';
import { renderPack } from './packs/index.js';
import { buildAllowList, snapshotGeometry, enforceGeometry } from './repair/geometry.js';
import { validateCss } from './validate.js';
import { runRepairLoop } from './repair/loop.js';
import * as storage from './storage.js';

export function createPipeline({ doc, hostname, slots, panel, setState, getSettings, hooks = {} }) {
  let client = null;
  let clientKey = null;
  let controller = null;
  let appliedClasses = [];
  let lastResult = null;
  let currentAllow = null; // allow-list predicate of the run in progress

  function status(text, kind) {
    panel && panel.setStatus(text, kind);
  }

  function resolveModel(settings) {
    let customModel = settings.customModel || null;
    if (!customModel && settings.customModelUrl) {
      const url = settings.customModelUrl.replace(/\/+$/, '');
      customModel = { model: url, model_id: url.split('/').pop(), model_lib: settings.customModelLib || undefined };
    }
    return { customModel, modelId: customModel ? customModel.model_id : settings.modelId };
  }

  function getClient(settings) {
    const { customModel, modelId } = resolveModel(settings);
    const key = [settings.hostUrl, modelId, JSON.stringify(customModel), settings.contextWindow].join('|');
    if (client && clientKey === key) return client;
    if (client) client.dispose();
    clientKey = key;
    client = new ModelClient({
      doc,
      hostUrl: settings.hostUrl,
      modelId,
      customModel,
      contextWindow: settings.contextWindow,
      onProgress: ({ text, progress }) => {
        setState('loading-model', { text, progress });
        status(shortenProgress(text), '');
        panel && panel.setProgress(progress);
      },
    });
    return client;
  }

  // Frame first; if this site's CSP blocks it, fall back to a popup window, which
  // needs a user gesture. Remembers the block per site so later runs skip the wait.
  async function connectClient(c, settings, userGesture) {
    const rec = storage.getSiteRecord(hostname) || {};
    const popupOk = settings.popupFallback !== false;
    const needGesture = () =>
      new ModelUnavailableError('needs-gesture', "this site's security policy blocks the hidden model frame — press Redesign to run the model in a small popup window");
    if (rec.frameBlocked && popupOk) {
      if (!userGesture) throw needGesture();
      return c.connect({ mode: 'popup' });
    }
    try {
      return await c.connect({ mode: 'frame' });
    } catch (e) {
      if (!(e && e.code === 'host-blocked' && popupOk)) throw e;
      storage.saveSiteRecord(hostname, { frameBlocked: true });
      if (!userGesture) throw needGesture();
      status('frame blocked by this site — opening the model in a popup window…');
      return c.connect({ mode: 'popup' });
    }
  }

  function clearApplied() {
    removeClassDirectives(appliedClasses);
    appliedClasses = [];
  }

  function applyDirectives(list) {
    const { applied } = validateApplyClass(list, { doc, classNames: libraryClassNames(), spacingAllowed: currentAllow });
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

  async function runDesign({ styleId, userGesture = false } = {}) {
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
      const baseline = snapshotVisibility(doc);
      const summary = summarizePage(doc, { tokenBudget: settings.summaryTokenBudget });
      const mode = settings.designMode || 'hybrid';
      // geometry guard: what may receive spacing, and where everything was
      const allow = buildAllowList(doc, summary.data);
      const geo = snapshotGeometry(doc, {}, { isAllowed: allow.isAllowed });
      const validateOptions = { spacingAllowed: allow.isAllowed };
      currentAllow = allow.isAllowed;
      // what the original page already got wrong is not ours to repair
      const preexisting = settings.inspect !== false ? issueKeys(inspectPage(doc, { maxIssues: 200, tokenBudget: 50 })) : new Set();
      const landmarkEls = new Set(allow.landmarks.map((l) => l.el));
      const rollbacks = [];
      const settle = (ms = 60) => new Promise((r) => (doc.defaultView || window).requestAnimationFrame(() => setTimeout(r, ms)));
      const guard = async () => {
        if (settings.geometryGuard === false) return;
        await settle(30);
        const g = await enforceGeometry({ doc, snapshot: geo, slots, isLandmark: (el) => landmarkEls.has(el), settle: () => settle(30) });
        rollbacks.push(...g.removed);
        return g;
      };

      // 1. instant hand-made style pack (no model needed)
      let packCss = '';
      let packRules = 0;
      let quickFallbackCss = '';
      if (mode !== 'model') {
        const pack = renderPack(style.id, summary.data);
        const v = validateCss(pack.css, { doc, mode: 'design', ...validateOptions });
        packCss = v.css;
        packRules = v.kept;
        slots.design.set(packCss);
        applyDirectives(pack.applyClass);
        await guard();
        packCss = slots.design.css;
        // cache right away so reloads are instant even if the model never finishes
        storage.saveSiteRecord(hostname, {
          css: packCss,
          patchCss: '',
          fallbackCss: '',
          iconCss: '',
          applyClass: appliedClasses.map((a) => ({ selector: a.selector, className: a.className })),
          style: style.id,
          stage: 'pack',
          stats: { kept: packRules, dropped: v.dropped.length, ms: Date.now() - t0 },
        });
        // quick deterministic pass (no model): fixes the contrast/overflow issues a
        // theme can cause on site sections it does not know about
        let quick = null;
        if (settings.inspect !== false) {
          await new Promise((r) => setTimeout(r, 80));
          try {
            quick = await runRepairLoop({ client: null, doc, designCss: packCss, style, settings: { ...settings, maxRepairRounds: 0 }, baseline, iconVars: [], slots, signal, status: () => {}, settleMs: 60, validateOptions, unevenParents: geo.unevenParents, ignore: preexisting });
            await guard();
            quickFallbackCss = slots.fallback.css || '';
            storage.saveSiteRecord(hostname, { fallbackCss: quickFallbackCss, report: quick.report, geometryRollbacks: rollbacks.slice() });
          } catch (e) {
            console.warn('[retro-web] quick fix pass failed', e);
          }
        }
        status(`${style.name} applied (${packRules} rules)${mode === 'pack' ? '' : ' · adding site-specific touches with the model…'}`, 'ok');
        if (mode === 'pack') {
          const record = storage.getSiteRecord(hostname);
          panel && panel.setReport(formatReport(record));
          setState('done', { style: style.id, rules: packRules, stage: 'pack' });
          return record;
        }
      }

      // 2. the model: whole design ('model') or site-specific extras ('hybrid')
      const c = getClient(settings);
      try {
        await connectClient(c, settings, userGesture);
        await c.load();
      } catch (e) {
        if (!packCss || (e && e.name === 'AbortError')) throw e;
        // the pack is on screen; report why the model part is missing and stop here
        const why = describeModelError(e);
        status(`${style.name} applied · model skipped: ${why}`, e && e.code === 'needs-gesture' ? 'err' : 'ok');
        const record = storage.getSiteRecord(hostname);
        panel && panel.setReport(formatReport(record) + '\n\nMODEL: ' + why);
        setState('done', { style: style.id, rules: packRules, stage: 'pack', modelSkipped: why });
        return record;
      }
      if (signal.aborted) return null;
      panel && panel.setProgress(null);
      setState('designing', { style: style.id });
      status(packCss ? `${style.name} applied · model adding touches…` : `designing (${style.name})…`);
      let rules = 0;
      const pendingIcons = [];
      const join = (a, b) => [a, b].filter(Boolean).join('\n');
      const design = await generateDesign({
        client: c,
        doc,
        summaryText: summary.text,
        style,
        settings,
        signal,
        enhance: !!packCss,
        validateOptions,
        onChunk: ({ css, applyClass, iconRequests, result }) => {
          slots.design.set(join(packCss, css));
          if (applyClass.length) applyDirectives(applyClass);
          if (iconRequests.length) pendingIcons.push(...iconRequests);
          rules = result.kept;
          status(packCss ? `${style.name} applied · model added ${rules} rules…` : `designing (${style.name})… ${rules} rules`);
        },
      });
      if (signal.aborted) return null;
      slots.design.set(join(packCss, design.css));
      await guard();
      design.css = slots.design.css;
      design.kept += packRules;

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
      if (settings.inspect !== false) {
        setState('repairing', { style: style.id });
        status('inspecting layout…');
        await new Promise((r) => setTimeout(r, settings.settleDelayMs || 0));
        const repairFn = hooks.repair || runRepairLoop;
        const rep = await repairFn({ client: c, doc, designCss: design.css, style, settings, baseline, iconVars: [...referenced], slots, signal, status, validateOptions, unevenParents: geo.unevenParents, ignore: preexisting });
        if (rep) {
          slots.patch.set(rep.patchCss || '');
          slots.fallback.set([quickFallbackCss, rep.fallbackCss || ''].filter(Boolean).join('\n'));
          await guard();
          patchCss = slots.patch.css;
          fallbackCss = slots.fallback.css;
          report = rep.report || null;
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
        stage: 'full',
        geometryRollbacks: rollbacks,
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
      const remaining = report ? report.total : 0;
      status(`done: ${style.name} · ${design.kept} rules · ${secs}s${report ? ` · issues ${report.initial}→${remaining}` : ''}`, 'ok');
      record.stage = 'full';
      panel && panel.setReport(formatReport(record));
      setState('done', { style: style.id, rules: design.kept });
      return record;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        status('cancelled');
        setState('idle');
        return null;
      }
      if (e && e.code === 'needs-gesture') {
        status(e.message, 'err');
        setState('idle', { needsGesture: true });
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
      // a popup engine window is closed once the run is over; the frame stays for reuse
      if (client && client.mode === 'popup') {
        client.dispose();
        client = null;
        clientKey = null;
      }
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
  if (record.geometryRollbacks && record.geometryRollbacks.length) {
    L.push('', `GEOMETRY GUARD: rolled back ${record.geometryRollbacks.length} declaration group(s) that moved or resized controls:`);
    for (const r of record.geometryRollbacks.slice(0, 12)) L.push(`- ${r.selector} (${r.props.join(', ')}) in ${r.slot}`);
  }
  const rep = record.report;
  if (rep) {
    const rounds = (rep.rounds || []).map((r) => `round ${r.round}: ${r.before}→${r.after} issues, ${r.kept} patch rules${r.error ? ' (error: ' + r.error + ')' : ''}`);
    L.push('', `REPAIR: ${rep.initial} issue(s) found → ${rep.total} remaining after ${(rep.rounds || []).length} round(s)${rep.fixedByFallback && rep.fixedByFallback.length ? `, ${rep.fixedByFallback.length} deterministic fix(es)` : ''}`);
    L.push(...rounds);
    L.push('', 'REMAINING ISSUES:', rep.text || 'no issues');
  } else L.push('', 'ISSUES: (not inspected)');
  return L.join('\n');
}
