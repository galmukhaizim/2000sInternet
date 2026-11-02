// retro-web userscript entry. Phase 1: shell + panel + storage + menu commands.
// The design pipeline (summarize → model → validate → apply → repair) is wired
// in later phases; see CLAUDE.md for the architecture.
import { VERSION, PANEL_ID } from './config.js';
import * as storage from './storage.js';
import { createSlots } from './apply.js';
import { createPanel, PANEL_HOST_CSS } from './ui/panel.js';
import { createCspMonitor, describeEnvironment } from './csp.js';
import { STYLES } from './model/styles.js';
import { LIBRARY_CSS } from './assets/index.js';
import { summarizePage } from './summarize.js';

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
  const settings = storage.getSettings();
  const site = storage.getSiteRecord(hostname) || {};
  const csp = createCspMonitor(document);
  const env = describeEnvironment(document);
  const slots = createSlots(document);
  slots.panel.set(PANEL_HOST_CSS);
  slots.library.set(LIBRARY_CSS);

  const panel = createPanel({
    doc: document,
    styles: STYLES,
    settings,
    site,
    hasKey: storage.hasApiKey(),
    handlers: {
      onToggleSite(enabled) {
        storage.saveSiteRecord(hostname, { enabled });
        panel.setStatus(enabled ? 'enabled — reload to apply' : 'disabled for this site', enabled ? 'ok' : '');
        setState(enabled ? 'idle' : 'disabled');
      },
      onStyleChange(style) {
        storage.saveSettings({ style });
      },
      onRedesign() {
        panel.setStatus('design pipeline arrives in phase 3', 'err');
      },
      onRestore() {
        slots.design.clear();
        slots.patch.clear();
        slots.fallback.clear();
        slots.icons.clear();
        panel.setStatus('original styles restored');
      },
      onClearSite() {
        storage.clearSiteRecord(hostname);
        panel.setStatus('site cache cleared');
      },
      onClearAll() {
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
        storage.saveSettings(patch);
        panel.setStatus('settings saved', 'ok');
      },
    },
  });

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
  storage.registerMenuCommand('retro-web: toggle on this site', () => {
    const rec = storage.getSiteRecord(hostname) || {};
    const enabled = rec.enabled === false;
    storage.saveSiteRecord(hostname, { enabled });
    panel.setEnabled(enabled);
    location.reload();
  });

  const notes = [];
  if (!slots.working()) notes.push('styles blocked by CSP');
  if (!env.webgpu) notes.push('no WebGPU');
  if (site.enabled === false) {
    panel.setStatus('disabled for this site');
    setState('disabled');
    return;
  }
  panel.setStatus(`v${VERSION} ready` + (notes.length ? ' · ' + notes.join(', ') : ''), notes.length ? 'err' : 'ok');
  setState('idle', { env, blocked: [...csp.blocked] });
}

try {
  main();
} catch (e) {
  console.error('[retro-web] fatal', e);
  setState('error', { message: String(e && e.message) });
}
