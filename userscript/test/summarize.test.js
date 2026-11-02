import { describe, it, expect } from 'vitest';
import { summarizePage, uniqueSelector, isStableToken, rgbToHex, renderSummary } from '../src/summarize.js';
import { estimateTokens } from '../src/assets/index.js';

const PAGE = `
<header id="site-header"><a class="logo" href="/"><img src="l.png" width="32" height="32"></a>
<nav class="main-nav"><a href="/">Home</a><a href="/shop">Shop</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
<form role="search"><input type="search"><button class="btn search-btn"><svg width="16" height="16"></svg></button></form></header>
<main id="content"><h1>Welcome to the site</h1><h2>Latest</h2><h2>Popular</h2>
<article class="post"><p>One paragraph.</p><p>Two paragraphs.</p><p>Three.</p><p>Four.</p><p>Five.</p><p>Six.</p><p>Seven.</p><p>Eight.</p></article>
<aside class="sidebar"><ul><li class="widget">A</li><li class="widget">B</li><li class="widget">C</li></ul></aside></main>
<footer class="site-footer"><p>© 2000</p></footer>`;

// jsdom has no layout; give the summarizer synthetic geometry.
const rects = {
  'site-header': [0, 0, 1280, 64],
  content: [0, 64, 1280, 900],
  post: [0, 64, 860, 900],
  sidebar: [900, 64, 380, 900],
};
function rect(el) {
  const key = el.id || [...el.classList][0];
  const r = rects[key] || (el.localName === 'html' || el.localName === 'body' ? [0, 0, 1280, 1000] : el.localName === 'img' || el.localName === 'svg' ? [10, 10, 16, 16] : [10, 10, 100, 20]);
  return { left: r[0], top: r[1], width: r[2], height: r[3], right: r[0] + r[2], bottom: r[1] + r[3] };
}

function build() {
  document.body.innerHTML = PAGE;
  return summarizePage(document, { rect, layoutAvailable: true, viewport: { width: 1280, height: 800 } });
}

describe('summarizePage', () => {
  it('finds landmarks with stable selectors', () => {
    const { data } = build();
    const roles = data.landmarks.map((l) => l.role);
    expect(roles).toEqual(expect.arrayContaining(['header', 'nav', 'main', 'sidebar', 'footer', 'search']));
    expect(data.landmarks.find((l) => l.role === 'header').selector).toBe('#site-header');
    expect(data.landmarks.find((l) => l.role === 'nav').selector).toBe('nav.main-nav');
    expect(data.landmarks.find((l) => l.role === 'nav').links).toBe(4);
  });
  it('guesses the page type and counts elements', () => {
    const { data } = build();
    expect(data.pageType).toBe('article');
    expect(data.counts.links).toBe(5);
    expect(data.counts.buttons).toBe(1);
    expect(data.h1).toBe('Welcome to the site');
    expect(data.h2).toEqual(['Latest', 'Popular']);
  });
  it('detects columns from geometry', () => {
    const { data } = build();
    expect(data.columns).toBeTruthy();
    expect(data.columns.parts.map((p) => p.selector)).toEqual(['article.post', 'aside.sidebar']);
  });
  it('reports icon containers and prominent classes', () => {
    const { data, text } = build();
    expect(data.icons.count).toBe(2);
    expect(data.icons.parents.map((p) => p.selector)).toEqual(expect.arrayContaining(['a.logo', 'button.btn.search-btn']));
    expect(data.classes.find((c) => c.name === 'widget').count).toBe(3);
    expect(text).toContain('LANDMARKS:');
    expect(text).toContain('CLASSES:');
  });
  it('stays under the token budget', () => {
    document.body.innerHTML = PAGE + '<div>' + Array.from({ length: 300 }, (_, i) => `<p class="c${i}x" id="id-${i}-a">x</p>`).join('') + '</div>';
    const { text } = summarizePage(document, { rect, layoutAvailable: true, tokenBudget: 300 });
    expect(estimateTokens(text)).toBeLessThanOrEqual(300);
    const big = summarizePage(document, { rect, layoutAvailable: true, tokenBudget: 1500 });
    expect(estimateTokens(big.text)).toBeLessThanOrEqual(1500);
  });
  it('works without layout information (jsdom default)', () => {
    document.body.innerHTML = PAGE;
    const { data, text } = summarizePage(document);
    expect(data.landmarks.length).toBeGreaterThan(3);
    expect(data.columns).toBeNull();
    expect(text).toContain('single column');
  });
});

describe('helpers', () => {
  it('rejects random-looking class tokens', () => {
    expect(isStableToken('main-nav')).toBe(true);
    expect(isStableToken('css-1x2y3z')).toBe(false);
    expect(isStableToken('sc-bdVaJa')).toBe(false);
    expect(isStableToken('Button__root___a1b2c3d4')).toBe(false);
    expect(isStableToken('x')).toBe(false);
    expect(isStableToken('col-md-6')).toBe(true);
  });
  it('converts colors to hex', () => {
    expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(rgbToHex('rgba(0, 0, 0, 0)')).toBeNull();
    expect(rgbToHex('#abc')).toBe('#aabbcc');
    expect(rgbToHex('transparent')).toBeNull();
  });
  it('builds unique selectors', () => {
    document.body.innerHTML = '<div id="list-a"><ul><li>1</li><li>2</li></ul></div><div class="css-123abc"><p>x</p><p>y</p></div>';
    const lis = document.querySelectorAll('li');
    const liSel = uniqueSelector(lis[1], document);
    expect(liSel).toBe('li:nth-of-type(2)');
    expect(document.querySelector(liSel)).toBe(lis[1]);
    document.body.insertAdjacentHTML('beforeend', '<ul><li>3</li><li>4</li></ul>');
    expect(uniqueSelector(lis[1], document)).toBe('#list-a > ul > li:nth-of-type(2)');
    const ps = document.querySelectorAll('p');
    const sel = uniqueSelector(ps[1], document);
    expect(document.querySelectorAll(sel)).toHaveLength(1);
    expect(document.querySelector(sel)).toBe(ps[1]);
  });
  it('renderSummary shrinks lists to fit', () => {
    const data = {
      title: 't', pageType: 'generic', counts: { links: 0, paragraphs: 0, headings: 0, images: 0, svgs: 0, buttons: 0, inputs: 0, forms: 0, tables: 0, lists: 0 },
      landmarks: [], columns: null, flexGridContainers: 0, colors: { bg: '#fff', text: '#000', accents: [] }, fonts: {}, icons: { count: 0, parents: [] }, bigImages: [], buttons: [], navLinkSelectors: [],
      classes: Array.from({ length: 30 }, (_, i) => ({ name: 'class-name-' + i, count: 1, tag: 'div' })), ids: [], h1: null, h2: [],
    };
    const t = renderSummary(data, 120);
    expect(estimateTokens(t)).toBeLessThanOrEqual(120);
  });
});
