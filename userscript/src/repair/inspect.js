// Layout inspector: measures the live page and produces a concise, machine-
// readable issue report for the repair loop. Pure function of `doc` plus an
// injectable measure adapter (tests feed synthetic geometry; jsdom has none).
//
// Report line format:  <type>: <selector> | <detail>
import { uniqueSelector, patternSelector, rgbToHex } from '../summarize.js';
import { estimateTokens } from '../assets/index.js';

export const ISSUE_SEVERITY = {
  invisible: 3,
  'overflow-x': 3,
  'icon-missing': 2,
  'contrast-low': 2,
  'text-clipped': 2,
  overlap: 2,
  'icon-off-center': 2,
  'icon-overlaps-text': 2,
  'icon-duplicate': 1,
  'font-too-small': 1,
  'edge-touch': 1,
  'spacing-inconsistent': 1,
  'padding-collapsed': 1,
  'padding-excessive': 1,
};

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'br', 'wbr', 'retro-web-panel', 'iframe', 'canvas', 'video', 'audio', 'object', 'embed']);
const ICON_CONTAINERS = 'a, button, [role=button], label, li, summary, h1, h2, h3, h4, h5, h6, span, div';
const IMPORTANT = 'nav a, header a, button, [role=button], input[type=submit], h1, h2, h3, main p, article p, main a, input:not([type=hidden]), select, textarea, img';

// ------------------------------------------------------------ measuring ----

export function createInspectorMeasure(doc, overrides = {}) {
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  const rect = overrides.rect || ((el) => el.getBoundingClientRect());
  const style = overrides.style || ((el, pseudo) => (win ? win.getComputedStyle(el, pseudo || null) : {}));
  const scroll = overrides.scroll || ((el) => ({ scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, clientWidth: el.clientWidth, clientHeight: el.clientHeight }));
  const textRect =
    overrides.textRect ||
    ((el) => {
      let best = null;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        try {
          const range = doc.createRange();
          range.selectNodeContents(n);
          const r = range.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          best = best ? union(best, r) : { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        } catch {
          /* ignore */
        }
      }
      return best;
    });
  const naturalSize = overrides.naturalSize || ((img) => ({ w: img.naturalWidth || 0, h: img.naturalHeight || 0, complete: img.complete !== false }));
  const viewport = overrides.viewport || { width: win ? win.innerWidth : 1280, height: win ? win.innerHeight : 800 };
  const propertyValue = overrides.propertyValue || ((name) => (win ? win.getComputedStyle(doc.documentElement).getPropertyValue(name) : ''));
  return { rect, style, scroll, textRect, naturalSize, viewport, propertyValue };
}

function union(a, b) {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function hasOwnText(el) {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim().length >= 2) return true;
  return false;
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseColor(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (!m) return null;
  const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}

function blend(fg, bg) {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

export function luminance({ r, g, b }) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function toHex(c) {
  const h = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return '#' + h(c.r) + h(c.g) + h(c.b);
}

// Effective background behind an element, or null when unknown (image/gradient).
export function effectiveBackground(el, M) {
  let cur = el;
  let acc = null; // accumulated translucent layers (top-most first)
  const layers = [];
  while (cur && cur.nodeType === 1) {
    const st = M.style(cur);
    const bg = parseColor(st.backgroundColor);
    const img = st.backgroundImage && st.backgroundImage !== 'none';
    if (bg && bg.a > 0) layers.push(bg);
    if (bg && bg.a >= 1) break;
    if (img) return null;
    cur = cur.parentElement;
  }
  let result = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i--) result = blend(layers[i], result);
  void acc;
  return result;
}

// ------------------------------------------------------------- baseline ----

// Visibility of important elements before the design is applied.
export function snapshotVisibility(doc, overrides = {}) {
  const M = createInspectorMeasure(doc, overrides);
  const map = new Map();
  const els = [...doc.querySelectorAll(IMPORTANT)].filter((e) => !e.closest('retro-web-panel')).slice(0, 600);
  for (const el of els) map.set(el, visibilityOf(el, M).visible);
  return map;
}

function visibilityOf(el, M) {
  const st = M.style(el);
  if (st.display === 'none') return { visible: false, why: 'display:none' };
  if (st.visibility === 'hidden' || st.visibility === 'collapse') return { visible: false, why: 'visibility:hidden' };
  if (num(st.opacity) < 0.1) return { visible: false, why: 'opacity:' + st.opacity };
  const r = M.rect(el);
  if (r.width < 1 || r.height < 1) return { visible: false, why: `zero-size ${Math.round(r.width)}x${Math.round(r.height)}` };
  const docWidth = Math.max(M.viewport.width, 0);
  if (r.right <= 0 || r.left >= docWidth + 4000 || r.bottom <= -4000) return { visible: false, why: 'off-screen' };
  if (num(st.fontSize) < 1 && hasOwnText(el)) return { visible: false, why: 'font-size:0' };
  return { visible: true };
}

// --------------------------------------------------------------- inspect ----

export function inspectPage(doc, options = {}) {
  const t0 = Date.now();
  const M = createInspectorMeasure(doc, options.measure || {});
  const tol = options.tolerance == null ? 2 : options.tolerance;
  const maxIssues = options.maxIssues || 30;
  const issues = [];
  const add = (type, el, detail, values = {}) => {
    const selector = typeof el === 'string' ? el : uniqueSelector(el, doc, 3);
    issues.push({ type, selector, detail, severity: ISSUE_SEVERITY[type] || 1, ...values });
  };
  const vw = M.viewport.width;
  const all = [...doc.querySelectorAll('body *')].filter((e) => !SKIP_TAGS.has(e.localName) && !e.closest('retro-web-panel') && !e.closest('svg svg, svg *')).slice(0, 2500);
  const styleCache = new Map();
  const S = (el) => {
    let s = styleCache.get(el);
    if (!s) {
      s = M.style(el);
      styleCache.set(el, s);
    }
    return s;
  };
  const rectCache = new Map();
  const R = (el) => {
    let r = rectCache.get(el);
    if (!r) {
      r = M.rect(el);
      rectCache.set(el, r);
    }
    return r;
  };
  const isVisible = (el) => {
    const s = S(el);
    if (s.display === 'none' || s.visibility === 'hidden' || num(s.opacity) < 0.1) return false;
    const r = R(el);
    return r.width > 0 && r.height > 0;
  };
  const visible = all.filter(isVisible);
  const textEls = visible.filter(hasOwnText).slice(0, 800);
  const scrollCache = new Map();
  // inside a horizontally scrollable strip (chips, carousels): extending past the
  // viewport is by design, not an overflow bug
  const inScroller = (el) => {
    let cur = el.parentElement;
    const path = [];
    let result = false;
    while (cur && cur !== doc.documentElement && cur !== doc.body) {
      if (scrollCache.has(cur)) {
        result = scrollCache.get(cur);
        break;
      }
      path.push(cur);
      const o = S(cur);
      if (/auto|scroll/.test(o.overflowX || o.overflow || '')) {
        result = true;
        break;
      }
      cur = cur.parentElement;
    }
    for (const p of path) scrollCache.set(p, result);
    return result;
  };

  // 1. horizontal overflow
  const sc = M.scroll(doc.documentElement);
  if (sc.scrollWidth > sc.clientWidth + 2 && sc.clientWidth > 0) {
    add('overflow-x', 'html', `page scrolls horizontally: content ${sc.scrollWidth}px, viewport ${sc.clientWidth}px`, { scrollWidth: sc.scrollWidth, clientWidth: sc.clientWidth });
    const offenders = visible
      .filter((e) => R(e).right > vw + 2 && R(e).width > 20 && !['html', 'body'].includes(e.localName) && !inScroller(e))
      .sort((a, b) => R(b).right - R(a).right)
      .slice(0, 3);
    for (const e of offenders) add('overflow-x', e, `extends to x=${Math.round(R(e).right)}px (viewport ${vw}px)`);
  }

  // 2. text touching the viewport edge
  for (const el of textEls.slice(0, 400)) {
    const tr = M.textRect(el);
    if (!tr || inScroller(el)) continue;
    if (tr.left <= 1 && tr.width > 10) add('edge-touch', el, `text starts at x=${Math.round(tr.left)}px (no left padding)`);
    else if (tr.right >= vw - 1 && tr.width > 10) add('edge-touch', el, `text ends at x=${Math.round(tr.right)}px, viewport edge`);
  }

  // 3. spacing: inconsistent gaps between same-tag siblings; collapsed/excessive padding
  const containersSeen = new Set();
  for (const el of visible) {
    const parent = el.parentElement;
    if (!parent || containersSeen.has(parent) || parent.localName === 'body' || parent.localName === 'html') continue;
    containersSeen.add(parent);
    if (options.unevenParents && options.unevenParents.has(parent)) continue; // was uneven before we touched it
    const kids = [...parent.children].filter((k) => k.localName === el.localName && isVisible(k));
    if (kids.length < 3 || kids.length > 40) continue;
    const rects = kids.map(R);
    const vertical = rects.every((r, i) => i === 0 || r.top >= rects[i - 1].bottom - 2);
    const horizontal = !vertical && rects.every((r, i) => i === 0 || r.left >= rects[i - 1].right - 2);
    if (!vertical && !horizontal) continue;
    let gaps = rects.slice(1).map((r, i) => Math.round(vertical ? r.top - rects[i].bottom : r.left - rects[i].right));
    const ps = S(parent);
    const isFlex = /flex|grid/.test(ps.display || '');
    if (isFlex && /space-|center|end/.test(ps.justifyContent || '')) continue; // spacing is the layout's job
    if (isFlex && gaps.length >= 2) {
      // one deliberately large gap (auto-margin spacer) is not inconsistency
      const sorted = [...gaps].sort((a, b) => b - a);
      if (sorted[0] > 3 * Math.max(4, sorted[1])) gaps = gaps.filter((g) => g !== sorted[0]);
    }
    if (gaps.length < 2) continue;
    const min = Math.min(...gaps);
    const max = Math.max(...gaps);
    if (max - min > 12 && max > 4) add('spacing-inconsistent', parent, `${vertical ? 'vertical' : 'horizontal'} gaps between ${kids.length} ${el.localName} children vary ${min}px..${max}px`, { gaps, axis: vertical ? 'y' : 'x' });
  }
  for (const el of textEls.slice(0, 500)) {
    const s = S(el);
    const r = R(el);
    const pl = num(s.paddingLeft);
    const pr = num(s.paddingRight);
    const pt = num(s.paddingTop);
    const pb = num(s.paddingBottom);
    const bg = parseColor(s.backgroundColor);
    const hasBox = (bg && bg.a > 0) || num(s.borderLeftWidth) > 0 || (s.backgroundImage && s.backgroundImage !== 'none');
    if (hasBox && pl === 0 && pr === 0 && pt === 0 && pb === 0 && r.width > 24 && ['a', 'button', 'span', 'div', 'li', 'td', 'th', 'label', 'p', 'h1', 'h2', 'h3', 'nav', 'header', 'footer', 'section'].includes(el.localName)) {
      add('padding-collapsed', el, `text touches its box edge (padding 0 on a ${bg && bg.a > 0 ? 'filled' : 'bordered'} box)`);
    } else if (r.width > 0 && pl + pr > Math.max(r.width * 0.6, vw * 0.25) && r.width > 100) {
      add('padding-excessive', el, `horizontal padding ${Math.round(pl + pr)}px on a ${Math.round(r.width)}px box`);
    }
  }

  // 4. icons: off-center, missing
  const smallGraphic = (e) => {
    const r = R(e);
    return r.width <= 48 && r.height <= 48;
  };
  const graphics = all.filter((e) => (e.localName === 'svg' || e.localName === 'img') && smallGraphic(e)).slice(0, 300);
  for (const g of graphics) {
    const container = g.parentElement && g.parentElement.closest(ICON_CONTAINERS);
    if (!container || container === g || !isVisible(container)) continue;
    const gs = S(g);
    if (gs.display === 'none' || gs.visibility === 'hidden') continue;
    const gr = R(g);
    const cr = R(container);
    if (gr.width === 0 || gr.height === 0) {
      add('icon-missing', g, `zero-size icon inside ${patternSelector(container)}`);
      continue;
    }
    const gc = { x: gr.left + gr.width / 2, y: gr.top + gr.height / 2 };
    const tr = hasOwnText(container) ? M.textRect(container) : null;
    if (tr) {
      const dy = Math.round(gc.y - (tr.top + tr.height / 2));
      if (Math.abs(dy) > tol) add('icon-off-center', g, `icon center is ${dy > 0 ? '+' : ''}${dy}px below text center in ${patternSelector(container)}`, { dy });
    } else if (cr.width > 0 && cr.height > 0) {
      const dx = Math.round(gc.x - (cr.left + cr.width / 2));
      const dy = Math.round(gc.y - (cr.top + cr.height / 2));
      const onlyChild = container.children.length === 1 && !hasOwnText(container);
      if (onlyChild && (Math.abs(dx) > tol || Math.abs(dy) > tol)) add('icon-off-center', g, `offset x=${dx > 0 ? '+' : ''}${dx}px y=${dy > 0 ? '+' : ''}${dy}px from the center of ${patternSelector(container)}`, { dx, dy });
    }
  }
  // background-image icons on text elements: vertical position vs text, and
  // horizontal overlap with the text (icon drawn under the first letters)
  const bgIconEls = [];
  const iconGroups = new Map(); // pattern -> { type, el, count, detail }
  const groupIcon = (type, el, detail) => {
    const k = type + '|' + patternSelector(el);
    const g = iconGroups.get(k) || { type, el, count: 0, detail };
    g.count++;
    iconGroups.set(k, g);
  };
  for (const el of visible.slice(0, 1500)) {
    const s = S(el);
    if (!s.backgroundImage || s.backgroundImage === 'none' || !/no-repeat/.test(s.backgroundRepeat || '')) continue;
    const size = /(\d+(?:\.\d+)?)px/.exec(s.backgroundSize || '');
    const iconW = size ? Math.min(48, num(size[1])) : 16;
    if (iconW > 48) continue;
    bgIconEls.push(el);
    const r = R(el);
    const pos = (s.backgroundPosition || '0% 0%').split(/\s+/);
    const posX = pos[0] || '0%';
    const posY = pos[1] || '0%';
    const iconLeft = posX.endsWith('%') ? r.left + (r.width - iconW) * (num(posX) / 100) : /^(left|right|center)$/.test(posX) ? (posX === 'right' ? r.right - iconW : posX === 'center' ? r.left + (r.width - iconW) / 2 : r.left) : r.left + num(posX);
    const iconTop = posY.endsWith('%') ? r.top + (r.height - iconW) * (num(posY) / 100) : posY === 'center' ? r.top + (r.height - iconW) / 2 : r.top + num(posY);
    if (!hasOwnText(el)) {
      // icon-only element that also contains its own graphic: two icons on top of each other
      const g = el.querySelector && el.querySelector('svg, img');
      if (g && isVisible(g)) groupIcon('icon-duplicate', el, 'background icon drawn behind an existing icon (svg/img)');
      continue;
    }
    const tr = M.textRect(el);
    if (!tr) continue;
    const overlap = Math.min(iconLeft + iconW, tr.right) - Math.max(iconLeft, tr.left);
    if (overlap > 2 && iconTop < tr.bottom && iconTop + iconW > tr.top) {
      groupIcon('icon-overlaps-text', el, `background icon overlaps the text by ${Math.round(overlap)}px (padding-left ${s.paddingLeft}, background-position ${pos.join(' ')})`);
      continue;
    }
    const dy = Math.round(iconTop + iconW / 2 - (tr.top + tr.height / 2));
    if (Math.abs(dy) > tol) add('icon-off-center', el, `background icon is ${dy > 0 ? '+' : ''}${dy}px from the text center (background-position ${pos.join(' ')})`, { dy, background: true });
    const g = el.querySelector && el.querySelector('svg, img');
    if (g && isVisible(g) && R(g).width <= 48) groupIcon('icon-duplicate', el, `background icon added to an element that already has its own icon (${g.localName})`);
  }
  // one issue per element pattern so a single rule fixes the whole group
  for (const g of iconGroups.values()) {
    const sel = g.count > 1 ? patternSelector(g.el) : uniqueSelector(g.el, doc, 3);
    add(g.type, sel, g.detail + (g.count > 1 ? ` ×${g.count}` : ''), { count: g.count, background: true });
  }
  // undefined --icon-* vars referenced by the design
  for (const v of options.iconVars || []) {
    const val = (M.propertyValue(v) || '').trim();
    if (!val) add('icon-missing', v, `variable ${v} is not defined; the icon will not render`);
  }
  // broken images
  for (const img of visible.filter((e) => e.localName === 'img').slice(0, 200)) {
    const n = M.naturalSize(img);
    if (n.complete && n.w === 0 && n.h === 0 && img.getAttribute('src')) add('icon-missing', img, 'broken image (natural size 0x0)');
  }
  // icon slots with no image
  for (const el of visible.filter((e) => e.classList && (e.classList.contains('retro-icon-left') || e.classList.contains('retro-badge-new'))).slice(0, 100)) {
    const s = S(el);
    if (!s.backgroundImage || s.backgroundImage === 'none') add('icon-missing', el, 'icon slot has no background-image');
  }

  // 5. overflow/overlap: clipped text, overlapping siblings
  for (const el of textEls.slice(0, 500)) {
    const s = S(el);
    const clipX = /hidden|clip|auto|scroll/.test(s.overflowX || s.overflow || '');
    const clipY = /hidden|clip|auto|scroll/.test(s.overflowY || s.overflow || '');
    if (!clipX && !clipY) continue;
    const sc2 = M.scroll(el);
    if (clipX && sc2.scrollWidth > sc2.clientWidth + 2) add('text-clipped', el, `content ${sc2.scrollWidth}px wide in a ${sc2.clientWidth}px box (overflow ${s.overflowX || s.overflow})`);
    else if (clipY && sc2.scrollHeight > sc2.clientHeight + 2 && !/auto|scroll/.test(s.overflowY || s.overflow || '')) add('text-clipped', el, `content ${sc2.scrollHeight}px tall in a ${sc2.clientHeight}px box (overflow hidden)`);
  }
  for (const el of textEls.slice(0, 500)) {
    const s = S(el);
    if (s.whiteSpace !== 'nowrap') continue;
    const tr = M.textRect(el);
    const r = R(el);
    if (tr && tr.right > r.right + 2 && tr.right > vw) add('text-clipped', el, `nowrap text runs ${Math.round(tr.right - r.right)}px past its box`);
  }
  const seenPairs = new Set();
  for (const el of visible.slice(0, 1500)) {
    const next = el.nextElementSibling;
    if (!next || !isVisible(next) || SKIP_TAGS.has(next.localName)) continue;
    const sa = S(el);
    const sb = S(next);
    if (/absolute|fixed/.test(sa.position) || /absolute|fixed/.test(sb.position)) continue;
    if (sa.float !== 'none' || sb.float !== 'none') continue;
    const a = R(el);
    const b = R(next);
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 4 && iy > 4 && (hasOwnText(el) || hasOwnText(next) || el.localName === 'img' || next.localName === 'img')) {
      const key = uniqueSelector(el, doc, 2);
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      add('overlap', el, `overlaps its next sibling ${patternSelector(next)} by ${Math.round(ix)}x${Math.round(iy)}px`);
    }
  }

  // 6. readability: contrast and font size (grouped by pattern)
  const contrastGroups = new Map();
  const smallGroups = new Map();
  for (const el of textEls) {
    const s = S(el);
    const fs = num(s.fontSize);
    if (fs > 0 && fs < 11 && !['sup', 'sub', 'small', 'code', 'kbd'].includes(el.localName)) {
      const k = patternSelector(el);
      const g = smallGroups.get(k) || { el, count: 0, size: fs };
      g.count++;
      g.size = Math.min(g.size, fs);
      smallGroups.set(k, g);
    }
    const fg = parseColor(s.color);
    if (!fg) continue;
    const bg = effectiveBackground(el, M);
    if (!bg) continue;
    const ratio = contrastRatio(fg.a < 1 ? blend(fg, bg) : fg, bg);
    const bold = num(s.fontWeight) >= 700 || s.fontWeight === 'bold';
    const large = fs >= 24 || (fs >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const k = patternSelector(el);
      const g = contrastGroups.get(k) || { el, count: 0, ratio, fg: toHex(fg), bg: toHex(bg), need };
      g.count++;
      if (ratio < g.ratio) {
        g.ratio = ratio;
        g.fg = toHex(fg);
        g.bg = toHex(bg);
      }
      contrastGroups.set(k, g);
    }
  }
  for (const [, g] of [...contrastGroups.entries()].sort((a, b) => a[1].ratio - b[1].ratio).slice(0, 8)) {
    add('contrast-low', patternSelector(g.el), `${g.ratio.toFixed(1)}:1 (${g.fg} on ${g.bg}), needs ${g.need}:1${g.count > 1 ? ` ×${g.count}` : ''}`, { ratio: +g.ratio.toFixed(2), fg: g.fg, bg: g.bg });
  }
  for (const [, g] of [...smallGroups.entries()].sort((a, b) => a[1].size - b[1].size).slice(0, 6)) {
    add('font-too-small', patternSelector(g.el), `${g.size}px (minimum 11px)${g.count > 1 ? ` ×${g.count}` : ''}`, { size: g.size });
  }

  // 7. invisible content (vs. baseline)
  if (options.baseline) {
    let n = 0;
    for (const [el, wasVisible] of options.baseline) {
      if (!wasVisible || !el.isConnected) continue;
      const v = visibilityOf(el, M);
      if (!v.visible) {
        if (n++ < 12) add('invisible', el, `was visible before the design, now ${v.why}`, { why: v.why });
      }
    }
    if (n > 12) add('invisible', 'body', `${n} important elements hidden in total`);
  }

  // ---- finalize ----
  // issues the original page already had are not ours to fix (and "fixing" them
  // means changing layout we never touched)
  let preexisting = 0;
  let list = issues;
  if (options.ignore && options.ignore.size) {
    list = issues.filter((i) => {
      const hit = options.ignore.has(i.type + '|' + i.selector);
      if (hit) preexisting++;
      return !hit;
    });
  }
  list.sort((a, b) => b.severity - a.severity);
  const limited = list.slice(0, maxIssues);
  const counts = {};
  for (const i of list) counts[i.type] = (counts[i.type] || 0) + 1;
  return { issues: limited, total: list.length, counts, preexisting, text: renderReport(limited, options.tokenBudget || 600), elapsedMs: Date.now() - t0 };
}

// Set of type|selector keys from a report, for inspectPage({ ignore }).
export function issueKeys(report) {
  return new Set((report && report.issues ? report.issues : []).map((i) => i.type + '|' + i.selector));
}

export function renderReport(issues, tokenBudget = 600) {
  if (!issues.length) return 'no issues';
  const lines = issues.map((i) => `${i.type}: ${i.selector} | ${i.detail}`);
  let out = lines.join('\n');
  while (estimateTokens(out) > tokenBudget && lines.length > 3) {
    lines.pop();
    out = lines.join('\n') + `\n(+${issues.length - lines.length} more)`;
  }
  return out;
}
