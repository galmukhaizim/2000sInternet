// retro-web userscript entry: mounts the panel, applies cached designs, and
// runs the design pipeline (summarize → model → validate → apply → icons →
// repair → cache). See CLAUDE.md for the architecture.
import { VERSION, PANEL_ID } from './config.js';
import * as storage from './storage.js';
import { createSlots } from './apply.js';
import { createPanel, PANEL_HOST_CSS } from './ui/panel.js';
import { createCspMonitor, describeEnvironment } from './csp.js';
import { STYLES } from './model/styles.js';
import { LIBRARY_CSS } from './assets/index.js';
import { summarizePage } from './summarize.js';
import { createPipeline, formatReport } from './pipeline.js';
import { createIconResolver } from './icons/index.js';

function setState(state, detail = {}) {
  try {
    document.documentElement.dataset.retroWebState = state;
    document.dispatchEvent(new CustomEvent('retro-web:status', { detail: { state, ...detail } }));
  } catch {
    /* ignore */
  }
}

function main() {
  if (window.top !== window) return; // never inside frames (incl. our own host)
  if (document.getElementById(PANEL_ID)) return; // already running
  const hostname = location.hostname;
  let settings = storage.getSettings();
  const site = storage.getSiteRecord(hostname) || {};
  const csp = createCspMonitor(document);
  const env = describeEnvironment(document);
  const slots = createSlots(document);
  slots.panel.set(PANEL_HOST_CSS);
  slots.library.set(LIBRARY_CSS);

  const iconResolver = createIconResolver({ settings });
  const hooks = {
    resolveIcons: (requests, ctx) => createIconResolver({ settings: ctx.settings || settings }).resolveIcons(requests, ctx),
  };
  let pipeline = null;
  let panel = null;

  panel = createPanel({
    doc: document,
    styles: STYLES,
    settings,
    site,
    hasKey: storage.hasApiKey(),
    handlers: {
      onToggleSite(enabled) {
        storage.saveSiteRecord(hostname, { enabled });
        if (!enabled) {
          pipeline.restore();
          panel.setStatus('disabled for this site');
          setState('disabled');
        } else {
          panel.setStatus('enabled — redesigning', 'ok');
          pipeline.runDesign({});
        }
      },
      onStyleChange(style) {
        settings = storage.saveSettings({ style });
      },
      onRedesign({ style }) {
        settings = storage.saveSettings({ style });
        pipeline.runDesign({ styleId: style });
      },
      onRestore() {
        pipeline.restore();
        panel.setStatus('original styles restored (cache kept)');
        setState('idle');
      },
      onClearSite() {
        pipeline.restore();
        storage.clearSiteRecord(hostname);
        panel.setStatus('site cache cleared');
        panel.setReport('');
      },
      onClearAll() {
        pipeline.restore();
        storage.clearAllSiteRecords();
        panel.setStatus('all site caches cleared');
      },
      onSetKey(key) {
        storage.setApiKey(key);
        panel.setKeyState(storage.hasApiKey());
        panel.setStatus('API key saved to Tampermonkey storage', 'ok');
      },
      onClearKey() {
        storage.clearApiKey();
        panel.setKeyState(false);
        panel.setStatus('API key removed');
      },
      onSettingsChange(patch) {
        settings = storage.saveSettings(patch);
        panel.setStatus('settings saved', 'ok');
      },
    },
  });

  pipeline = createPipeline({ doc: document, hostname, slots, panel, setState, getSettings: () => (settings = storage.getSettings()), hooks });

  storage.registerMenuCommand('retro-web: set Claude API key', () => {
    const k = prompt('Paste your Claude API key (stored only in Tampermonkey storage):');
    if (k && k.trim()) {
      storage.setApiKey(k.trim());
      panel.setKeyState(true);
      panel.setStatus('API key saved', 'ok');
    }
  });
  storage.registerMenuCommand('retro-web: clear Claude API key', () => {
    storage.clearApiKey();
    panel.setKeyState(false);
    panel.setStatus('API key removed');
  });
  storage.registerMenuCommand('retro-web: log page summary', () => {
    const { text } = summarizePage(document, { tokenBudget: settings.summaryTokenBudget });
    console.log('[retro-web] page summary\n' + text);
    panel.setReport(text);
    panel.showReport();
  });
  storage.registerMenuCommand('retro-web: redesign this page', () => pipeline.runDesign({}));
  storage.registerMenuCommand('retro-web: list generated icons', () => {
    const list = iconResolver.cache.list();
    console.log(`[retro-web] ${list.length} generated icon(s) in the shared cache`, list.map((i) => i.name));
    panel.setReport(list.length ? list.map((i) => `${i.name} — ${i.description} (${new Date(i.createdAt).toLocaleDateString()})`).join('\n') : '(no generated icons yet)');
    panel.showReport();
  });
  storage.registerMenuCommand('retro-web: clear generated icons', () => {
    iconResolver.cache.clear();
    panel.setStatus('generated icon cache cleared');
  });
  storage.registerMenuCommand('retro-web: toggle on this site', () => {
    const rec = storage.getSiteRecord(hostname) || {};
    const enabled = rec.enabled === false;
    storage.saveSiteRecord(hostname, { enabled });
    panel.setEnabled(enabled);
    location.reload();
  });

  const notes = [];
  if (!slots.working()) notes.push('styles blocked by CSP');
  if (!env.webgpu) notes.push('no WebGPU in page (host decides)');
  if (site.enabled === false) {
    panel.setStatus('disabled for this site');
    setState('disabled');
    return;
  }
  if (site.css) {
    pipeline.applyCached(site);
    panel.setReport(formatReport(site));
    panel.setStatus(`cached design (${site.style})` + (notes.length ? ' · ' + notes.join(', ') : ''), 'ok');
    setState('done', { cached: true, style: site.style });
    return;
  }
  panel.setStatus(`v${VERSION} ready` + (notes.length ? ' · ' + notes.join(', ') : ''), notes.length ? 'err' : 'ok');
  setState('idle', { env, blocked: [...csp.blocked] });
  if (settings.autoDesign) {
    // let the page settle (fonts, late scripts) before summarizing
    setTimeout(() => pipeline.runDesign({}), settings.settleDelayMs);
  }
}

try {
  main();
} catch (e) {
  console.error('[retro-web] fatal', e);
  setState('error', { message: String(e && e.message) });
}
