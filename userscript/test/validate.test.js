import { describe, it, expect, beforeEach } from 'vitest';
import { parseCss, validateCss, extractDirectives, validateApplyClass, probeSelector, splitSelectorList } from '../src/validate.js';

const PAGE = `
<header id="top"><nav class="main-nav"><a href="#">Home</a><a href="#">About</a></nav></header>
<main id="content"><h1>Title</h1><p class="lead">Hello world, this is a paragraph of text that is long enough.</p>
<button class="btn primary">Go</button><div class="deco"></div><span class="tiny">x</span></main>
<footer><p>footer</p></footer>
<retro-web-panel id="retro-web-panel"></retro-web-panel>`;

beforeEach(() => {
  document.body.innerHTML = PAGE;
});

describe('parseCss', () => {
  it('parses rules, declarations and !important', () => {
    const { rules, errors } = parseCss('a { color: red !important; background: url("x;y") } p{margin:0}');
    expect(errors).toEqual([]);
    expect(rules).toHaveLength(2);
    expect(rules[0].selector).toBe('a');
    expect(rules[0].declarations[0]).toEqual({ prop: 'color', value: 'red', important: true });
    expect(rules[0].declarations[1].value).toBe('url("x;y")');
  });
  it('reports malformed declarations and unclosed blocks', () => {
    const { rules, errors } = parseCss('a { color red; font-size: 12px } p { color: blue');
    expect(rules).toHaveLength(1);
    expect(rules[0].declarations).toHaveLength(1);
    expect(errors.map((e) => e.reason)).toEqual(['malformed-declaration', 'unclosed-block']);
  });
  it('parses nested at-rules and keyframes', () => {
    const { rules } = parseCss('@media (max-width: 600px) { nav a { display: block } } @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }');
    expect(rules[0].type).toBe('at');
    expect(rules[0].rules[0].selector).toBe('nav a');
    expect(rules[1].keyframes).toBe(true);
    expect(rules[1].rules).toHaveLength(2);
  });
  it('ignores comments inside blocks', () => {
    const { rules } = parseCss('a { /* note; } */ color: red }');
    expect(rules[0].declarations).toEqual([{ prop: 'color', value: 'red', important: false }]);
  });
});

describe('validateCss', () => {
  it('keeps matching selectors and forces !important', () => {
    const r = validateCss('nav a { color: #00f; text-decoration: underline }', { doc: document });
    expect(r.kept).toBe(1);
    expect(r.css).toBe('nav a { color: #00f !important; text-decoration: underline !important; }');
  });
  it('drops selectors that match nothing but keeps the matching part of a list', () => {
    const r = validateCss('.nope { color: red } nav a, .missing { color: blue }', { doc: document });
    expect(r.kept).toBe(1);
    expect(r.css).toContain('nav a {');
    expect(r.css).not.toContain('.missing');
    expect(r.dropped).toContainEqual({ selector: '.nope', reason: 'no-match' });
  });
  it('drops invalid selectors', () => {
    const r = validateCss('a[ { color: red }', { doc: document });
    expect(r.kept).toBe(0);
    expect(r.dropped[0].reason).toBe('invalid');
  });
  it('matches pseudo-element and state selectors through a probe', () => {
    const r = validateCss('nav a:hover::before { content: "★" } p.lead::first-letter { font-size: 2em }', { doc: document });
    expect(r.kept).toBe(2);
    expect(r.css).toContain('nav a:hover::before');
  });
  it('blocks @import, @charset and unknown at-rules', () => {
    const r = validateCss('@import url("https://evil.example/x.css"); @charset "utf-8"; @page { margin: 0 } nav a { color: red }', { doc: document });
    expect(r.kept).toBe(1);
    expect(r.dropped.map((d) => d.reason)).toEqual(['blocked-at-rule', 'blocked-at-rule', 'blocked-at-rule']);
  });
  it('blocks external url() but allows data: and fragment urls', () => {
    const r = validateCss('nav a { background-image: url(https://evil.example/a.png); color: red } main { background-image: url("data:image/svg+xml,%3Csvg%3E"); filter: url(#f) }', { doc: document });
    expect(r.dropped).toContainEqual({ selector: 'nav a', prop: 'background-image', reason: 'external-url' });
    expect(r.css).toContain('nav a { color: red !important; }');
    expect(r.css).toContain('background-image: url("data:image/svg+xml,%3Csvg%3E") !important');
    expect(r.css).toContain('filter: url(#f)');
  });
  it('blocks dangerous properties and values', () => {
    const r = validateCss('nav a { behavior: url(x.htc); width: expression(alert(1)); background: url(javascript:alert(1)); -moz-binding: url(a) ; color: red }', { doc: document });
    expect(r.css).toBe('nav a { color: red !important; }');
    expect(r.dropped.map((d) => d.reason).sort()).toEqual(['blocked-property', 'blocked-property', 'dangerous-value', 'dangerous-value']);
  });
  it('clamps absurd values', () => {
    const r = validateCss('p.lead { font-size: 400px; margin-top: -9999px; padding: 5000px 10px; z-index: 99999999999; opacity: 2; line-height: 0.1; border: 300px solid #ff0000 }', { doc: document });
    expect(r.css).toContain('font-size: 96px');
    expect(r.css).toContain('margin-top: -320px');
    expect(r.css).toContain('padding: 320px 10px');
    expect(r.css).toContain('z-index: 2147483000');
    expect(r.css).toContain('opacity: 1');
    expect(r.css).toContain('line-height: 0.9');
    expect(r.css).toContain('border: 40px solid #ff0000');
  });
  it('does not touch numbers inside colors, var() or url()', () => {
    const r = validateCss('p.lead { margin: 0 auto; color: rgb(255, 0, 0); background: var(--bg-tile-grid) ; box-shadow: 0 0 999px #123456 }', { doc: document });
    expect(r.css).toContain('rgb(255, 0, 0)');
    expect(r.css).toContain('var(--bg-tile-grid)');
    expect(r.css).toContain('#123456');
    expect(r.css).toContain('box-shadow: 0 0 60px');
  });
  it('refuses to hide content, landmarks, interactive elements or our panel', () => {
    const r = validateCss('main { display: none } nav a { visibility: hidden } body { opacity: 0 } #retro-web-panel { display: none } div.deco { display: none } span.tiny { display: none }', { doc: document });
    expect(r.css).toBe('div.deco { display: none !important; }\nspan.tiny { display: none !important; }');
    expect(r.dropped.find((d) => d.selector === 'main').reason).toBe('hides-content:display:none');
    expect(r.dropped.find((d) => d.selector === '#retro-web-panel').reason).toBe('protected');
  });
  it('blocks position:fixed on broad selectors', () => {
    const r = validateCss('* { position: fixed } main { position: fixed } button.btn { position: fixed }', { doc: document });
    expect(r.css).toBe('button.btn { position: fixed !important; }');
  });
  it('handles @media and @keyframes (no !important inside keyframes)', () => {
    const r = validateCss('@media (max-width: 700px) { nav a { display: block } .nope { x: y } } @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }', { doc: document });
    expect(r.css).toBe('@media (max-width: 700px) {\n  nav a { display: block !important; }\n}\n@keyframes spin {\n  from { transform: rotate(0deg); }\n  to { transform: rotate(360deg); }\n}');
  });
  it('collects var() usage and icon vars', () => {
    const r = validateCss('nav a { background-image: var(--icon-home); font-family: var(--font-comic) }', { doc: document });
    expect(r.iconVars).toEqual(['--icon-home']);
    expect(r.varsUsed.sort()).toEqual(['--font-comic', '--icon-home']);
  });
  it('drops rules with only malformed declarations', () => {
    const r = validateCss('nav a { color red }', { doc: document });
    expect(r.kept).toBe(0);
    expect(r.errors[0].reason).toBe('malformed-declaration');
  });
  it('rejects @font-face without a data: src', () => {
    const r = validateCss('@font-face { font-family: X; src: url(https://x/y.woff2) } @font-face { font-family: Y; src: url(data:font/woff2;base64,AAAA) }', { doc: document });
    expect(r.css).toBe('@font-face { font-family: Y; src: url(data:font/woff2;base64,AAAA); }');
  });
  it('works in patch mode on partial CSS and survives garbage', () => {
    const r = validateCss('Here is the fix:\n```css\nnav a { padding: 4px 8px }\n```\nHope this helps!', { doc: document, mode: 'patch' });
    expect(r.kept).toBe(1);
    expect(r.css).toContain('nav a { padding: 4px 8px !important; }');
  });
});

describe('extractDirectives', () => {
  it('extracts icon requests and apply-class directives and strips them from the CSS', () => {
    const t = '/* icon-request: shopping-bag | a paper shopping bag */\nnav a { color: red }\n/* apply-class: button.btn | retro-bevel-btn */\n/* icon-request: Shopping Bag | duplicate */';
    const d = extractDirectives(t);
    expect(d.iconRequests).toEqual([{ name: 'shopping-bag', description: 'a paper shopping bag' }]);
    expect(d.applyClass).toEqual([{ selector: 'button.btn', className: 'retro-bevel-btn' }]);
    expect(d.css.trim()).toBe('nav a { color: red }');
  });
});

describe('validateApplyClass', () => {
  it('applies only known classes to matching non-landmark elements', () => {
    const r = validateApplyClass(
      [
        { selector: 'button.btn', className: 'retro-bevel-btn' },
        { selector: 'button.btn', className: 'not-a-class' },
        { selector: '.missing', className: 'retro-bevel-btn' },
        { selector: 'body', className: 'retro-window' },
        { selector: '#retro-web-panel', className: 'retro-window' },
      ],
      { doc: document, classNames: ['retro-bevel-btn', 'retro-window'] },
    );
    expect(r.applied.map((a) => a.count)).toEqual([1]);
    expect(r.dropped.map((d) => d.reason)).toEqual(['unknown-class', 'no-match', 'protected', 'protected']);
  });
});

describe('selector helpers', () => {
  it('splits selector lists respecting parens and attribute brackets', () => {
    expect(splitSelectorList('a, :is(b, c) > d, [x="1,2"]')).toEqual(['a', ':is(b, c) > d', '[x="1,2"]']);
  });
  it('builds probe selectors', () => {
    expect(probeSelector('a:hover::after')).toBe('a');
    expect(probeSelector('::selection')).toBe('*');
    expect(probeSelector('li:nth-child(2n) > a:focus-visible')).toBe('li:nth-child(2n) > a');
  });
});

describe('layout guard rails (keep complex pages working)', () => {
  const APP = `
<header id="top"><nav class="main-nav">${Array.from({ length: 12 }, (_, i) => `<a href="#">L${i}</a>`).join('')}</nav></header>
<main id="content">
  <div class="player" id="player"><video src="x.mp4"></video></div>
  <div class="grid" style="display:flex">${Array.from({ length: 60 }, (_, i) => `<div class="card"><span class="scope">c${i}</span><a href="#">go</a></div>`).join('')}</div>
  <p class="lead">Hello world, a paragraph of text that is long enough to count.</p>
</main>`;
  const v = (css, opts = {}) => validateCss(css, { doc: document, ...opts });
  beforeEach(() => {
    document.body.innerHTML = APP;
  });
  it('lets broad selectors change cosmetics but not layout', () => {
    const r = v('div { background: #111; color: #0f0; border: 1px solid #0f0; display: block; padding: 40px; width: 100% }');
    expect(r.css).toContain('background: #111 !important');
    expect(r.css).toContain('border: 1px solid #0f0 !important');
    expect(r.css).not.toContain('display:');
    expect(r.css).not.toContain('width:');
    expect(r.css).toContain('padding: 24px !important'); // gently clamped on broad selectors
    expect(r.dropped.map((d) => d.reason).sort()).toEqual(['layout-too-broad', 'layout-too-broad']);
  });
  it('allows layout on specific selectors', () => {
    const r = v('nav.main-nav a { display: inline-block; padding: 4px 12px; margin-right: 6px } #content { max-width: 980px; margin: 0 auto; padding: 20px }');
    expect(r.kept).toBe(2);
    expect(r.css).toContain('display: inline-block !important');
    expect(r.css).toContain('max-width: 980px !important');
  });
  it('never resizes or hides media elements or their containers', () => {
    const r = v('video { width: 100px; height: 50px; border: 2px solid red; display: none } div.player { height: 0; display: block; overflow: hidden; background: #000 }');
    expect(r.css).toContain('video { border: 2px solid red !important; }');
    expect(r.css).toContain('div.player { background: #000 !important; }');
    expect(r.dropped.map((d) => d.reason)).toEqual(expect.arrayContaining(['media-element', 'media-container']));
  });
  it('does not convert flex/grid containers to block', () => {
    const r = v('div.grid { display: block; gap: 12px } div.grid { display: inline-flex }');
    expect(r.css).not.toContain('display: block');
    expect(r.css).toContain('display: inline-flex !important');
    expect(r.css).toContain('gap: 12px !important');
  });
  it('refuses display changes on html/body except block', () => {
    const r = v('body { display: grid; background: #ccc } html { display: block }');
    expect(r.css).toContain('body { background: #ccc !important; }');
    expect(r.css).toContain('html { display: block !important; }');
  });
  it('drops spacing on very broad selectors and tames font sizes', () => {
    document.body.innerHTML = APP + Array.from({ length: 200 }, () => '<span class="many">x</span>').join('');
    const r = v('span { padding: 8px; font-size: 40px; line-height: 3; border-width: 10px; color: #fff }');
    expect(r.css).not.toContain('padding');
    expect(r.css).toContain('font-size: 20px !important');
    expect(r.css).toContain('line-height: 1.8 !important');
    expect(r.css).toContain('border-width: 4px !important');
    expect(r.dropped[0].reason).toBe('spacing-too-broad');
  });
  it('allows content only on pseudo-elements', () => {
    const r = v('p.lead { content: "x"; color: red } p.lead::before { content: "★ " }');
    expect(r.css).toContain('p.lead { color: red !important; }');
    expect(r.css).toContain('p.lead::before { content: "★ " !important; }');
  });
});
