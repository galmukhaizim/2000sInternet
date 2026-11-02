// Shared icon cache in GM storage: generated icons are reused on every site.
import { getValue, setValue, deleteValue, listKeys } from '../storage.js';
import { STORAGE_KEYS } from '../config.js';

export function iconHash(name, description) {
  const s = `${String(name).toLowerCase().trim()}|${String(description || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function createIconCache(storage = { getValue, setValue, deleteValue, listKeys }) {
  const prefix = STORAGE_KEYS.iconPrefix;
  return {
    key: (name, description) => prefix + iconHash(name, description),
    get(name, description) {
      const v = storage.getValue(prefix + iconHash(name, description), null);
      return v && v.uri ? v : null;
    },
    // Looser lookup by name only (any description) for reuse across sites.
    findByName(name) {
      const n = String(name).toLowerCase();
      for (const k of storage.listKeys()) {
        if (!k.startsWith(prefix)) continue;
        const v = storage.getValue(k, null);
        if (v && v.name === n && v.uri) return v;
      }
      return null;
    },
    put(name, description, entry) {
      const rec = { name: String(name).toLowerCase(), description: String(description || ''), createdAt: Date.now(), ...entry };
      storage.setValue(prefix + iconHash(name, description), rec);
      return rec;
    },
    list() {
      return storage
        .listKeys()
        .filter((k) => k.startsWith(prefix))
        .map((k) => storage.getValue(k, null))
        .filter(Boolean);
    },
    clear() {
      for (const k of storage.listKeys()) if (k.startsWith(prefix)) storage.deleteValue(k);
    },
  };
}
