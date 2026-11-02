// SVG sanitizer for icons returned by the Claude API. Allowlist-only: anything
// not listed is removed. The result is a standalone <svg> safe to embed as a
// CSS data URI (no scripts, no foreign content, no external references).

const ALLOWED_ELEMENTS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc', 'clippath', 'mask', 'use', 'symbol', 'pattern']);
const ALLOWED_ATTRS = new Set([
  'id', 'class', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'transform', 'offset', 'stop-color', 'stop-opacity',
  'gradientunits', 'gradienttransform', 'spreadmethod', 'clip-path', 'mask', 'shape-rendering', 'preserveaspectratio', 'xmlns', 'xmlns:xlink',
  'href', 'xlink:href', 'patternunits', 'patterntransform', 'vector-effect', 'paint-order', 'display', 'visibility', 'overflow',
]);
const URL_FUNC = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
const DANGEROUS = /javascript:|data:|vbscript:|expression\(|<script|&#|%3c/i;

export function sanitizeSvg(input, { maxLength = 20000, defaultViewBox = '0 0 16 16' } = {}) {
  const removed = [];
  const errors = [];
  if (typeof input !== 'string') return { svg: null, errors: ['not a string'], removed };
  let text = input.trim();
  // strip markdown fences, XML prolog, doctype and comments
  text = text.replace(/```[a-z]*\s*/gi, '').replace(/<\?xml[^>]*\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const start = text.indexOf('<svg');
  const end = text.lastIndexOf('</svg>');
  if (start < 0 || end < 0) return { svg: null, errors: ['no <svg> element'], removed };
  text = text.slice(start, end + 6);
  if (text.length > maxLength) return { svg: null, errors: ['svg too large'], removed };
  if (!/xmlns=/.test(text.slice(0, text.indexOf('>')))) text = text.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');

  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch (e) {
    return { svg: null, errors: ['parse failed: ' + (e && e.message)], removed };
  }
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement || doc.documentElement.localName !== 'svg') {
    return { svg: null, errors: ['malformed svg'], removed };
  }
  const root = doc.documentElement;

  const walk = (el) => {
    for (const child of [...el.childNodes]) {
      if (child.nodeType === 1) {
        const name = child.localName.toLowerCase();
        if (!ALLOWED_ELEMENTS.has(name) || (child.namespaceURI && child.namespaceURI !== 'http://www.w3.org/2000/svg')) {
          removed.push('element:' + name);
          child.remove();
          continue;
        }
        walk(child);
      } else if (child.nodeType === 8 || child.nodeType === 7) {
        child.remove();
      } else if (child.nodeType === 3 && !/^(title|desc)$/i.test(el.localName) && child.nodeValue.trim()) {
        // stray text outside title/desc is dropped
        child.remove();
      }
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      let ok = ALLOWED_ATTRS.has(name);
      if (name.startsWith('on')) ok = false;
      if (ok && (name === 'href' || name === 'xlink:href') && !/^#[\w:-]+$/.test(value.trim())) ok = false;
      if (ok && DANGEROUS.test(value)) ok = false;
      if (ok && /url\(/i.test(value)) {
        let urlsOk = true;
        value.replace(URL_FUNC, (_m, _q, u) => {
          if (!/^#[\w:-]+$/.test(u.trim())) urlsOk = false;
          return _m;
        });
        if (!urlsOk) ok = false;
      }
      if (ok && value.length > 4000) ok = false;
      if (!ok) {
        removed.push('attr:' + name);
        el.removeAttribute(attr.name);
      }
    }
  };
  walk(root);

  if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', defaultViewBox);
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!root.querySelector('path, rect, circle, ellipse, line, polyline, polygon, use')) errors.push('no shapes left');
  let svg;
  try {
    svg = new XMLSerializer().serializeToString(root);
  } catch (e) {
    return { svg: null, errors: ['serialize failed'], removed };
  }
  if (errors.length) return { svg: null, errors, removed };
  return { svg, errors, removed };
}
