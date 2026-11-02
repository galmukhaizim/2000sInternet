// Page summarizer: turns the live DOM into a compact text description for the
// designer model (page type, landmarks + selectors, prominent classes/ids,
// colors, fonts, layout, where icons/images/buttons live) under a token budget.
//
// Pure function of `doc` (+ optional measurement overrides) so it runs in the
// userscript, in jsdom tests and inside Playwright for the training scraper.
import { estimateTokens } from './assets/index.js';

const MAX_ELEMENTS = 4000;
const RANDOM_TOKEN = /(^|[-_])[0-9a-f]{5,}($|[-_])|^(css|sc|jss|emotion|chakra|svelte)-[a-zA-Z0-9]+$|^_[a-zA-Z0-9_]+$|[0-9]{3,}|^[a-zA-Z0-9]{1,2}$|__[a-zA-Z0-9]{6,}$|^[a-z]{1,2}[0-9]{2,}$|^[A-Za-z0-9+/=]{12,}$/;
const LANDMARKS = [
  ['header', 'header, [role=banner], #header, .header, #masthead, .masthead, .site-header, .topbar, .top-bar', 1],
  ['nav', 'nav, [role=navigation], #nav, .nav, .navbar, .menu, #menu, .main-nav, .navigation, .main-menu', 3],
  ['main', 'main, [role=main], #main, #content, .content, .main, #primary, article, .post, .page-content', 1],
  ['sidebar', 'aside, [role=complementary], #sidebar, .sidebar, .side, .widget-area, .rail', 2],
  ['footer', 'footer, [role=contentinfo], #footer, .footer, .site-footer', 1],
  ['search', 'form[role=search], input[type=search], .search-form, #search, .search', 1],
];
const LANDMARK_TAGS = new Set(['html', 'body', 'main', 'nav', 'header', 'footer', 'aside', 'article']);

export function isStableToken(t) {
  return typeof t === 'string' && t.length > 0 && t.length <= 40 && /^[a-zA-Z][\w-]*$/.test(t) && !RANDOM_TOKEN.test(t);
}

export function cssEscape(s) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return String(s).replace(/([^\w-])/g, '\\$1');
}

export function rgbToHex(color) {
  if (!color || typeof color !== 'string') return null;
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return null;
  if (/^#[0-9a-f]{3,8}$/.test(c)) return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7);
  const m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(c);
  if (!m) return null;
  const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  if (a === 0) return null;
  const h = (n) => Math.max(0, Math.min(255, Math.round(parseFloat(n)))).toString(16).padStart(2, '0');
  return '#' + h(m[1]) + h(m[2]) + h(m[3]);
}

function firstFont(ff) {
  if (!ff) return null;
  const f = ff.split(',')[0].trim().replace(/^["']|["']$/g, '');
  return f || null;
}

function trunc(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function createMeasure(doc, options = {}) {
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  const rect = options.rect || ((el) => el.getBoundingClientRect());
  const style = options.style || ((el, pseudo) => (win ? win.getComputedStyle(el, pseudo || null) : {}));
  let layout = options.layoutAvailable;
  if (layout == null) {
    try {
      const r = rect(doc.documentElement);
      layout = r.width > 0 || r.height > 0;
    } catch {
      layout = false;
    }
  }
  const viewport = options.viewport || { width: win ? win.innerWidth : 1280, height: win ? win.innerHeight : 800 };
  return {
    rect,
    style,
    layout,
    viewport,
    isVisible(el) {
      if (!layout) return true;
      try {
        const s = style(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = rect(el);
        return r.width > 0 && r.height > 0;
      } catch {
        return false;
      }
    },
  };
}

// Stable, unique-ish selector for an element. Prefers ids, then tag.class,
// then a short ancestor path with :nth-of-type where needed.
export function uniqueSelector(el, doc, maxDepth = 4) {
  doc = doc || el.ownerDocument;
  const count = (sel) => {
    try {
      return doc.querySelectorAll(sel).length;
    } catch {
      return -1;
    }
  };
  const seg = (node, nth) => {
    let s = node.localName;
    if (/[A-Z]/.test(s)) s = cssEscape(s);
    const classes = [...(node.classList || [])].filter(isStableToken).slice(0, 2);
    s += classes.map((c) => '.' + cssEscape(c)).join('');
    if (nth) {
      let n = 1;
      let p = node.previousElementSibling;
      while (p) {
        if (p.localName === node.localName) n++;
        p = p.previousElementSibling;
      }
      s += `:nth-of-type(${n})`;
    }
    return s;
  };
  // Drop :nth-of-type() pieces that are not needed for uniqueness.
  const simplify = (arr) => {
    const out = [...arr];
    for (let k = 0; k < out.length; k++) {
      if (!out[k].includes(':nth-of-type(')) continue;
      const trial = [...out];
      trial[k] = out[k].replace(/:nth-of-type\(\d+\)/, '');
      if (count(trial.join(' > ')) === 1) out[k] = trial[k];
    }
    return out.join(' > ');
  };
  const parts = [];
  let cur = el;
  for (let depth = 0; depth <= maxDepth && cur && cur.nodeType === 1 && cur !== doc.documentElement; depth++) {
    if (cur.id && isStableToken(cur.id) && count('#' + cssEscape(cur.id)) === 1) {
      parts.unshift('#' + cssEscape(cur.id));
      const s = parts.join(' > ');
      if (count(s) === 1) return simplify(parts);
      break;
    }
    parts.unshift(seg(cur, false));
    let s = parts.join(' > ');
    if (count(s) === 1) return simplify(parts);
    parts[0] = seg(cur, true);
    s = parts.join(' > ');
    if (count(s) === 1) return simplify(parts);
    cur = cur.parentElement;
  }
  if (cur === doc.documentElement || (cur && cur.localName === 'body')) parts.unshift('body');
  return parts.join(' > ');
}

// Short "pattern" selector describing a kind of element (not unique): tag + classes.
export function patternSelector(el) {
  const own = (node) => {
    let s = node.localName;
    const classes = [...(node.classList || [])].filter(isStableToken).slice(0, 2);
    if (classes.length) return s + classes.map((c) => '.' + cssEscape(c)).join('');
    if (node.id && isStableToken(node.id)) return '#' + cssEscape(node.id);
    return null;
  };
  const self = own(el);
  if (self) return self;
  let p = el.parentElement;
  for (let i = 0; i < 3 && p && p.localName !== 'body'; i++, p = p.parentElement) {
    const ps = own(p);
    if (ps) return `${ps} ${el.localName}`;
  }
  return el.localName;
}

function guessPageType(doc, counts, text) {
  const has = (sel) => {
    try {
      return !!doc.querySelector(sel);
    } catch {
      return false;
    }
  };
  if (has('input[type=password]')) return 'login or signup';
  if (counts.article >= 1 && counts.p >= 8) return 'article';
  if (/[$€£]\s?\d|\badd to (cart|bag|basket)\b|\bcheckout\b/i.test(text) && counts.img >= 6) return 'shop';
  if (counts.video >= 1 || has('audio')) return 'media';
  if (counts.table >= 2 && counts.tr >= 20) return 'data tables';
  if (counts.form >= 1 && counts.input >= 5) return 'form';
  if (counts.a >= 80 && counts.p < 10) return 'portal or directory';
  if (counts.h2 >= 6 && counts.a >= 30) return 'listing or feed';
  if (counts.pre >= 3 || counts.code >= 10) return 'documentation';
  if (counts.p >= 4) return 'content page';
  return 'generic';
}

export function summarizePage(doc = document, options = {}) {
  const tokenBudget = options.tokenBudget || 1500;
  const M = createMeasure(doc, options);
  const body = doc.body || doc.documentElement;
  const all = [...doc.querySelectorAll('*')].filter((e) => !e.closest('retro-web-panel')).slice(0, MAX_ELEMENTS);
  const visible = all.filter((e) => M.isVisible(e));

  // ---- counts ----
  const counts = {};
  for (const e of visible) counts[e.localName] = (counts[e.localName] || 0) + 1;
  const n = (t) => counts[t] || 0;
  for (const t of ['a', 'p', 'img', 'svg', 'button', 'input', 'form', 'table', 'tr', 'video', 'article', 'h1', 'h2', 'h3', 'pre', 'code', 'ul', 'li', 'select', 'textarea']) counts[t] = n(t);

  const text = (body.innerText != null ? body.innerText : body.textContent || '').slice(0, 20000);
  const pageType = guessPageType(doc, counts, text);

  // ---- landmarks ----
  const picked = [];
  const landmarks = [];
  for (const [role, sel, max] of LANDMARKS) {
    let cands = [];
    try {
      cands = [...doc.querySelectorAll(sel)];
    } catch {
      cands = [];
    }
    cands = cands.filter((e) => M.isVisible(e) && !picked.includes(e) && !e.closest('retro-web-panel'));
    if (M.layout) {
      cands.sort((a, b) => {
        const ra = M.rect(a);
        const rb = M.rect(b);
        return rb.width * rb.height - ra.width * ra.height;
      });
    }
    // drop candidates nested inside an already chosen candidate of the same role
    const chosen = [];
    for (const c of cands) {
      if (chosen.some((p) => p.contains(c) || c.contains(p))) continue;
      chosen.push(c);
      if (chosen.length >= max) break;
    }
    for (const el of chosen) {
      picked.push(el);
      const st = M.style(el);
      const r = M.layout ? M.rect(el) : null;
      const links = el.querySelectorAll('a').length;
      const imgs = el.querySelectorAll('img, svg').length;
      const btns = el.querySelectorAll('button, [role=button], input[type=submit]').length;
      landmarks.push({
        role,
        selector: uniqueSelector(el, doc),
        tag: el.localName,
        rect: r ? { x: Math.round(r.left), y: Math.round(r.top + (doc.defaultView ? doc.defaultView.scrollY || 0 : 0)), w: Math.round(r.width), h: Math.round(r.height) } : null,
        display: st.display,
        flexDirection: st.display && st.display.includes('flex') ? st.flexDirection : undefined,
        links,
        images: imgs,
        buttons: btns,
        children: el.children.length,
        textLength: (el.textContent || '').trim().length,
        bg: rgbToHex(st.backgroundColor),
        color: rgbToHex(st.color),
      });
    }
  }

  // Fallbacks for non-semantic markup (tables, divs with ids like #top).
  const have = (role) => landmarks.some((l) => l.role === role);
  const bodyText = (body.textContent || '').trim().length;
  const describe = (role, el) => {
    picked.push(el);
    const st = M.style(el);
    const r = M.layout ? M.rect(el) : null;
    landmarks.push({
      role,
      selector: uniqueSelector(el, doc),
      tag: el.localName,
      rect: r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null,
      display: st.display,
      flexDirection: st.display && st.display.includes('flex') ? st.flexDirection : undefined,
      links: el.querySelectorAll('a').length,
      images: el.querySelectorAll('img, svg').length,
      buttons: el.querySelectorAll('button, [role=button], input[type=submit]').length,
      children: el.children.length,
      textLength: (el.textContent || '').trim().length,
      bg: rgbToHex(st.backgroundColor),
      color: rgbToHex(st.color),
      inferred: true,
    });
  };
  if (M.layout && !have('nav')) {
    // a link-dense, text-light block near the top of the page
    let best = null;
    for (const e of visible) {
      if (picked.some((p) => p.contains(e))) continue;
      const r = M.rect(e);
      if (r.top > 240 || r.height > 160 || r.width < 200) continue;
      const links = e.querySelectorAll('a').length;
      const tl = (e.textContent || '').trim().length;
      if (links < 4 || tl > 400) continue;
      const score = links * 10 - tl / 20 - r.top / 10;
      if (!best || score > best.score) best = { e, score };
    }
    if (best) describe('nav', best.e);
  }
  if (M.layout && !have('header')) {
    const nav = landmarks.find((l) => l.role === 'nav');
    const navEl = nav ? doc.querySelector(nav.selector) : null;
    const cand = navEl && navEl.parentElement && navEl.parentElement !== body && M.rect(navEl.parentElement).height < 220 ? navEl.parentElement : null;
    if (cand) describe('header', cand);
  }
  if (!have('main')) {
    // deepest element holding most of the page text
    let cur = body;
    for (let i = 0; i < 12; i++) {
      const kids = [...cur.children].filter((k) => M.isVisible(k) && !['script', 'style', 'retro-web-panel'].includes(k.localName));
      const next = kids.find((k) => (k.textContent || '').trim().length >= bodyText * 0.6);
      if (!next) break;
      cur = next;
    }
    if (cur !== body && cur.children.length >= 2 && !picked.includes(cur)) describe('main', cur);
  }
  landmarks.sort((a, b) => ['header', 'nav', 'main', 'sidebar', 'footer', 'search'].indexOf(a.role) - ['header', 'nav', 'main', 'sidebar', 'footer', 'search'].indexOf(b.role));

  // ---- layout ----
  const vw = M.viewport.width;
  let columns = null;
  if (M.layout) {
    let best = null;
    const containers = visible.filter((e) => e.children.length >= 2 && e.children.length <= 12 && !['ul', 'ol', 'tr', 'table', 'select', 'svg'].includes(e.localName)).slice(0, 600);
    for (const c of containers) {
      const cr = M.rect(c);
      if (cr.width < vw * 0.5) continue;
      const kids = [...c.children].filter((k) => M.isVisible(k)).map((k) => ({ k, r: M.rect(k) })).filter((o) => o.r.width >= 120 && o.r.height >= 80);
      if (kids.length < 2) continue;
      const first = kids[0];
      const row = kids.filter((o) => Math.abs(o.r.top - first.r.top) < 60 && o.r.left >= first.r.left);
      const sorted = row.sort((a, b) => a.r.left - b.r.left);
      let ok = sorted.length >= 2;
      for (let i = 1; i < sorted.length && ok; i++) if (sorted[i].r.left < sorted[i - 1].r.right - 8) ok = false;
      if (ok && (!best || sorted.length > best.cols.length || (sorted.length === best.cols.length && cr.height > best.height))) best = { el: c, cols: sorted, height: cr.height };
    }
    if (best) {
      columns = {
        container: uniqueSelector(best.el, doc),
        parts: best.cols.map((o) => ({ selector: patternSelector(o.k), width: Math.round(o.r.width) })),
      };
    }
  }
  const flexGrid = visible.filter((e) => {
    const d = M.style(e).display || '';
    return d.includes('flex') || d.includes('grid');
  }).length;
  const docHeight = M.layout ? Math.round(Math.max(doc.documentElement.scrollHeight || 0, body.scrollHeight || 0)) : null;
  const bodyWidth = M.layout ? Math.round(M.rect(body).width) : null;

  // ---- classes / ids ----
  const classFreq = new Map();
  const idList = [];
  for (const e of visible) {
    for (const c of e.classList || []) {
      if (!isStableToken(c)) continue;
      const k = c;
      const v = classFreq.get(k) || { count: 0, tags: new Map() };
      v.count++;
      v.tags.set(e.localName, (v.tags.get(e.localName) || 0) + 1);
      classFreq.set(k, v);
    }
    if (e.id && isStableToken(e.id) && e.children.length >= 2 && idList.length < 40) idList.push({ id: e.id, tag: e.localName, children: e.children.length });
  }
  const classes = [...classFreq.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .map(([name, v]) => ({ name, count: v.count, tag: [...v.tags.entries()].sort((a, b) => b[1] - a[1])[0][0] }));
  const ids = idList.sort((a, b) => b.children - a.children).slice(0, 15);

  // ---- colors & fonts ----
  const bodyStyle = M.style(body);
  const htmlStyle = M.style(doc.documentElement);
  const colors = {
    bg: rgbToHex(bodyStyle.backgroundColor) || rgbToHex(htmlStyle.backgroundColor) || '#ffffff',
    text: rgbToHex(bodyStyle.color) || '#000000',
    link: null,
    headingColor: null,
    buttonBg: null,
    buttonText: null,
    accents: [],
  };
  const link = visible.find((e) => e.localName === 'a' && (e.textContent || '').trim());
  if (link) colors.link = rgbToHex(M.style(link).color);
  const h = visible.find((e) => /^h[1-3]$/.test(e.localName));
  if (h) colors.headingColor = rgbToHex(M.style(h).color);
  const btn = visible.find((e) => e.localName === 'button' || (e.localName === 'input' && e.type === 'submit') || e.getAttribute('role') === 'button');
  if (btn) {
    colors.buttonBg = rgbToHex(M.style(btn).backgroundColor);
    colors.buttonText = rgbToHex(M.style(btn).color);
  }
  const accentFreq = new Map();
  for (const e of visible.slice(0, 1500)) {
    const bg = rgbToHex(M.style(e).backgroundColor);
    if (bg && bg !== colors.bg && bg !== '#ffffff' && bg !== '#000000') accentFreq.set(bg, (accentFreq.get(bg) || 0) + 1);
  }
  colors.accents = [...accentFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  const fonts = {
    body: firstFont(bodyStyle.fontFamily),
    bodySize: bodyStyle.fontSize || null,
    heading: h ? firstFont(M.style(h).fontFamily) : null,
  };

  // ---- images / icons / buttons ----
  const smallImgs = [];
  const bigImgs = [];
  for (const e of visible) {
    if (e.localName !== 'img' && e.localName !== 'svg') continue;
    if (e.closest('svg') && e.localName !== 'svg') continue;
    const r = M.layout ? M.rect(e) : { width: e.width || 0, height: e.height || 0 };
    const size = Math.max(r.width, r.height);
    if (!M.layout || size <= 48) smallImgs.push(e);
    else bigImgs.push({ el: e, w: Math.round(r.width), h: Math.round(r.height) });
  }
  const groupBy = (els, f) => {
    const m = new Map();
    for (const e of els) {
      const k = f(e);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const iconParents = groupBy(smallImgs, (e) => {
    const p = e.closest('a, button, [role=button], li, label, span, div');
    return p ? patternSelector(p) : null;
  }).slice(0, 6);
  const buttonEls = visible.filter((e) => e.localName === 'button' || (e.localName === 'input' && ['submit', 'button'].includes(e.type)) || e.getAttribute('role') === 'button' || (e.localName === 'a' && /\b(btn|button|cta)\b/i.test(e.className || '')));
  const buttonGroups = groupBy(buttonEls, (e) => patternSelector(e)).slice(0, 6);
  const navLinks = landmarks.filter((l) => l.role === 'nav').map((l) => `${l.selector} a`);
  const inputs = visible.filter((e) => ['input', 'select', 'textarea'].includes(e.localName) && !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(e.type));

  // ---- headings ----
  const h1 = visible.find((e) => e.localName === 'h1');
  const h2s = visible.filter((e) => e.localName === 'h2').slice(0, 3);

  const data = {
    title: trunc(doc.title, 80),
    lang: doc.documentElement.lang || null,
    pageType,
    viewport: M.viewport,
    docHeight,
    bodyWidth,
    counts: { links: counts.a, paragraphs: counts.p, images: counts.img, svgs: counts.svg, buttons: buttonEls.length, inputs: inputs.length, forms: counts.form, tables: counts.table, lists: counts.ul, headings: counts.h1 + counts.h2 + counts.h3 },
    landmarks,
    columns,
    flexGridContainers: flexGrid,
    classes,
    ids,
    colors,
    fonts,
    icons: { count: smallImgs.length, parents: iconParents.map(([selector, count]) => ({ selector, count })) },
    bigImages: bigImgs.slice(0, 5).map((o) => ({ selector: patternSelector(o.el), w: o.w, h: o.h })),
    buttons: buttonGroups.map(([selector, count]) => ({ selector, count })),
    navLinkSelectors: navLinks,
    h1: h1 ? trunc(h1.textContent, 80) : null,
    h2: h2s.map((e) => trunc(e.textContent, 50)),
  };

  return { text: renderSummary(data, tokenBudget), data };
}

// Renders the structured data as prompt text, shrinking low-priority sections
// until the estimate fits the token budget.
export function renderSummary(d, tokenBudget = 1500) {
  const limits = { classes: 30, ids: 15, landmarks: 10, icons: 6, buttons: 6, h2: 3, accents: 5 };
  const build = () => {
    const L = [];
    L.push(`PAGE: "${d.title || '(untitled)'}" · type: ${d.pageType}${d.lang ? ' · lang ' + d.lang : ''}`);
    const lay = [];
    if (d.bodyWidth) lay.push(`body ${d.bodyWidth}px wide`);
    if (d.docHeight) lay.push(`${d.docHeight}px tall`);
    if (d.columns) lay.push(`${d.columns.parts.length} columns in ${d.columns.container}: ${d.columns.parts.map((p) => `${p.selector} ${p.width}px`).join(' + ')}`);
    else lay.push('single column');
    lay.push(`${d.flexGridContainers} flex/grid containers`);
    L.push('LAYOUT: ' + lay.join(' · '));
    const c = d.counts;
    L.push(`ELEMENTS: ${c.links} links, ${c.paragraphs} paragraphs, ${c.headings} headings, ${c.images} images, ${c.svgs} svgs, ${c.buttons} buttons, ${c.inputs} inputs, ${c.forms} forms, ${c.tables} tables, ${c.lists} lists`);
    if (d.landmarks.length) {
      L.push('LANDMARKS:');
      for (const l of d.landmarks.slice(0, limits.landmarks)) {
        const bits = [];
        if (l.rect) bits.push(`${l.rect.w}x${l.rect.h} at (${l.rect.x},${l.rect.y})`);
        if (l.display) bits.push(l.display + (l.flexDirection ? ' ' + l.flexDirection : ''));
        bits.push(`${l.links} links`);
        if (l.images) bits.push(`${l.images} img`);
        if (l.buttons) bits.push(`${l.buttons} btn`);
        if (l.bg || l.color) bits.push(`bg ${l.bg || 'none'} text ${l.color || '?'}`);
        L.push(`- ${l.role}: ${l.selector} | ${bits.join(', ')}`);
      }
    }
    const col = d.colors;
    const cols = [`bg ${col.bg}`, `text ${col.text}`];
    if (col.link) cols.push(`links ${col.link}`);
    if (col.headingColor && col.headingColor !== col.text) cols.push(`headings ${col.headingColor}`);
    if (col.buttonBg) cols.push(`buttons ${col.buttonBg}${col.buttonText ? '/' + col.buttonText : ''}`);
    if (col.accents.length) cols.push(`accents ${col.accents.slice(0, limits.accents).join(' ')}`);
    L.push('COLORS: ' + cols.join(', '));
    L.push(`FONTS: body ${d.fonts.body || '?'} ${d.fonts.bodySize || ''}${d.fonts.heading && d.fonts.heading !== d.fonts.body ? ', headings ' + d.fonts.heading : ''}`.trim());
    if (d.icons.count) L.push(`ICONS: ${d.icons.count} small images/svgs, inside: ${d.icons.parents.slice(0, limits.icons).map((p) => `${p.selector} (${p.count})`).join(', ')}`);
    if (d.bigImages.length) L.push(`IMAGES: ${d.bigImages.map((i) => `${i.selector} ${i.w}x${i.h}`).join(', ')}`);
    if (d.buttons.length) L.push(`BUTTONS: ${d.buttons.slice(0, limits.buttons).map((b) => `${b.selector} (${b.count})`).join(', ')}`);
    if (d.navLinkSelectors.length) L.push(`NAV LINKS: ${d.navLinkSelectors.join(', ')}`);
    if (d.classes.length) L.push(`CLASSES: ${d.classes.slice(0, limits.classes).map((k) => `.${k.name} (${k.count} ${k.tag})`).join(', ')}`);
    if (d.ids.length) L.push(`IDS: ${d.ids.slice(0, limits.ids).map((i) => `#${i.id} (${i.tag})`).join(', ')}`);
    if (d.h1) L.push(`H1: "${d.h1}"`);
    if (d.h2.length) L.push(`H2: ${d.h2.slice(0, limits.h2).map((t) => `"${t}"`).join(', ')}`);
    return L.join('\n');
  };
  let text = build();
  const order = ['h2', 'ids', 'classes', 'accents', 'buttons', 'icons', 'landmarks'];
  let guard = 0;
  while (estimateTokens(text) > tokenBudget && guard++ < 40) {
    let shrunk = false;
    for (const key of order) {
      if (limits[key] > 2) {
        limits[key] = Math.max(2, Math.floor(limits[key] * 0.6));
        shrunk = true;
        break;
      }
    }
    if (!shrunk) break;
    text = build();
  }
  const maxChars = tokenBudget * 4;
  if (text.length > maxChars) text = text.slice(0, maxChars - 1) + '…';
  return text;
}
