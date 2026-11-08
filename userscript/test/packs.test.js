import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPack, iconForText, listPackStyles, selectorsFromSummary } from '../src/packs/index.js';
import { STYLES } from '../src/model/styles.js';
import { summarizePage } from '../src/summarize.js';
import { validateCss, validateApplyClass } from '../src/validate.js';
import { libraryVarNames, libraryClassNames } from '../src/assets/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, '..', '..', 'eval', 'fixtures', name + '.html'), 'utf8');

function load(name) {
  const html = fixture(name);
  document.documentElement.innerHTML = html.replace(/^<!doctype html>\s*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  return summarizePage(document);
}

describe('style packs', () => {
  it('has a theme for every sub-style', () => {
    expect(listPackStyles().sort()).toEqual(STYLES.map((s) => s.id).sort());
  });
  it('maps link text and hrefs to library icons', () => {
    expect(iconForText('Home', '/')).toBe('home');
    expect(iconForText('Contact us', '/contact')).toBe('mail');
    expect(iconForText('', '/shop/cart')).toBe('cart');
    expect(iconForText('Zorblax', '/zorblax', 'star')).toBe('star');
    expect(iconForText('Zorblax', '/zorblax')).toBeNull();
  });
  it('uses the summary landmarks as selectors with sensible fallbacks', () => {
    const S = selectorsFromSummary({ landmarks: [{ role: 'nav', selector: 'nav.main-nav' }, { role: 'nav', selector: '#footer-nav' }], buttons: [{ selector: 'a.cta' }] });
    expect(S.nav).toBe('nav.main-nav, #footer-nav');
    expect(S.navLinks).toBe('nav.main-nav a, #footer-nav a');
    expect(S.header).toBe('header, [role=banner]');
    expect(S.buttons.startsWith('a.cta, button')).toBe(true);
  });
  for (const name of ['blog', 'shop', 'portal']) {
    it(`renders every style for the ${name} fixture into valid, library-only CSS`, () => {
      const { data } = load(name);
      const vars = libraryVarNames();
      for (const style of STYLES) {
        const pack = renderPack(style.id, data);
        expect(pack.css.length).toBeGreaterThan(500);
        // only library variables are referenced
        for (const m of pack.css.matchAll(/var\((--[\w-]+)\)/g)) expect(vars.has(m[1]), `${style.id}: ${m[1]} is not a library asset`).toBe(true);
        const v = validateCss(pack.css, { doc: document, mode: 'design' });
        const bad = v.dropped.filter((d) => !/^no-match|no-selector|no-valid-declarations/.test(d.reason));
        expect(bad, `${style.id} on ${name}: ${JSON.stringify(bad)}`).toEqual([]);
        expect(v.errors, `${style.id} parse errors`).toEqual([]);
        expect(v.kept, `${style.id} on ${name} keeps too few rules`).toBeGreaterThanOrEqual(8);
        const ac = validateApplyClass(pack.applyClass, { doc: document, classNames: libraryClassNames() });
        expect(ac.dropped.filter((d) => d.reason === 'unknown-class')).toEqual([]);
      }
    });
  }
  it('gives nav links icons matched to their text', () => {
    const { data } = load('blog');
    const pack = renderPack('win98', data);
    expect(pack.css).toContain('nav.main-nav a[href="/"] { background-image: var(--icon-home); }');
    expect(pack.css).toContain('nav.main-nav a[href="/contact"] { background-image: var(--icon-mail); }');
    expect(pack.css).toContain('nav.main-nav a[href="/archive"] { background-image: var(--icon-folder); }');
    // default icon for unmatched links comes before the specific ones so the specific rules win
    expect(pack.css.indexOf('background-image: var(--icon-folder); }')).toBeLessThan(pack.css.indexOf('a[href="/"]'));
  });
  it('adds 2000s decorations through pseudo-elements that pass validation', () => {
    const { data } = load('blog');
    const v = validateCss(renderPack('geocities', data).css, { doc: document });
    expect(v.css).toContain('::before { content: "You are visitor number 0013370"');
    expect(v.css).toContain('UNDER CONSTRUCTION');
    expect(v.css).toContain('@keyframes retro-marquee-text');
    const m = validateCss(renderPack('matrix-terminal', data).css, { doc: document });
    expect(m.css).toContain('body::after { content: "" !important; position: fixed !important;');
  });
});

describe('style packs on app-like pages', () => {
  it('gives huge navs only colors (no icons, no padding) and leaves iconed links alone', () => {
    const { data } = load('app');
    const guide = data.landmarks.find((l) => l.role === 'nav');
    expect(guide.links).toBeGreaterThan(40);
    const pack = renderPack('win98', data);
    expect(pack.css).not.toMatch(/#guide a[^{]*\{[^}]*background-image: var\(--icon-folder\)/);
    expect(pack.css).not.toMatch(/#guide a[^{]*\{[^}]*padding-left: 24px/);
    expect(pack.css).toContain('#guide a, #guide a:visited { color: #000000; text-decoration: none;');
    // card titles (h3) are never turned into category bars
    const portal = renderPack('portal-1999', data);
    expect(portal.css).not.toMatch(/^h2, h3 \{/m);
    expect(portal.css).toMatch(/^h2 \{ background-color/m);
  });
  it('skips background icons for links and buttons that already have one', () => {
    document.body.innerHTML = '<nav class="main-nav"><a href="/"><svg></svg>Home</a><a href="/about">About</a></nav><button class="btn-ask"><svg></svg>Ask</button><button class="btn-search">Search</button>';
    const { data } = summarizePage(document);
    expect(data.navLinks.map((l) => l.hasIcon)).toEqual([true, false]);
    const pack = renderPack('win98', data);
    expect(pack.css).toContain('nav.main-nav a[href="/about"] { background-image: var(--icon-info); }');
    expect(pack.css).toContain('nav.main-nav a[href="/"] { background-image: none; padding-left: 8px; }');
    expect(pack.css).not.toMatch(/button\.btn-ask \{ background-image/);
    expect(pack.css).toMatch(/button\.btn-search \{ background-image: var\(--icon-search\)/);
  });
});
