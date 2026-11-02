// Resolves the model's icon requests: library (exact or fuzzy) → shared cache →
// Claude API (sanitized, cached) → fallback (closest library icon, then the
// placeholder). Produces `:root { --icon-NAME: ... }` CSS. Never throws.
import { MANIFEST } from '../assets/index.js';
import { svgToDataUri } from '../util/svg-data-uri.js';
import { sanitizeSvg } from './sanitize.js';
import { requestIconSvg } from './claude.js';
import { createIconCache } from './cache.js';
import { hasApiKey } from '../storage.js';

const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'icon', 'small', 'for', 'and', 'in', 'on', 'to', 'pixel', 'style', 'simple', 'symbol', 'sign', 'button', 'image']);
const SYNONYMS = {
  house: 'home', homepage: 'home', email: 'mail', envelope: 'mail', letter: 'mail', inbox: 'mail', magnifier: 'search', magnifying: 'search', find: 'search', lookup: 'search',
  basket: 'cart', shopping: 'cart', bag: 'cart', checkout: 'cart', buy: 'cart', person: 'user', avatar: 'user', profile: 'user', account: 'user', login: 'user', member: 'user',
  directory: 'folder', document: 'file', page: 'file', doc: 'file', paper: 'file', article: 'file', favorite: 'star', favourite: 'star', rating: 'star', like: 'heart', love: 'heart',
  settings: 'gear', cog: 'gear', config: 'gear', preferences: 'gear', tool: 'gear', tools: 'gear', note: 'music', song: 'music', audio: 'music', photo: 'image', picture: 'image', gallery: 'image', camera: 'image',
  chain: 'link', url: 'link', save: 'download', export: 'download', feed: 'rss', comment: 'chat', comments: 'chat', bubble: 'chat', message: 'chat', talk: 'chat', forum: 'chat',
  secure: 'lock', password: 'lock', private: 'lock', world: 'globe', web: 'globe', earth: 'globe', international: 'globe', language: 'globe', fire: 'hot', flame: 'hot', trending: 'hot',
  tick: 'check', done: 'check', ok: 'check', success: 'check', remove: 'close', delete: 'close', x: 'close', cancel: 'close', hamburger: 'menu', bars: 'menu', navigation: 'menu',
  date: 'calendar', event: 'calendar', schedule: 'calendar', time: 'clock', history: 'clock', recent: 'clock', printer: 'print', label: 'tag', price: 'tag', sale: 'tag',
  ribbon: 'bookmark', saved: 'bookmark', video: 'play', watch: 'play', next: 'arrow-right', previous: 'arrow-left', back: 'arrow-left', forward: 'arrow-right', up: 'arrow-up', down: 'arrow-down', top: 'arrow-up',
  alert: 'warning', error: 'warning', danger: 'warning', help: 'info', question: 'info', about: 'info', new: 'new', fresh: 'new',
};

export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => SYNONYMS[t] || t);
}

// Scores how well a library icon matches a request (0..1+).
export function matchLibraryIcon(request, library = MANIFEST.icons) {
  const reqName = tokens(request.name);
  const reqAll = new Set([...reqName, ...tokens(request.description)]);
  let best = null;
  for (const icon of library) {
    if (icon.name === 'placeholder') continue;
    const iconTokens = new Set([...tokens(icon.name), ...tokens(icon.description)]);
    let score = 0;
    if (icon.name === request.name) score += 2;
    if (reqName.includes(icon.name) || reqName.join('-') === icon.name) score += 1;
    for (const t of reqAll) if (iconTokens.has(t)) score += t === icon.name ? 0.6 : 0.3;
    if (!best || score > best.score) best = { icon, score };
  }
  return best && best.score > 0 ? best : null;
}

export function createIconResolver({ settings, fetchSvg = requestIconSvg, cache = createIconCache(), library = MANIFEST.icons, hasKey = hasApiKey } = {}) {
  const inflight = new Map();

  async function resolveOne(req, ctx) {
    const name = req.name;
    const varName = '--icon-' + name;
    const libNames = new Set(library.map((i) => i.name));
    if (libNames.has(name)) return { name, varName, source: 'library', value: null };

    const fuzzy = matchLibraryIcon(req, library);
    if (fuzzy && fuzzy.score >= 1) return { name, varName, source: 'library-alias', alias: fuzzy.icon.name, value: `var(--icon-${fuzzy.icon.name})` };

    const cached = cache.get(name, req.description) || cache.findByName(name);
    if (cached) return { name, varName, source: 'cache', value: `url("${cached.uri}")` };

    if (hasKey()) {
      const key = name + '|' + req.description;
      if (!inflight.has(key)) {
        inflight.set(
          key,
          fetchSvg({ name, description: req.description, size: 16, settings, signal: ctx.signal }).finally(() => inflight.delete(key)),
        );
      }
      const r = await inflight.get(key);
      if (r && r.svg) {
        const s = sanitizeSvg(r.svg);
        if (s.svg) {
          const uri = svgToDataUri(s.svg);
          if (uri) {
            cache.put(name, req.description, { svg: s.svg, uri, model: settings.iconModel });
            return { name, varName, source: 'claude', value: `url("${uri}")`, removed: s.removed };
          }
        }
        return fallback(req, fuzzy, 'unsafe svg: ' + (s.errors.join('; ') || 'rejected'));
      }
      return fallback(req, fuzzy, (r && r.error) || 'no reply');
    }
    return fallback(req, fuzzy, 'no-key');
  }

  function fallback(req, fuzzy, reason) {
    const name = req.name;
    const varName = '--icon-' + name;
    if (fuzzy && fuzzy.score >= 0.3) return { name, varName, source: 'fallback-library', alias: fuzzy.icon.name, value: `var(--icon-${fuzzy.icon.name})`, reason };
    return { name, varName, source: 'placeholder', value: 'var(--icon-placeholder)', reason };
  }

  async function resolveIcons(requests, ctx = {}) {
    const list = (requests || []).filter((r) => r && r.name);
    const limit = Math.max(1, settings.iconConcurrency || 3);
    const results = new Array(list.length);
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        try {
          results[i] = await resolveOne(list[i], ctx);
        } catch (e) {
          results[i] = fallback(list[i], matchLibraryIcon(list[i], library), 'error: ' + (e && e.message));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
    const lines = results.filter((r) => r.value).map((r) => `${r.varName}: ${r.value};`);
    return {
      css: lines.length ? `:root { ${lines.join(' ')} }` : '',
      resolved: results.filter((r) => !r.reason),
      failed: results.filter((r) => r.reason),
      results,
    };
  }

  return { resolveIcons, resolveOne, cache };
}
