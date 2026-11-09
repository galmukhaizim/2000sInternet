import { describe, it, expect } from 'vitest';
import { buildAllowList, snapshotGeometry, findGeometryViolations, rollbackGeometry, enforceGeometry } from '../src/repair/geometry.js';
import { validateCss } from '../src/validate.js';
import { summarizePage } from '../src/summarize.js';

const box = (x, y, w, h) => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h });
const BASE = { display: 'block', visibility: 'visible', position: 'static', paddingLeft: '0px', paddingTop: '0px', borderLeftWidth: '0px', borderTopWidth: '0px' };

// geometry by selector, switchable between "before" and "after" states
function measurer(states) {
  let current = 'before';
  const find = (el) => {
    for (const [sel, v] of Object.entries(states[current])) {
      try {
        if (el.matches(sel)) return v;
      } catch {
        /* ignore */
      }
    }
    return null;
  };
  const m = {
    rect: (el) => {
      const v = find(el);
      if (v && v.rect) return box(...v.rect);
      if (el.localName === 'body' || el.localName === 'html') return box(0, 0, 1280, 2000);
      const idx = [...el.ownerDocument.querySelectorAll('*')].indexOf(el);
      return box(10, 10 + idx * 60, 300, 40);
    },
    style: (el) => ({ ...BASE, ...((find(el) || {}).style || {}) }),
    textRect: () => null,
    scroll: () => ({ scrollWidth: 1280, clientWidth: 1280, scrollHeight: 2000, clientHeight: 800 }),
    naturalSize: () => ({ w: 16, h: 16, complete: true }),
    viewport: { width: 1280, height: 800 },
    propertyValue: () => 'x',
    set: (s) => (current = s),
  };
  return m;
}

const PAGE = `
<header id="top"><a class="logo" href="/">Site</a><nav class="main-nav"><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
<div class="toolbar"><button class="icon" aria-label="Search"><svg></svg></button><button class="icon" aria-label="Menu"><svg></svg></button><button class="cta">Sign in</button></div></header>
<main id="content"><div class="player"><video></video><div class="controls"><button class="play"><svg></svg></button><div class="bar"></div></div></div>
<p>Some text content for the page that is long enough to count as the main area.</p><ul><li>one item</li><li>two items</li></ul>
<img class="hero" alt=""><img class="tiny" alt=""></main>`;

describe('allow-list', () => {
  it('allows landmarks, text nav links, text buttons, inputs and main list items; refuses icon buttons and player controls', () => {
    document.body.innerHTML = PAGE;
    const m = measurer({ before: { 'button.icon': { rect: [0, 0, 40, 40] }, 'button.play': { rect: [0, 100, 40, 40] }, 'button.cta': { rect: [100, 0, 90, 36] }, 'img.hero': { rect: [0, 300, 600, 300] }, 'img.tiny': { rect: [0, 700, 16, 16] } } });
    const data = { landmarks: [{ role: 'header', selector: '#top' }, { role: 'nav', selector: 'nav.main-nav' }, { role: 'main', selector: '#content' }] };
    const { isAllowed } = buildAllowList(document, data, m);
    const q = (s) => document.querySelector(s);
    expect(isAllowed(q('#top'))).toBe(true);
    expect(isAllowed(q('nav.main-nav'))).toBe(true);
    expect(isAllowed(q('nav.main-nav a'))).toBe(true);
    expect(isAllowed(q('button.cta'))).toBe(true);
    expect(isAllowed(q('li'))).toBe(true);
    expect(isAllowed(q('button.icon'))).toBe(false);
    expect(isAllowed(q('button.play'))).toBe(false);
    expect(isAllowed(q('div.bar'))).toBe(false);
    expect(isAllowed(q('a.logo'))).toBe(false);
    expect(isAllowed(q('img.hero'))).toBe(true);
    expect(isAllowed(q('img.tiny'))).toBe(false);
  });
  it('makes the validator drop spacing on selectors that hit disallowed elements', () => {
    document.body.innerHTML = PAGE;
    const m = measurer({ before: { 'button.icon': { rect: [0, 0, 40, 40] }, 'button.play': { rect: [0, 100, 40, 40] }, 'button.cta': { rect: [100, 0, 90, 36] } } });
    const { isAllowed } = buildAllowList(document, { landmarks: [{ role: 'nav', selector: 'nav.main-nav' }] }, m);
    const r = validateCss('button { padding: 2px 8px; border: 1px solid #999; background: #eee; color: #000 } button.cta { padding: 4px 12px; border: 2px outset #fff } nav.main-nav a { padding: 2px 8px; display: inline-block }', { doc: document, spacingAllowed: isAllowed });
    expect(r.css).toContain('button { background: #eee !important; color: #000 !important; }');
    expect(r.css).toContain('button.cta { padding: 4px 12px !important; border: 2px outset #fff !important; }');
    expect(r.css).toContain('nav.main-nav a { padding: 2px 8px !important; display: inline-block !important; }');
    expect(r.dropped.filter((d) => d.reason === 'spacing-not-allowed')).toHaveLength(2);
  });
});

describe('snapshot / violations / rollback', () => {
  const states = {
    before: { 'button.icon': { rect: [0, 0, 40, 40] }, 'button.play': { rect: [0, 100, 40, 40] }, 'div.bar': { rect: [50, 110, 400, 6] }, 'div.controls': { rect: [0, 100, 500, 40] }, 'button.cta': { rect: [100, 0, 90, 36] }, 'div.toolbar': { rect: [0, 0, 300, 40] } },
    after: { 'button.icon': { rect: [0, 0, 58, 44] }, 'button.play': { rect: [0, 100, 40, 40] }, 'div.bar': { rect: [50, 110, 400, 6] }, 'div.controls': { rect: [0, 100, 500, 40] }, 'button.cta': { rect: [100, 0, 120, 44] }, 'div.toolbar': { rect: [0, 0, 300, 40] } },
  };
  it('reports resized icon buttons but not resized text buttons (allowed) or unchanged controls', () => {
    document.body.innerHTML = PAGE;
    const m = measurer(states);
    const { isAllowed } = buildAllowList(document, { landmarks: [] }, m);
    const snap = snapshotGeometry(document, m, { isAllowed });
    expect(snap.entries.get(document.querySelector('button.icon')).candidate).toBe(true);
    expect(snap.entries.get(document.querySelector('button.cta')).candidate).toBe(false);
    expect(snap.entries.get(document.querySelector('div.bar')).candidate).toBe(true); // inside the player
    m.set('after');
    const v = findGeometryViolations(snap, document, m);
    expect(v.map((x) => x.kind)).toEqual(['resized', 'resized']);
    expect(v.every((x) => x.el.matches('button.icon'))).toBe(true);
  });
  it("tolerates a child shifted only by its parent's new padding", () => {
    document.body.innerHTML = PAGE;
    const st = { before: { 'button.icon': { rect: [0, 0, 40, 40] }, 'div.toolbar': { rect: [0, 0, 300, 40] } }, after: { 'button.icon': { rect: [8, 4, 40, 40] }, 'div.toolbar': { rect: [0, 0, 316, 48], style: { paddingLeft: '8px', paddingTop: '4px' } } } };
    const m = measurer(st);
    const snap = snapshotGeometry(document, m, { isAllowed: () => false });
    m.set('after');
    expect(findGeometryViolations(snap, document, m).filter((v) => v.el.matches('button.icon'))).toEqual([]);
  });
  it('rolls geometry declarations out of matching rules and keeps cosmetics', () => {
    document.body.innerHTML = PAGE;
    const css = 'button { padding: 2px 8px !important; border: 1px solid #999 !important; background: #eee !important; }\nnav.main-nav a { padding: 4px !important; color: #000 !important; }\nbutton.icon::after { content: "x" !important; margin: 4px !important; }';
    const r = rollbackGeometry(css, [{ el: document.querySelector('button.icon'), kind: 'resized' }], document);
    expect(r.css).toBe('button { background: #eee !important; }\nnav.main-nav a { padding: 4px !important; color: #000 !important; }\nbutton.icon::after { content: "x" !important; margin: 4px !important; }');
    expect(r.removed).toEqual([{ selector: 'button', props: ['padding', 'border'] }]);
  });
  it('enforceGeometry fixes the slots and reports what it removed', async () => {
    document.body.innerHTML = PAGE;
    const m = measurer(states);
    const { isAllowed } = buildAllowList(document, { landmarks: [] }, m);
    const snap = snapshotGeometry(document, m, { isAllowed });
    m.set('after');
    const slots = { design: { css: 'button { padding: 2px 8px !important; color: red !important; }', set(c) { this.css = c; } }, patch: { css: '', set(c) { this.css = c; } }, fallback: { css: '', set(c) { this.css = c; } } };
    const g = await enforceGeometry({ doc: document, snapshot: snap, slots, measure: m, settle: async () => m.set('before') /* pretend the rollback restored geometry */ });
    expect(slots.design.css).toBe('button { color: red !important; }');
    expect(g.removed).toEqual([{ selector: 'button', props: ['padding'], slot: 'design' }]);
  });
});

describe('landmark verification', () => {
  it('rejects a toolbar of icon buttons as nav and a player wrapper as sidebar', () => {
    document.body.innerHTML = '<div class="actions"><a href="/a"><svg></svg></a><a href="/b"><svg></svg></a><a href="/c"><svg></svg></a><a href="/d"><svg></svg></a><button><svg></svg></button></div><aside class="sidebar"><video></video></aside><nav class="real"><a href="/">Home</a><a href="/x">Docs</a><a href="/y">Blog</a></nav><p>' + 'text '.repeat(200) + '</p>';
    const rect = (el) => {
      if (el.matches('.actions')) return box(0, 20, 600, 40);
      if (el.matches('aside.sidebar')) return box(900, 100, 300, 500);
      if (el.matches('nav.real')) return box(0, 70, 600, 30);
      if (el.localName === 'html' || el.localName === 'body') return box(0, 0, 1280, 1500);
      return box(10, 10, 100, 20);
    };
    const { data } = summarizePage(document, { rect, layoutAvailable: true, viewport: { width: 1280, height: 800 } });
    const roles = data.landmarks.map((l) => l.role + ':' + l.selector);
    expect(roles).toContain('nav:nav.real');
    expect(roles.some((r) => r.includes('.actions'))).toBe(false);
    expect(roles.some((r) => r.startsWith('sidebar'))).toBe(false);
  });
});
