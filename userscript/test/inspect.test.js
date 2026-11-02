import { describe, it, expect } from 'vitest';
import { inspectPage, snapshotVisibility, contrastRatio, parseColor, effectiveBackground, createInspectorMeasure } from '../src/repair/inspect.js';
import { buildFallbackCss } from '../src/repair/fallbacks.js';
import { runRepairLoop, trimCssForReport } from '../src/repair/loop.js';
import { validateCss } from '../src/validate.js';

// ---- synthetic geometry helpers (jsdom has no layout) ----
const box = (x, y, w, h) => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h });
const BASE_STYLE = { display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0, 0, 0)', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', backgroundRepeat: 'repeat', backgroundPosition: '0% 0%', backgroundSize: 'auto', fontSize: '16px', fontWeight: '400', paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px', borderLeftWidth: '0px', overflow: 'visible', overflowX: 'visible', overflowY: 'visible', whiteSpace: 'normal', position: 'static', float: 'none' };

function fakeMeasure({ rects = {}, styles = {}, textRects = {}, scrolls = {}, vars = {}, natural = {} } = {}) {
  const find = (map, el) => {
    for (const [sel, v] of Object.entries(map)) {
      try {
        if (el.matches && el.matches(sel)) return v;
      } catch {
        /* ignore */
      }
    }
    return undefined;
  };
  return {
    rect: (el) => {
      const r = find(rects, el);
      if (r) return box(...r);
      if (el.localName === 'html' || el.localName === 'body') return box(0, 0, 1280, 2000);
      // distinct, non-overlapping default boxes in document order
      const idx = [...el.ownerDocument.querySelectorAll('*')].indexOf(el);
      return box(10, 10 + idx * 30, 100, 20);
    },
    style: (el) => ({ ...BASE_STYLE, ...(find(styles, el) || {}) }),
    textRect: (el) => {
      const r = find(textRects, el);
      if (r) return box(...r);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length >= 2);
      if (!own) return null;
      const b = find(rects, el);
      if (b) return box(b[0] + 4, b[1] + 4, Math.max(10, b[2] - 8), Math.max(8, b[3] - 8));
      const idx = [...el.ownerDocument.querySelectorAll('*')].indexOf(el);
      return box(14, 14 + idx * 30, 92, 12);
    },
    scroll: (el) => find(scrolls, el) || { scrollWidth: 1280, scrollHeight: 2000, clientWidth: 1280, clientHeight: 800 },
    naturalSize: (img) => find(natural, img) || { w: 16, h: 16, complete: true },
    viewport: { width: 1280, height: 800 },
    propertyValue: (name) => (name in vars ? vars[name] : 'url("data:x")'),
  };
}

const types = (r) => r.issues.map((i) => i.type);

describe('inspectPage', () => {
  it('reports no issues on a clean page', () => {
    document.body.innerHTML = '<main><p>Hello there, a tidy paragraph.</p></main>';
    const r = inspectPage(document, { measure: fakeMeasure() });
    expect(r.issues).toEqual([]);
    expect(r.text).toBe('no issues');
  });
  it('detects horizontal overflow and the offending element', () => {
    document.body.innerHTML = '<main><div class="wide">wide content here</div></main>';
    const r = inspectPage(document, { measure: fakeMeasure({ scrolls: { html: { scrollWidth: 1600, clientWidth: 1280, scrollHeight: 1, clientHeight: 1 } }, rects: { '.wide': [0, 0, 1600, 40] }, textRects: { '.wide': [8, 10, 200, 14] } }) });
    expect(types(r)).toEqual(['overflow-x', 'overflow-x']);
    expect(r.issues[1].selector).toBe('div.wide');
    expect(r.text).toContain('overflow-x: html | page scrolls horizontally: content 1600px, viewport 1280px');
  });
  it('detects off-center icons in buttons and next to text', () => {
    document.body.innerHTML = '<button class="search-btn"><svg></svg></button><a class="nav-link"><svg></svg>Home</a>';
    const r = inspectPage(document, {
      measure: fakeMeasure({
        rects: { 'button.search-btn': [100, 100, 40, 40], 'button.search-btn > svg': [117, 109, 16, 16], 'a.nav-link': [200, 100, 80, 24], 'a.nav-link > svg': [204, 100, 16, 16] },
        textRects: { 'a.nav-link': [224, 106, 50, 12] },
      }),
    });
    expect(types(r)).toEqual(['icon-off-center', 'icon-off-center']);
    expect(r.issues[0].detail).toBe('offset x=+5px y=-3px from the center of button.search-btn');
    expect(r.issues[1].detail).toContain('-4px below text center');
  });
  it('accepts icons within tolerance', () => {
    document.body.innerHTML = '<button class="ok"><svg></svg></button>';
    const r = inspectPage(document, { measure: fakeMeasure({ rects: { 'button.ok': [100, 100, 40, 40], 'button.ok > svg': [113, 113, 16, 16] } }) });
    expect(r.issues).toEqual([]);
  });
  it('detects background icons misaligned with text', () => {
    document.body.innerHTML = '<nav><a class="item">Archive</a></nav>';
    const r = inspectPage(document, {
      measure: fakeMeasure({
        rects: { 'a.item': [0, 0, 100, 40] },
        textRects: { 'a.item': [24, 14, 60, 12] },
        styles: { 'a.item': { backgroundImage: 'url("data:x")', backgroundRepeat: 'no-repeat', backgroundPosition: '4px 0px', backgroundSize: '16px 16px', paddingLeft: '24px' } },
      }),
    });
    expect(types(r)).toEqual(['icon-off-center']);
    expect(r.issues[0].background).toBe(true);
    expect(r.issues[0].dy).toBe(-12);
  });
  it('detects missing icons: undefined vars, zero-size svgs, broken images', () => {
    document.body.innerHTML = '<a class="cart"><svg></svg></a><img class="logo" src="x.png">';
    const r = inspectPage(document, {
      iconVars: ['--icon-zebra', '--icon-home'],
      measure: fakeMeasure({ rects: { 'a.cart': [0, 0, 40, 20], 'a.cart > svg': [0, 0, 0, 0], 'img.logo': [100, 0, 32, 32] }, vars: { '--icon-zebra': '', '--icon-home': 'url(x)' }, natural: { 'img.logo': { w: 0, h: 0, complete: true } } }),
    });
    expect(types(r)).toEqual(['icon-missing', 'icon-missing', 'icon-missing']);
    expect(r.issues.map((i) => i.selector)).toEqual(['svg', '--icon-zebra', 'img.logo']);
  });
  it('detects clipped text and overlapping siblings', () => {
    document.body.innerHTML = '<div class="box">Some long text that is clipped</div><p class="para-a">first paragraph</p><p class="para-b">second paragraph</p>';
    const r = inspectPage(document, {
      measure: fakeMeasure({
        styles: { '.box': { overflow: 'hidden', overflowX: 'hidden', overflowY: 'hidden' } },
        scrolls: { '.box': { scrollWidth: 480, clientWidth: 320, scrollHeight: 20, clientHeight: 20 } },
        rects: { '.box': [0, 0, 320, 20], 'p.para-a': [0, 100, 300, 40], 'p.para-b': [0, 120, 300, 40] },
      }),
    });
    expect(types(r)).toEqual(['text-clipped', 'overlap']);
    expect(r.issues[0].detail).toBe('content 480px wide in a 320px box (overflow hidden)');
    expect(r.issues[1].detail).toBe('overlaps its next sibling p.para-b by 300x20px');
  });
  it('detects low contrast and tiny fonts, grouped by pattern', () => {
    document.body.innerHTML = '<div class="meta"><span class="dim">one</span><span class="dim">two</span></div><p class="tiny">tiny text</p>';
    const r = inspectPage(document, {
      measure: fakeMeasure({ styles: { '.meta': { backgroundColor: 'rgb(136, 136, 136)' }, '.dim': { color: 'rgb(119, 119, 119)' }, '.tiny': { fontSize: '9px' } } }),
    });
    expect(types(r)).toEqual(['contrast-low', 'font-too-small']);
    expect(r.issues[0].detail).toMatch(/^1\.\d:1 \(#777777 on #888888\), needs 4\.5:1 ×2$/);
    expect(r.issues[1].detail).toBe('9px (minimum 11px)');
  });
  it('skips contrast checks when the background is an image', () => {
    document.body.innerHTML = '<div class="hero"><p class="dim">text on image</p></div>';
    const r = inspectPage(document, { measure: fakeMeasure({ styles: { '.hero': { backgroundImage: 'url(x)' }, '.dim': { color: 'rgb(119,119,119)' } } }) });
    expect(r.issues).toEqual([]);
  });
  it('detects invisible important elements against a baseline', () => {
    document.body.innerHTML = '<nav><a class="hidden-now">Home</a><a class="still">About</a></nav>';
    const before = snapshotVisibility(document, fakeMeasure());
    expect([...before.values()]).toEqual([true, true]);
    const r = inspectPage(document, { baseline: before, measure: fakeMeasure({ styles: { '.hidden-now': { display: 'none' } } }) });
    expect(types(r)).toEqual(['invisible']);
    expect(r.issues[0].detail).toBe('was visible before the design, now display:none');
  });
  it('detects edge-touching text, inconsistent spacing and collapsed padding', () => {
    document.body.innerHTML = '<ul class="list"><li>one</li><li>two</li><li>three</li><li>four</li></ul><a class="btn">Go</a><p class="edge">edge text</p>';
    const lis = [...document.querySelectorAll('li')];
    const rects = { 'li:nth-child(1)': [20, 0, 200, 20], 'li:nth-child(2)': [20, 22, 200, 20], 'li:nth-child(3)': [20, 70, 200, 20], 'li:nth-child(4)': [20, 92, 200, 20], 'a.btn': [300, 0, 60, 20], 'p.edge': [0, 300, 400, 20] };
    void lis;
    const r = inspectPage(document, { measure: fakeMeasure({ rects, textRects: { 'p.edge': [0, 304, 300, 12] }, styles: { 'a.btn': { backgroundColor: 'rgb(192,192,192)' } } }) });
    expect(types(r).sort()).toEqual(['edge-touch', 'padding-collapsed', 'spacing-inconsistent']);
    expect(r.issues.find((i) => i.type === 'spacing-inconsistent').detail).toBe('vertical gaps between 4 li children vary 2px..28px');
  });
  it('orders by severity, caps the list and keeps the text under budget', () => {
    document.body.innerHTML = Array.from({ length: 40 }, (_, i) => `<p class="t${i}x">tiny ${i}</p>`).join('');
    const r = inspectPage(document, { maxIssues: 5, tokenBudget: 60, measure: fakeMeasure({ styles: { p: { fontSize: '8px' } }, scrolls: { html: { scrollWidth: 2000, clientWidth: 1280 } } }) });
    expect(r.issues.length).toBe(5);
    expect(r.issues[0].type).toBe('overflow-x');
    expect(r.text.split('\n').length).toBeLessThanOrEqual(6);
  });
});

describe('color helpers', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio(parseColor('#000'), parseColor('#fff'))).toBeCloseTo(21, 1);
    expect(contrastRatio(parseColor('rgb(119,119,119)'), parseColor('#888')).toFixed(2)).toBe('1.26');
  });
  it('blends translucent backgrounds up the tree', () => {
    document.body.innerHTML = '<div class="outer"><div class="inner"><span class="t">x</span></div></div>';
    const M = createInspectorMeasure(document, fakeMeasure({ styles: { '.outer': { backgroundColor: 'rgb(0, 0, 0)' }, '.inner': { backgroundColor: 'rgba(255, 255, 255, 0.5)' } } }));
    const bg = effectiveBackground(document.querySelector('.t'), M);
    expect(Math.round(bg.r)).toBe(128);
  });
});

describe('buildFallbackCss', () => {
  it('produces a validated fix for every issue type', () => {
    document.body.innerHTML = '<nav class="n"><a class="x"><svg></svg>Home</a></nav><button class="b"><svg></svg></button><p class="c">c</p><div class="d">d</div><ul class="e"><li>1</li><li>2</li><li>3</li></ul><img class="i" src="x">';
    const issues = [
      { type: 'icon-off-center', selector: 'button.b > svg', detail: '' },
      { type: 'icon-off-center', selector: 'a.x', detail: '', background: true },
      { type: 'icon-missing', selector: '--icon-zebra', detail: 'variable' },
      { type: 'icon-missing', selector: 'button.b > svg', detail: 'zero-size icon' },
      { type: 'icon-missing', selector: 'img.i', detail: 'broken image' },
      { type: 'overflow-x', selector: 'html', detail: '' },
      { type: 'overflow-x', selector: 'div.d', detail: '' },
      { type: 'text-clipped', selector: 'p.c', detail: '' },
      { type: 'overlap', selector: 'p.c', detail: '' },
      { type: 'contrast-low', selector: 'p.c', detail: '', bg: '#222222' },
      { type: 'font-too-small', selector: 'p.c', detail: '' },
      { type: 'invisible', selector: 'a.x', detail: '' },
      { type: 'edge-touch', selector: 'p.c', detail: '' },
      { type: 'spacing-inconsistent', selector: 'ul.e', detail: '', axis: 'y' },
      { type: 'padding-collapsed', selector: 'a.x', detail: '' },
      { type: 'padding-excessive', selector: 'div.d', detail: '' },
    ];
    const fb = buildFallbackCss(issues, { doc: document });
    expect(fb.fixed).toHaveLength(issues.length + 1); // off-center svg adds a container rule too
    expect(fb.css).toContain('button.b { display: inline-flex; align-items: center;');
    expect(fb.css).toContain(':root { --icon-zebra: var(--icon-placeholder); }');
    expect(fb.css).toContain('p.c { color: #ffffff; text-shadow: none; }');
    expect(buildFallbackCss([{ type: 'contrast-low', selector: 'p.c', detail: '', bg: '#ee3333' }], { doc: document }).css).toContain('color: #000000');
    expect(fb.css).toContain('a.x { display: inline-block; visibility: visible;');
    const v = validateCss(fb.css, { doc: document, mode: 'patch' });
    expect(v.kept).toBeGreaterThanOrEqual(15);
    expect(v.dropped.filter((d) => d.reason !== 'no-match')).toEqual([]);
  });
});

describe('runRepairLoop', () => {
  it('runs model rounds until clean and records them', async () => {
    document.body.innerHTML = '<p class="tiny">tiny text</p>';
    let round = 0;
    const inspect = () => (round === 0 ? { issues: [{ type: 'font-too-small', selector: 'p.tiny', detail: '8px', severity: 1 }], total: 1, counts: { 'font-too-small': 1 }, text: 'font-too-small: p.tiny | 8px' } : { issues: [], total: 0, counts: {}, text: 'no issues' });
    const patcher = async ({ reportText }) => {
      expect(reportText).toContain('p.tiny');
      round++;
      return { css: 'p.tiny { font-size: 12px !important; }', kept: 1, dropped: [] };
    };
    const slots = { patch: { set: (css) => (slots.patchCss = css) }, fallback: { set: (css) => (slots.fallbackCss = css) } };
    const r = await runRepairLoop({ client: {}, doc: document, designCss: 'p { color: red }', style: { name: 'x' }, settings: { maxRepairRounds: 3 }, slots, inspect, patcher, settleMs: 0 });
    expect(r.report.rounds).toEqual([{ round: 1, before: 1, after: 0, kept: 1, dropped: 0 }]);
    expect(r.patchCss).toContain('p.tiny');
    expect(r.fallbackCss).toBe('');
    expect(r.remaining).toBe(0);
  });
  it('applies deterministic fallbacks for what the model could not fix', async () => {
    document.body.innerHTML = '<p class="tiny">tiny text</p>';
    const inspect = () => ({ issues: [{ type: 'font-too-small', selector: 'p.tiny', detail: '8px', severity: 1 }], total: 1, counts: {}, text: 'font-too-small: p.tiny | 8px' });
    const patcher = async () => ({ css: '', kept: 0, dropped: [] });
    const slots = { patch: { set() {} }, fallback: { set() {} } };
    const r = await runRepairLoop({ client: {}, doc: document, designCss: '', style: null, settings: { maxRepairRounds: 2 }, slots, inspect, patcher, settleMs: 0 });
    expect(r.report.rounds).toHaveLength(1); // stops early when the model returns nothing
    expect(r.fallbackCss).toBe('p.tiny { font-size: 12px !important; }');
    expect(r.report.fixedByFallback).toEqual([{ type: 'font-too-small', selector: 'p.tiny' }]);
  });
  it('skips the model with zero rounds but still applies fallbacks', async () => {
    document.body.innerHTML = '<p class="tiny">tiny text</p>';
    const inspect = () => ({ issues: [{ type: 'edge-touch', selector: 'p.tiny', detail: '', severity: 1 }], total: 1, counts: {}, text: 'x' });
    let called = false;
    const r = await runRepairLoop({ client: {}, doc: document, designCss: '', style: null, settings: { maxRepairRounds: 0 }, inspect, patcher: async () => (called = true), settleMs: 0 });
    expect(called).toBe(false);
    expect(r.fallbackCss).toContain('padding-left: 8px');
  });
  it('trims CSS to the rules relevant to the report when over budget', () => {
    const css = Array.from({ length: 200 }, (_, i) => `.rule-${i} { color: red; margin: ${i}px; }`).join('\n') + '\nnav a.special { color: blue; }';
    const out = trimCssForReport(css, [{ selector: 'nav a.special' }], 100);
    expect(out).toContain('nav a.special');
    expect(out.split('\n').length).toBeLessThan(30);
  });
});
