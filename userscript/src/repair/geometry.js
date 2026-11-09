// Geometry guard: measures the page BEFORE anything is applied and uses that to
// (1) build the allow-list of elements that may receive spacing/layout CSS,
// (2) detect elements our CSS moved or resized when it should not have, and
// (3) roll the offending declarations back out of our own stylesheets.
// Pure functions of a document plus an injectable measure adapter.
import { createInspectorMeasure } from './inspect.js';
import { parseCss, probeSelector } from '../validate.js';

const MEDIA = 'video, audio, canvas, iframe, embed, object';
const BUTTONS = 'button, [role=button], input[type=submit], input[type=button], a[class*="btn"], a[class*="button"], a[class*="cta"]';
const TEXT_INPUTS = 'input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]):not([type=color]):not([type=image]), select, textarea';
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'br', 'wbr', 'retro-web-panel', 'svg', 'path', 'g', 'use', 'defs', 'symbol']);

// Declarations that change geometry; these are what gets rolled back.
export const GEOMETRY_PROPS = /^(margin(-.*)?|padding(-.*)?|border|border-(top|right|bottom|left)|border(-(top|right|bottom|left))?-width|gap|row-gap|column-gap|(min-|max-)?(width|height)|display|position|top|left|right|bottom|inset(-.*)?|flex(-.*)?|transform|font-size|line-height|box-sizing|vertical-align|letter-spacing|text-indent|float|white-space|align-.*|justify-.*)$/;

function ownText(el) {
  let t = '';
  for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
  return t.trim();
}
function visibleText(el) {
  return (el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
}

// Elements inside a media player: the media element's parent, plus the
// grandparent when it is a player wrapper (little text) rather than a page section.
const SECTION_TAGS = new Set(['html', 'body', 'main', 'article', 'section', 'aside', 'header', 'footer', 'nav']);
export function mediaRoots(doc) {
  const roots = new Set();
  for (const m of doc.querySelectorAll(MEDIA)) {
    const p = m.parentElement;
    if (!p || p === doc.body || SECTION_TAGS.has(p.localName)) continue;
    roots.add(p);
    const gp = p.parentElement;
    if (gp && gp !== doc.body && !SECTION_TAGS.has(gp.localName) && (gp.textContent || '').trim().length < 300) roots.add(gp);
  }
  return [...roots];
}

// ---------------------------------------------------------------- allow-list ----

export function buildAllowList(doc, data = {}, overrides = {}) {
  const M = createInspectorMeasure(doc, overrides);
  const allowed = new Set();
  const roots = mediaRoots(doc);
  const inMedia = (el) => roots.some((r) => r.contains(el));
  const small = (el) => {
    const r = M.rect(el);
    return r.width <= 48 && r.height <= 48;
  };
  const positioned = (el) => /absolute|fixed|sticky/.test(M.style(el).position || '');
  const q = (sel) => {
    try {
      return [...doc.querySelectorAll(sel)];
    } catch {
      return [];
    }
  };
  if (doc.documentElement) allowed.add(doc.documentElement);
  if (doc.body) allowed.add(doc.body);
  const landmarks = [];
  for (const l of data.landmarks || []) {
    for (const el of q(l.selector)) {
      if (inMedia(el) || el.matches(MEDIA)) continue;
      allowed.add(el);
      landmarks.push({ role: l.role, el });
    }
  }
  // text links inside verified navs
  for (const { role, el } of landmarks) {
    if (role !== 'nav') continue;
    for (const a of el.querySelectorAll('a')) {
      if (visibleText(a).length >= 2 && !a.querySelector('svg, img') && !positioned(a)) allowed.add(a);
    }
  }
  // text buttons (not icon-only, not pixel-positioned, not in a player)
  for (const b of q(BUTTONS)) {
    if (inMedia(b) || positioned(b) || small(b)) continue;
    if (visibleText(b).length < 2 || (b.querySelector('svg, img') && visibleText(b).length < 2)) continue;
    allowed.add(b);
  }
  for (const i of q(TEXT_INPUTS)) if (!inMedia(i) && !positioned(i)) allowed.add(i);
  for (const hr of q('hr')) allowed.add(hr);
  // content images (not icon-sized, not pixel-positioned, not inside a player) may get a frame
  for (const img of q('img, picture')) if (!small(img) && !positioned(img) && !inMedia(img)) allowed.add(img);
  for (const h of q('h1, h2, h3, h4, h5, h6')) if (visibleText(h).length >= 2 && !h.closest('nav') && !inMedia(h) && !positioned(h)) allowed.add(h);
  // text list items in the main content (bullets)
  const mains = landmarks.filter((l) => l.role === 'main').map((l) => l.el);
  for (const main of mains) for (const li of main.querySelectorAll('li')) if (ownText(li).length >= 2 && !li.closest('nav') && !inMedia(li)) allowed.add(li);
  return { allowed, isAllowed: (el) => allowed.has(el), mediaRoots: roots, landmarks };
}

// ----------------------------------------------------------------- snapshot ----

export function snapshotGeometry(doc, overrides = {}, { limit = 3000, isAllowed = () => false } = {}) {
  const M = createInspectorMeasure(doc, overrides);
  const roots = mediaRoots(doc);
  const inMedia = (el) => roots.some((r) => r.contains(el));
  const entries = new Map();
  const parents = new Map(); // parent -> { padL, padT, bL, bT }
  const all = [...doc.querySelectorAll('body *')].filter((e) => !SKIP.has(e.localName) && !e.closest('retro-web-panel')).slice(0, limit);
  const gapsByParent = new Map();
  for (const el of all) {
    const st = M.style(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const r = M.rect(el);
    if (r.width <= 0 || r.height <= 0) continue;
    const pos = st.position || 'static';
    const e = {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      small: r.width <= 48 && r.height <= 48,
      positioned: /absolute|fixed|sticky/.test(pos),
      inMedia: inMedia(el),
      allowed: isAllowed(el),
    };
    e.candidate = !e.allowed && (e.small || e.positioned || e.inMedia);
    entries.set(el, e);
    const p = el.parentElement;
    if (p) {
      if (e.candidate && !parents.has(p)) {
        const ps = M.style(p);
        parents.set(p, { padL: parseFloat(ps.paddingLeft) || 0, padT: parseFloat(ps.paddingTop) || 0, bL: parseFloat(ps.borderLeftWidth) || 0, bT: parseFloat(ps.borderTopWidth) || 0, left: M.rect(p).left, top: M.rect(p).top });
      }
      let g = gapsByParent.get(p);
      if (!g) {
        g = { tag: el.localName, rects: [], mixed: false };
        gapsByParent.set(p, g);
      }
      if (g.tag !== el.localName) g.mixed = true;
      g.rects.push(r);
    }
  }
  // containers whose same-tag children were already unevenly spaced on the original page
  const unevenParents = new Set();
  for (const [p, g] of gapsByParent) {
    if (g.mixed || g.rects.length < 3) continue;
    const rs = g.rects;
    const vertical = rs.every((r, i) => i === 0 || r.top >= rs[i - 1].bottom - 2);
    const horizontal = !vertical && rs.every((r, i) => i === 0 || r.left >= rs[i - 1].right - 2);
    if (!vertical && !horizontal) continue;
    const gaps = rs.slice(1).map((r, i) => (vertical ? r.top - rs[i].bottom : r.left - rs[i].right));
    if (Math.max(...gaps) - Math.min(...gaps) > 12) unevenParents.add(p);
  }
  return { entries, parents, unevenParents, viewport: M.viewport };
}

// -------------------------------------------------------------------- diff ----

export function findGeometryViolations(snapshot, doc, overrides = {}, { sizeTolerance = 4, moveTolerance = 6, mediaTolerance = 2 } = {}) {
  const M = createInspectorMeasure(doc, overrides);
  const out = [];
  const parentNow = new Map();
  for (const [el, b] of snapshot.entries) {
    if (!b.candidate || !el.isConnected) continue;
    const st = M.style(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const r = M.rect(el);
    if (r.width <= 0 && r.height <= 0) continue;
    const tol = b.inMedia ? mediaTolerance : sizeTolerance;
    const dw = r.width - b.width;
    const dh = r.height - b.height;
    let kind = null;
    if (Math.abs(dw) > tol || Math.abs(dh) > tol) kind = 'resized';
    else {
      // position relative to the parent, minus the parent's own padding/border change
      const p = el.parentElement;
      const pb = p && snapshot.parents.get(p);
      if (pb) {
        let pn = parentNow.get(p);
        if (!pn) {
          const ps = M.style(p);
          const pr = M.rect(p);
          pn = { padL: parseFloat(ps.paddingLeft) || 0, padT: parseFloat(ps.paddingTop) || 0, bL: parseFloat(ps.borderLeftWidth) || 0, bT: parseFloat(ps.borderTopWidth) || 0, left: pr.left, top: pr.top };
          parentNow.set(p, pn);
        }
        const expectX = pn.padL - pb.padL + (pn.bL - pb.bL);
        const expectY = pn.padT - pb.padT + (pn.bT - pb.bT);
        const relBeforeX = b.left + b.width / 2 - pb.left;
        const relBeforeY = b.top + b.height / 2 - pb.top;
        const relNowX = r.left + r.width / 2 - pn.left;
        const relNowY = r.top + r.height / 2 - pn.top;
        const dx = relNowX - relBeforeX - expectX;
        const dy = relNowY - relBeforeY - expectY;
        const mt = b.inMedia ? mediaTolerance : moveTolerance;
        if (Math.abs(dx) > mt || Math.abs(dy) > mt) kind = 'moved';
        if (kind) out.push({ el, kind, dx: Math.round(dx), dy: Math.round(dy), dw: Math.round(dw), dh: Math.round(dh), inMedia: b.inMedia });
        continue;
      }
    }
    if (kind) out.push({ el, kind, dw: Math.round(dw), dh: Math.round(dh), inMedia: b.inMedia });
  }
  return out;
}

// ---------------------------------------------------------------- rollback ----

function serialize(nodes, indent = '') {
  const lines = [];
  for (const n of nodes) {
    if (n.type === 'at') {
      if (n.statement) continue;
      if (n.rules) lines.push(`${indent}@${n.name} ${n.prelude} {`, ...serialize(n.rules, indent + '  '), `${indent}}`);
      else if (n.declarations && n.declarations.length) lines.push(`${indent}@${n.name} { ${n.declarations.map((d) => `${d.prop}: ${d.value}${d.important ? ' !important' : ''};`).join(' ')} }`);
    } else if (n.declarations && n.declarations.length) {
      lines.push(`${indent}${n.selector} { ${n.declarations.map((d) => `${d.prop}: ${d.value}${d.important ? ' !important' : ''};`).join(' ')} }`);
    }
  }
  return lines;
}

// Removes geometry declarations from rules (in the given CSS text) that match a
// violating element or its parent. Returns { css, removed: [{selector, props}] }.
export function rollbackGeometry(css, violations, doc, { isLandmark = () => false } = {}) {
  if (!css || !violations.length) return { css, removed: [] };
  const { rules } = parseCss(css);
  const removed = [];
  const targets = [];
  for (const v of violations) {
    targets.push(v.el);
    const p = v.el.parentElement;
    if (p && !isLandmark(p)) targets.push(p);
  }
  const visit = (nodes, inKeyframes) => {
    for (const n of nodes) {
      if (n.type === 'at') {
        if (n.rules && !n.keyframes) visit(n.rules, false);
        continue;
      }
      if (inKeyframes || !n.declarations) continue;
      if (/::?(before|after|marker)/.test(n.selector)) continue; // our decorations are new boxes, not moved ones
      let hit = false;
      for (const part of n.selector.split(',')) {
        const probe = probeSelector(part.trim());
        try {
          if (targets.some((t) => t.matches(probe))) {
            hit = true;
            break;
          }
        } catch {
          /* ignore */
        }
      }
      if (!hit) continue;
      const before = n.declarations.length;
      const dropped = n.declarations.filter((d) => GEOMETRY_PROPS.test(d.prop)).map((d) => d.prop);
      n.declarations = n.declarations.filter((d) => !GEOMETRY_PROPS.test(d.prop));
      if (n.declarations.length !== before) removed.push({ selector: n.selector, props: [...new Set(dropped)] });
    }
  };
  visit(rules, false);
  return { css: serialize(rules).join('\n'), removed };
}

// Diff → rollback over the given slots, up to `rounds` times. Returns a report.
export async function enforceGeometry({ doc, snapshot, slots, slotNames = ['design', 'patch', 'fallback'], measure, isLandmark, rounds = 3, settle = () => Promise.resolve() }) {
  const removedAll = [];
  let violations = [];
  for (let i = 0; i < rounds; i++) {
    violations = findGeometryViolations(snapshot, doc, measure);
    if (!violations.length) break;
    let changed = false;
    for (const name of slotNames) {
      const slot = slots[name];
      if (!slot || !slot.css) continue;
      const r = rollbackGeometry(slot.css, violations, doc, { isLandmark });
      if (r.removed.length) {
        slot.set(r.css);
        removedAll.push(...r.removed.map((x) => ({ ...x, slot: name })));
        changed = true;
      }
    }
    if (!changed) break; // nothing of ours explains the movement (text reflow etc.)
    await settle();
  }
  return { removed: removedAll, remaining: violations.map((v) => ({ kind: v.kind, dx: v.dx, dy: v.dy, dw: v.dw, dh: v.dh, inMedia: v.inMedia })) };
}
