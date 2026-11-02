// Thin wrappers over GM_* with a localStorage/in-memory fallback so the same
// code runs inside Tampermonkey, inside the Playwright eval harness (which
// provides a GM shim) and in unit tests.
//
// SECURITY: the Claude API key lives only in this storage. `readApiKey()` may be
// called ONLY by icons/claude.js to fill a GM_xmlhttpRequest header. Never log
// it, never put it on window/DOM, never pass it to the host iframe.
import { DEFAULTS, STORAGE_KEYS, CACHE_VERSION } from './config.js';

/* global GM_getValue, GM_setValue, GM_deleteValue, GM_listValues, GM_registerMenuCommand */

const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
const memory = new Map();
const LS_PREFIX = '__retro_web__:';

function ls() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getValue(key, fallback) {
  if (hasGM) {
    const v = GM_getValue(key);
    return v === undefined || v === null ? fallback : v;
  }
  const store = ls();
  if (store) {
    try {
      const raw = store.getItem(LS_PREFIX + key);
      if (raw != null) return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return memory.has(key) ? memory.get(key) : fallback;
}

export function setValue(key, value) {
  if (hasGM) {
    GM_setValue(key, value);
    return;
  }
  memory.set(key, value);
  const store = ls();
  if (store) {
    try {
      store.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota or disabled */
    }
  }
}

export function deleteValue(key) {
  if (hasGM) {
    if (typeof GM_deleteValue === 'function') GM_deleteValue(key);
    else GM_setValue(key, undefined);
    return;
  }
  memory.delete(key);
  const store = ls();
  if (store) {
    try {
      store.removeItem(LS_PREFIX + key);
    } catch {
      /* ignore */
    }
  }
}

export function listKeys() {
  if (hasGM && typeof GM_listValues === 'function') return GM_listValues();
  const keys = new Set(memory.keys());
  const store = ls();
  if (store) {
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(LS_PREFIX)) keys.add(k.slice(LS_PREFIX.length));
      }
    } catch {
      /* ignore */
    }
  }
  return [...keys];
}

export function registerMenuCommand(label, fn) {
  if (typeof GM_registerMenuCommand === 'function') {
    try {
      GM_registerMenuCommand(label, fn);
    } catch {
      /* ignore */
    }
  }
}

// ---- settings ----
export function getSettings() {
  const saved = getValue(STORAGE_KEYS.settings, {}) || {};
  return { ...DEFAULTS, ...saved };
}

export function saveSettings(patch) {
  const saved = getValue(STORAGE_KEYS.settings, {}) || {};
  const next = { ...saved, ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === DEFAULTS[k]) delete next[k];
  setValue(STORAGE_KEYS.settings, next);
  return getSettings();
}

// ---- per-site records ----
export function siteKey(hostname) {
  return STORAGE_KEYS.sitePrefix + String(hostname || '').toLowerCase();
}

export function getSiteRecord(hostname) {
  const rec = getValue(siteKey(hostname), null);
  if (!rec || typeof rec !== 'object') return null;
  if (rec.cacheVersion !== CACHE_VERSION) return { enabled: rec.enabled !== false };
  return rec;
}

export function saveSiteRecord(hostname, patch) {
  const prev = getValue(siteKey(hostname), null) || {};
  const next = { ...prev, ...patch, cacheVersion: CACHE_VERSION, updatedAt: Date.now() };
  setValue(siteKey(hostname), next);
  return next;
}

export function clearSiteRecord(hostname, { keepEnabled = true } = {}) {
  const prev = getSiteRecord(hostname);
  deleteValue(siteKey(hostname));
  if (keepEnabled && prev && prev.enabled === false) saveSiteRecord(hostname, { enabled: false });
}

export function clearAllSiteRecords() {
  for (const k of listKeys()) if (k.startsWith(STORAGE_KEYS.sitePrefix)) deleteValue(k);
}

// ---- API key ----
export function hasApiKey() {
  const k = getValue(STORAGE_KEYS.apiKey, '');
  return typeof k === 'string' && k.length > 0;
}

export function setApiKey(key) {
  const k = String(key || '').trim();
  if (!k) {
    deleteValue(STORAGE_KEYS.apiKey);
    return false;
  }
  setValue(STORAGE_KEYS.apiKey, k);
  return true;
}

export function clearApiKey() {
  deleteValue(STORAGE_KEYS.apiKey);
}

// Only icons/claude.js may call this. See header comment.
export function readApiKey() {
  const k = getValue(STORAGE_KEYS.apiKey, '');
  return typeof k === 'string' ? k : '';
}
