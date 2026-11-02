import { describe, it, expect, beforeEach } from 'vitest';
import { createIconResolver, matchLibraryIcon, tokens } from '../src/icons/index.js';
import { createIconCache, iconHash } from '../src/icons/cache.js';
import { buildIconRequest, extractSvgFromResponse, ICON_SYSTEM_PROMPT } from '../src/icons/claude.js';
import { DEFAULTS } from '../src/config.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#3366cc"/></svg>';

function memStorage() {
  const m = new Map();
  return {
    getValue: (k, d) => (m.has(k) ? m.get(k) : d),
    setValue: (k, v) => m.set(k, v),
    deleteValue: (k) => m.delete(k),
    listKeys: () => [...m.keys()],
    map: m,
  };
}

describe('library matching', () => {
  it('normalises tokens with synonyms', () => {
    expect(tokens('a Shopping Bag icon')).toEqual(['cart', 'cart']);
    expect(tokens('house')).toEqual(['home']);
  });
  it('finds exact, synonym and fuzzy matches', () => {
    expect(matchLibraryIcon({ name: 'home', description: '' }).icon.name).toBe('home');
    expect(matchLibraryIcon({ name: 'house', description: 'a little house' }).icon.name).toBe('home');
    expect(matchLibraryIcon({ name: 'shopping-bag', description: 'paper shopping bag' }).icon.name).toBe('cart');
    expect(matchLibraryIcon({ name: 'magnifying-glass', description: 'search' }).icon.name).toBe('search');
    expect(matchLibraryIcon({ name: 'zebra', description: 'striped animal' })).toBeNull();
  });
});

describe('icon cache', () => {
  it('hashes name+description stably and ignores case/whitespace', () => {
    expect(iconHash('Bag', ' paper  bag ')).toBe(iconHash('bag', 'paper bag'));
    expect(iconHash('bag', 'paper bag')).not.toBe(iconHash('bag', 'plastic bag'));
  });
  it('stores and lists entries', () => {
    const c = createIconCache(memStorage());
    c.put('zebra', 'striped', { svg: SVG, uri: 'data:image/svg+xml,x' });
    expect(c.get('zebra', 'striped').uri).toBe('data:image/svg+xml,x');
    expect(c.findByName('ZEBRA').name).toBe('zebra');
    expect(c.list()).toHaveLength(1);
    c.clear();
    expect(c.list()).toHaveLength(0);
  });
});

describe('claude request shape', () => {
  it('sends only the icon name, description and fixed system prompt', () => {
    const r = buildIconRequest({ name: 'zebra', description: 'striped animal', settings: DEFAULTS });
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers['anthropic-version']).toBe('2023-06-01');
    expect(r.headers['x-api-key']).toBeUndefined();
    expect(r.body.model).toBe('claude-haiku-5-5');
    expect(r.body.system).toBe(ICON_SYSTEM_PROMPT);
    expect(r.body.messages).toEqual([{ role: 'user', content: 'Icon name: zebra\nDescription: striped animal\nSize: 16' }]);
    expect(JSON.stringify(r.body.messages)).not.toMatch(/http|location|document|title/i);
  });
  it('extracts the svg from a response and flags refusals/truncation', () => {
    expect(extractSvgFromResponse({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'here ' + SVG }] }).svg).toBe(SVG);
    expect(extractSvgFromResponse({ stop_reason: 'refusal', content: [] }).error).toBe('refusal');
    expect(extractSvgFromResponse({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '<svg><rect' }] }).error).toBe('truncated');
  });
});

describe('createIconResolver', () => {
  let calls;
  let storage;
  const settings = { ...DEFAULTS, iconConcurrency: 2 };
  const fetchSvg = async ({ name }) => {
    calls.push(name);
    if (name === 'zebra') return { svg: '```' + SVG.replace('<rect', '<script>alert(1)</script><rect') + '```' };
    if (name === 'broken') return { svg: '<svg><text>no shapes</text></svg>' };
    return { svg: null, error: 'network error' };
  };
  beforeEach(() => {
    calls = [];
    storage = memStorage();
  });

  it('uses library icons and aliases without calling the API', async () => {
    const r = createIconResolver({ settings, fetchSvg, cache: createIconCache(storage), hasKey: () => true });
    const out = await r.resolveIcons([{ name: 'home', description: 'house' }, { name: 'shopping-bag', description: 'paper bag' }]);
    expect(calls).toEqual([]);
    expect(out.css).toBe(':root { --icon-shopping-bag: var(--icon-cart); }');
    expect(out.resolved.map((x) => x.source)).toEqual(['library', 'library-alias']);
  });
  it('calls the API for unknown icons, sanitizes and caches the result', async () => {
    const cache = createIconCache(storage);
    const r = createIconResolver({ settings, fetchSvg, cache, hasKey: () => true });
    const out = await r.resolveIcons([{ name: 'zebra', description: 'striped animal' }]);
    expect(calls).toEqual(['zebra']);
    expect(out.resolved[0].source).toBe('claude');
    expect(out.css).toMatch(/^:root \{ --icon-zebra: url\("data:image\/svg\+xml,/);
    expect(out.css).not.toMatch(/script/i);
    expect(cache.get('zebra', 'striped animal').uri).toContain('data:image/svg+xml');
    // second time: cache hit, no API call
    const again = await r.resolveIcons([{ name: 'zebra', description: 'striped animal' }]);
    expect(calls).toEqual(['zebra']);
    expect(again.resolved[0].source).toBe('cache');
  });
  it('falls back to the closest library icon, then the placeholder', async () => {
    const r = createIconResolver({ settings, fetchSvg, cache: createIconCache(storage), hasKey: () => true });
    const out = await r.resolveIcons([{ name: 'broken', description: 'a user profile picture' }, { name: 'nothing', description: 'qqq' }]);
    expect(out.failed).toHaveLength(2);
    expect(out.failed[0].source).toBe('fallback-library');
    expect(out.failed[0].value).toBe('var(--icon-user)');
    expect(out.failed[1].source).toBe('placeholder');
    expect(out.css).toContain('--icon-nothing: var(--icon-placeholder);');
  });
  it('never calls the API without a key', async () => {
    const r = createIconResolver({ settings, fetchSvg, cache: createIconCache(storage), hasKey: () => false });
    const out = await r.resolveIcons([{ name: 'zebra', description: 'striped animal' }]);
    expect(calls).toEqual([]);
    expect(out.failed[0].reason).toBe('no-key');
    expect(out.css).toContain('--icon-zebra: var(--icon-placeholder);');
  });
  it('dedupes concurrent requests and survives fetch errors', async () => {
    const r = createIconResolver({ settings, fetchSvg: async () => { throw new Error('boom'); }, cache: createIconCache(storage), hasKey: () => true });
    const out = await r.resolveIcons([{ name: 'zebra', description: 'x' }, { name: 'zebra', description: 'x' }]);
    expect(out.failed).toHaveLength(2);
    expect(out.failed[0].reason).toContain('boom');
  });
});
