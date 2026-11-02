// Floating Win98-style control panel. Lives in a CLOSED shadow root on a custom
// element so page CSS cannot reach it and page scripts cannot read its inputs
// through `.shadowRoot`. The API key input is cleared immediately after save.
import panelCss from './panel.css';
import { PANEL_TAG, PANEL_ID } from '../config.js';
import { canUseAdoptedStyleSheets } from '../csp.js';

// Styles for the host element itself go on the document (panel slot, last in
// cascade). The id selector plus !important keeps model CSS from moving it.
export const PANEL_HOST_CSS = `
#${PANEL_ID}{position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;transform:none!important;filter:none!important;pointer-events:auto!important;contain:content;}
`;

export function createPanel({ doc = document, styles = [], settings, site, hasKey, handlers = {} }) {
  const host = doc.createElement(PANEL_TAG);
  host.id = PANEL_ID;
  const root = host.attachShadow({ mode: 'closed' });

  // Panel CSS: constructed sheet when possible (CSP-safe), else <style>.
  if (canUseAdoptedStyleSheets(doc)) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(panelCss);
      root.adoptedStyleSheets = [sheet];
    } catch {
      const s = doc.createElement('style');
      s.textContent = panelCss;
      root.appendChild(s);
    }
  } else {
    const s = doc.createElement('style');
    s.textContent = panelCss;
    root.appendChild(s);
  }

  const el = (tag, attrs = {}, ...children) => {
    const n = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children) if (c != null) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    return n;
  };

  // ---- widgets ----
  const status = el('div', { class: 'status', text: 'idle' });
  const bar = el('div', { class: 'bar' }, el('i'));
  const enabled = el('input', { type: 'checkbox' });
  enabled.checked = !site || site.enabled !== false;
  enabled.addEventListener('change', () => handlers.onToggleSite?.(enabled.checked));

  const styleSel = el('select');
  styleSel.appendChild(el('option', { value: 'random', text: '🎲 random style' }));
  for (const s of styles) styleSel.appendChild(el('option', { value: s.id, text: s.name }));
  styleSel.value = settings.style || 'random';
  styleSel.addEventListener('change', () => handlers.onStyleChange?.(styleSel.value));

  const redesign = el('button', { class: 'b', text: 'Redesign', onclick: () => handlers.onRedesign?.({ style: styleSel.value }) });
  const randomBtn = el('button', {
    class: 'b',
    text: '🎲',
    title: 'Redesign with a random style',
    onclick: () => {
      styleSel.value = 'random';
      handlers.onRedesign?.({ style: 'random' });
    },
  });
  const restore = el('button', { class: 'b', text: 'Original', title: 'Remove the redesign for this page view', onclick: () => handlers.onRestore?.() });

  const report = el('textarea', { class: 'report hidden', readonly: true, spellcheck: 'false' });
  const reportBtn = el('button', {
    class: 'b',
    text: 'Report',
    onclick: () => report.classList.toggle('hidden'),
  });
  const clearSite = el('button', { class: 'b', text: 'Clear site', onclick: () => handlers.onClearSite?.() });
  const clearAll = el('button', { class: 'b', text: 'Clear all', onclick: () => handlers.onClearAll?.() });

  const keyState = el('span', { class: 'key' + (hasKey ? '' : ' none'), text: hasKey ? 'key set' : 'no key' });
  const keyInput = el('input', { type: 'password', placeholder: 'sk-ant-… (stored in Tampermonkey only)', class: 'hidden', autocomplete: 'off' });
  const keyBtn = el('button', {
    class: 'b',
    text: 'Set key',
    onclick: () => {
      if (keyInput.classList.contains('hidden')) {
        keyInput.classList.remove('hidden');
        keyInput.focus();
        return;
      }
      const v = keyInput.value;
      keyInput.value = '';
      keyInput.classList.add('hidden');
      if (v.trim()) handlers.onSetKey?.(v.trim());
    },
  });
  keyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') keyBtn.click();
    if (e.key === 'Escape') {
      keyInput.value = '';
      keyInput.classList.add('hidden');
    }
    e.stopPropagation();
  });
  const keyClear = el('button', { class: 'b', text: 'Clear key', onclick: () => handlers.onClearKey?.() });

  // advanced settings
  const modelInput = el('input', { type: 'text', value: settings.modelId });
  const hostInput = el('input', { type: 'text', value: settings.hostUrl });
  const roundsInput = el('input', { type: 'number', min: '0', max: '6', value: String(settings.maxRepairRounds) });
  const autoInput = el('input', { type: 'checkbox' });
  autoInput.checked = !!settings.autoDesign;
  const iconModelInput = el('input', { type: 'text', value: settings.iconModel });
  const customUrlInput = el('input', { type: 'text', value: settings.customModelUrl || '', placeholder: 'https://huggingface.co/<user>/<repo> (optional)' });
  const customLibInput = el('input', { type: 'text', value: settings.customModelLib || '', placeholder: 'model_lib .wasm URL (optional)' });
  const saveBtn = el('button', {
    class: 'b',
    text: 'Save settings',
    onclick: () =>
      handlers.onSettingsChange?.({
        modelId: modelInput.value.trim(),
        hostUrl: hostInput.value.trim(),
        maxRepairRounds: Math.max(0, Math.min(6, parseInt(roundsInput.value, 10) || 0)),
        autoDesign: autoInput.checked,
        iconModel: iconModelInput.value.trim(),
        customModelUrl: customUrlInput.value.trim(),
        customModelLib: customLibInput.value.trim(),
      }),
  });

  const win = el(
    'div',
    { class: 'win' },
    el(
      'div',
      { class: 'title' },
      el('span', { class: 'ico' }),
      el('span', { class: 't', text: 'retro-web' }),
      el('button', { class: 'tb', text: '_', title: 'Minimize', onclick: () => setMinimized(true) }),
      el('button', { class: 'tb', text: '×', title: 'Hide panel until reload', onclick: () => host.remove() }),
    ),
    el(
      'div',
      { class: 'body' },
      status,
      bar,
      el('div', { class: 'row' }, el('label', {}, enabled, 'Enabled on this site')),
      el('div', { class: 'row' }, styleSel, randomBtn, redesign),
      el('div', { class: 'row' }, restore, reportBtn, clearSite, clearAll),
      report,
      el('div', { class: 'row' }, el('span', { text: 'Claude API: ' }), keyState, keyBtn, keyClear),
      keyInput,
      el(
        'details',
        {},
        el('summary', { text: 'Advanced' }),
        el(
          'div',
          { class: 'grid' },
          el('span', { text: 'Model id' }),
          modelInput,
          el('span', { text: 'Host URL' }),
          hostInput,
          el('span', { text: 'Icon model' }),
          iconModelInput,
          el('span', { text: 'HF model' }),
          customUrlInput,
          el('span', { text: 'Model lib' }),
          customLibInput,
          el('span', { text: 'Repair rounds' }),
          roundsInput,
          el('span', { text: 'Auto design' }),
          autoInput,
        ),
        el('div', { class: 'row', style: 'margin-top:4px' }, saveBtn),
      ),
      el('div', { class: 'foot', text: 'retro-web · 2000s mode' }),
    ),
  );
  const mini = el('button', { class: 'mini hidden', text: '▲ retro-web', onclick: () => setMinimized(false) });
  root.appendChild(win);
  root.appendChild(mini);

  function setMinimized(m) {
    win.classList.toggle('hidden', m);
    mini.classList.toggle('hidden', !m);
  }

  // drag by title bar
  const title = win.querySelector('.title');
  let drag = null;
  title.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tb')) return;
    const r = host.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  });
  doc.addEventListener('mousemove', (e) => {
    if (!drag) return;
    host.style.setProperty('left', Math.max(0, e.clientX - drag.dx) + 'px', 'important');
    host.style.setProperty('top', Math.max(0, e.clientY - drag.dy) + 'px', 'important');
    host.style.setProperty('right', 'auto', 'important');
    host.style.setProperty('bottom', 'auto', 'important');
  });
  doc.addEventListener('mouseup', () => (drag = null));

  // keep page keyboard shortcuts from firing while typing in the panel
  root.addEventListener('keydown', (e) => e.stopPropagation());

  (doc.documentElement || doc.body).appendChild(host);

  return {
    host,
    setStatus(text, kind = '') {
      status.textContent = text;
      status.className = 'status' + (kind ? ' ' + kind : '');
    },
    setProgress(fraction) {
      if (fraction == null) {
        bar.classList.remove('show');
        return;
      }
      bar.classList.add('show');
      bar.firstChild.style.width = Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%';
    },
    setReport(text) {
      report.value = text || '(no issues)';
    },
    showReport() {
      report.classList.remove('hidden');
    },
    setKeyState(has) {
      keyState.textContent = has ? 'key set' : 'no key';
      keyState.className = 'key' + (has ? '' : ' none');
    },
    setEnabled(v) {
      enabled.checked = v;
    },
    setStyle(id) {
      styleSel.value = id || 'random';
    },
    setBusy(b) {
      redesign.disabled = b;
      randomBtn.disabled = b;
    },
    // Opens the key field inside the closed shadow root (never window.prompt,
    // which a hostile page could override).
    promptKey() {
      setMinimized(false);
      keyInput.classList.remove('hidden');
      keyInput.focus();
    },
    minimize: () => setMinimized(true),
    destroy: () => host.remove(),
  };
}
