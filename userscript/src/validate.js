// CSS validator for model output (full designs and repair patches).
//
//   parseCss(text)                      -> { rules, errors }   (own tolerant parser)
//   validateCss(text, { doc, ... })     -> { css, kept, dropped, warnings, iconVars, varsUsed, errors }
//   extractDirectives(text)             -> { css, iconRequests, applyClass }
//   validateApplyClass(list, { doc })   -> { applied: [...], dropped: [...] }
//
// Rules enforced (see CLAUDE.md): malformed rules rejected, selectors that match
// nothing dropped, @import / external url() blocked, dangerous properties
// blocked, absurd values clamped, content-hiding declarations refused unless the
// target is tiny and decorative, our own UI protected, `!important` forced.

const NESTED_AT = new Set(['media', 'supports', 'container']);
const BLOCKED_AT = new Set(['import', 'charset', 'namespace', 'document', '-moz-document', 'page', 'property', 'font-feature-values', 'counter-style', 'layer', 'scope', 'starting-style', 'view-transition']);
const BLOCKED_PROPS = new Set(['behavior', '-moz-binding', '-ms-behavior', 'binding', '-ms-filter', 'zoom', 'all']);
const DANGEROUS_VALUE = /expression\s*\(|javascript:|vbscript:|-moz-binding|@import|<\/|\\0|progid:|\bimport\s*\(/i;
const URL_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
const ALLOWED_URL = /^(data:image\/(svg\+xml|png|gif|jpeg|webp)[;,]|data:font\/|data:application\/(font|x-font|octet-stream)|#)/i;
const STATE_PSEUDO = /:(hover|focus|focus-within|focus-visible|active|visited|link|target|checked|disabled|enabled|placeholder-shown|read-only|read-write|required|optional|valid|invalid|in-range|out-of-range|indeterminate|default|fullscreen|open|closed|autofill|user-invalid|any-link|local-link|popover-open)(?![\w-])/g;
const PSEUDO_ELEMENT = /::?(before|after|marker|placeholder|selection|first-line|first-letter|backdrop|file-selector-button|cue|part\([^)]*\)|slotted\([^)]*\)|-webkit-[a-z-]+|-moz-[a-z-]+|-ms-[a-z-]+)/g;
const INTERACTIVE = new Set(['a', 'button', 'input', 'select', 'textarea', 'label', 'summary']);
const LANDMARK_TAGS = new Set(['html', 'body', 'main', 'nav', 'header', 'footer', 'article', 'form']);
const DEFAULT_PROTECT = /retro-web/i;

// Layout-affecting properties: allowed only on specific selectors (few matches),
// never on media elements. Broad selectors may only change cosmetics.
const LAYOUT_PROPS = /^(display|position|top|right|bottom|left|inset(-.*)?|float|clear|(min-|max-)?(width|height|inline-size|block-size)|flex(-.*)?|grid(-.*)?|gap|row-gap|column-gap|align-.*|justify-.*|place-.*|order|overflow(-.*)?|transform(-.*)?|translate|rotate|scale|z-index|box-sizing|columns?|column-(count|width|span|fill)|white-space|visibility|object-fit|object-position|aspect-ratio|text-indent|writing-mode|direction|contain|container(-.*)?|vertical-align|table-layout|resize|appearance|line-clamp|-webkit-line-clamp)$/;
const SPACING_PROPS = /^(margin(-.*)?|padding(-.*)?)$/;
const MEDIA_TAGS = new Set(['video', 'audio', 'canvas', 'iframe', 'embed', 'object', 'picture', 'source', 'track']);
const MEDIA_SAFE = /^(border(-.*)?|outline(-.*)?|box-shadow|filter|opacity|cursor|background(-.*)?)$/;
const MEDIA_CONTAINER_RISKY = /^(display|position|(min-|max-)?(width|height|inline-size|block-size)|overflow(-.*)?|transform(-.*)?|flex(-.*)?|grid(-.*)?|aspect-ratio|visibility|float|columns?|contain)$/;
const GENTLE_CLAMPS = {
  padding: { px: [0, 24], em: [0, 1.5], rem: [0, 1.5], '%': [0, 5], vw: [0, 2], vh: [0, 2] },
  margin: { px: [-8, 24], em: [-0.5, 1.5], rem: [-0.5, 1.5], '%': [-2, 5], vw: [-2, 2], vh: [-2, 2] },
  'font-size': { px: [11, 20], pt: [8, 15], em: [0.8, 1.3], rem: [0.8, 1.3], '%': [80, 130], vw: [0.8, 1.5], vh: [0.8, 1.5] },
  'line-height': { '': [1, 1.8], px: [12, 32], em: [1, 1.8], rem: [1, 1.8], '%': [100, 180] },
  border: { px: [0, 4], em: [0, 0.3], rem: [0, 0.3] },
};

// unit -> [min, max] per property family
const CLAMPS = [
  [/^font-size$/, { px: [8, 96], pt: [6, 72], em: [0.5, 6], rem: [0.5, 6], '%': [50, 600], vw: [0.5, 8], vh: [0.5, 8] }],
  [/^font$/, { px: [8, 96], pt: [6, 72], em: [0.5, 6], rem: [0.5, 6], '': [0.9, 3] }],
  [/^line-height$/, { '': [0.9, 3], px: [10, 120], em: [0.9, 3], rem: [0.9, 3], '%': [90, 300] }],
  [/^(letter|word)-spacing$/, { px: [-2, 24], em: [-0.1, 1.5], rem: [-0.1, 1.5] }],
  [/^margin(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/, { px: [-320, 320], em: [-20, 20], rem: [-20, 20], '%': [-50, 100], vw: [-50, 50], vh: [-50, 50] }],
  [/^padding(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/, { px: [0, 320], em: [0, 20], rem: [0, 20], '%': [0, 50], vw: [0, 40], vh: [0, 40] }],
  [/^(gap|row-gap|column-gap|grid-gap)$/, { px: [0, 200], em: [0, 12], rem: [0, 12] }],
  [/^(top|right|bottom|left|inset(-(block|inline)(-(start|end))?)?)$/, { px: [-320, 320], '%': [-100, 100], vw: [-100, 100], vh: [-100, 100], em: [-20, 20], rem: [-20, 20] }],
  [/^(border(-(top|right|bottom|left|block|inline))?(-width)?|outline(-width)?|column-rule(-width)?)$/, { px: [0, 40], em: [0, 3], rem: [0, 3] }],
  [/^border(-(top|bottom)-(left|right))?-radius$/, { px: [0, 1000], em: [0, 60], rem: [0, 60], '%': [0, 100] }],
  [/^(min-|max-)?(width|height|inline-size|block-size)$|^flex-basis$/, { px: [0, 4000], vw: [0, 100], vh: [0, 100], em: [0, 250], rem: [0, 250] }],
  [/^z-index$/, { '': [-1, 2147483000] }],
  [/^opacity$/, { '': [0, 1], '%': [0, 100] }],
  [/^transform$/, { px: [-300, 300], '': [0.5, 3], '%': [-100, 100] }],
  [/^(animation|transition)(-duration|-delay)?$/, { s: [0.1, 60], ms: [100, 60000] }],
  [/^(backdrop-)?filter$/, { px: [0, 3], '': [0.5, 2], '%': [50, 200] }],
  [/^text-indent$/, { px: [-10, 200], em: [-1, 10], rem: [-1, 10] }],
  [/^(box|text)-shadow$/, { px: [-30, 60], em: [-2, 4], rem: [-2, 4] }],
  [/^background-size$/, { px: [1, 2000], '%': [1, 500] }],
  [/^outline-offset$/, { px: [-5, 20] }],
  [/^stroke-width$/, { px: [0, 10], '': [0, 10] }],
  [/^(column-count)$/, { '': [1, 4] }],
];

// ---------------------------------------------------------------- parser ----

function skipTo(src, i, end, stops) {
  // scan from i, skipping strings/comments/parens, until one of `stops` at depth 0
  let paren = 0;
  let str = null;
  for (let j = i; j < end; j++) {
    const c = src[j];
    if (str) {
      if (c === '\\') j++;
      else if (c === str || c === '\n') str = null;
      continue;
    }
    if (c === '/' && src[j + 1] === '*') {
      const k = src.indexOf('*/', j + 2);
      j = k < 0 ? end : k + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      str = c;
      continue;
    }
    if (c === '(') paren++;
    else if (c === ')') paren = Math.max(0, paren - 1);
    else if (paren === 0 && stops.includes(c)) return { idx: j, ch: c };
  }
  return { idx: end, ch: '' };
}

function findBlockEnd(src, open, end) {
  let depth = 0;
  let str = null;
  for (let j = open; j < end; j++) {
    const c = src[j];
    if (str) {
      if (c === '\\') j++;
      else if (c === str || c === '\n') str = null;
      continue;
    }
    if (c === '/' && src[j + 1] === '*') {
      const k = src.indexOf('*/', j + 2);
      j = k < 0 ? end : k + 1;
      continue;
    }
    if (c === '"' || c === "'") str = c;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

export function stripComments(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const ws = (s) => stripComments(s).replace(/\s+/g, ' ').trim();

function parseDeclarations(text, errors, where) {
  const decls = [];
  let i = 0;
  const end = text.length;
  while (i < end) {
    const { idx, ch } = skipTo(text, i, end, [';', '{', '}']);
    if (ch === '{') {
      // nested block inside declarations: unsupported, drop it
      const close = findBlockEnd(text, idx, end);
      errors.push({ reason: 'nested-block', where, text: ws(text.slice(i, idx)).slice(0, 80) });
      i = close < 0 ? end : close + 1;
      continue;
    }
    const chunk = ws(text.slice(i, idx));
    i = idx + 1;
    if (!chunk) continue;
    const colon = chunk.indexOf(':');
    if (colon <= 0) {
      errors.push({ reason: 'malformed-declaration', where, text: chunk.slice(0, 80) });
      continue;
    }
    const prop = chunk.slice(0, colon).trim().toLowerCase();
    let value = chunk.slice(colon + 1).trim();
    let important = false;
    const im = /\s*!\s*important\s*$/i.exec(value);
    if (im) {
      important = true;
      value = value.slice(0, im.index).trim();
    }
    if (!/^(--[\w-]+|-?[a-z][a-z0-9-]*)$/.test(prop) || !value) {
      errors.push({ reason: 'malformed-declaration', where, text: chunk.slice(0, 80) });
      continue;
    }
    decls.push({ prop, value, important });
  }
  return decls;
}

function parseRules(src, start, end, errors, depth = 0) {
  const nodes = [];
  let i = start;
  while (i < end) {
    const { idx, ch } = skipTo(src, i, end, ['{', ';', '}']);
    const head = ws(src.slice(i, idx));
    if (ch === '') {
      if (head) errors.push({ reason: 'dangling-text', text: head.slice(0, 80) });
      break;
    }
    if (ch === ';') {
      if (head.startsWith('@')) {
        const name = (/^@([\w-]+)/.exec(head) || [])[1] || '';
        nodes.push({ type: 'at', name: name.toLowerCase(), prelude: head.slice(name.length + 1).trim(), statement: true });
      } else if (head) errors.push({ reason: 'stray-declaration', text: head.slice(0, 80) });
      i = idx + 1;
      continue;
    }
    if (ch === '}') {
      if (head) errors.push({ reason: 'stray-text', text: head.slice(0, 80) });
      i = idx + 1;
      continue;
    }
    // Drop leading prose lines ("Here is the fix:") the model may put before a rule.
    const rawLines = stripComments(src.slice(i, idx)).split('\n').map((l) => l.trim()).filter(Boolean);
    let cut = -1;
    for (let k = 0; k < rawLines.length - 1; k++) if (/[:.!?]$/.test(rawLines[k]) && !/,$/.test(rawLines[k])) cut = k;
    const prelude = cut >= 0 ? ws(rawLines.slice(cut + 1).join(' ')) : head;
    const close = findBlockEnd(src, idx, end);
    if (close < 0) {
      errors.push({ reason: 'unclosed-block', text: prelude.slice(0, 80) });
      break;
    }
    if (!prelude) {
      errors.push({ reason: 'empty-selector' });
      i = close + 1;
      continue;
    }
    if (prelude.startsWith('@')) {
      const name = ((/^@([\w-]+)/.exec(prelude) || [])[1] || '').toLowerCase();
      const params = prelude.slice(name.length + 1).trim();
      if (NESTED_AT.has(name) && depth < 3) nodes.push({ type: 'at', name, prelude: params, rules: parseRules(src, idx + 1, close, errors, depth + 1) });
      else if (name === 'keyframes' || name.endsWith('-keyframes')) nodes.push({ type: 'at', name, prelude: params, rules: parseRules(src, idx + 1, close, errors, depth + 1), keyframes: true });
      else nodes.push({ type: 'at', name, prelude: params, declarations: parseDeclarations(src.slice(idx + 1, close), errors, '@' + name) });
    } else {
      nodes.push({ type: 'rule', selector: prelude, declarations: parseDeclarations(src.slice(idx + 1, close), errors, prelude) });
    }
    i = close + 1;
  }
  return nodes;
}

export function parseCss(text) {
  const errors = [];
  const src = String(text || '');
  const rules = parseRules(src, 0, src.length, errors);
  return { rules, errors };
}

// ------------------------------------------------------------ directives ----

const ICON_REQ = /\/\*\s*icon-request\s*:\s*([^|*]+?)\s*\|\s*([^*]*?)\s*\*\//gi;
const APPLY_CLASS = /\/\*\s*apply-class\s*:\s*([^|*]+?)\s*\|\s*([^*|]*?)\s*\*\//gi;

export function normalizeIconName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^--?icon-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function extractDirectives(text) {
  const iconRequests = [];
  const applyClass = [];
  const seen = new Set();
  let css = String(text || '');
  css = css.replace(ICON_REQ, (_m, name, desc) => {
    const n = normalizeIconName(name);
    if (n && !seen.has('i:' + n)) {
      seen.add('i:' + n);
      iconRequests.push({ name: n, description: desc.replace(/\s+/g, ' ').trim().slice(0, 160) });
    }
    return '';
  });
  css = css.replace(APPLY_CLASS, (_m, sel, cls) => {
    const selector = sel.trim();
    const className = cls.trim().replace(/^\./, '');
    if (selector && /^[\w-]+$/.test(className) && !seen.has('c:' + selector + '|' + className)) {
      seen.add('c:' + selector + '|' + className);
      applyClass.push({ selector, className });
    }
    return '';
  });
  // strip code fences / prose the model may add around the CSS
  css = css.replace(/```(?:css)?/gi, '');
  return { css, iconRequests, applyClass };
}

// ------------------------------------------------------------ selectors ----

export function splitSelectorList(sel) {
  const parts = [];
  let depth = 0;
  let str = null;
  let cur = '';
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (str) {
      cur += c;
      if (c === '\\') cur += sel[++i] || '';
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'") str = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    if (c === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
}

// Selector usable with querySelector: pseudo-elements and state pseudo-classes removed.
export function probeSelector(sel) {
  let p = sel.replace(PSEUDO_ELEMENT, '').replace(STATE_PSEUDO, '');
  p = p.replace(/:not\(\s*\)/g, '').trim();
  p = p.replace(/\s*>\s*$/, '').replace(/\s*[+~]\s*$/, '').trim();
  return p || '*';
}

function createMatcher(doc, protect) {
  const cache = new Map();
  return function match(part) {
    if (cache.has(part)) return cache.get(part);
    let res;
    if (!doc) res = { status: 'unknown', count: 1 };
    else if (protect.test(part)) res = { status: 'protected', count: 0 };
    else {
      const probe = probeSelector(part);
      try {
        const list = doc.querySelectorAll(probe);
        res = { status: list.length ? 'ok' : 'nomatch', count: list.length, probe };
      } catch {
        res = { status: 'invalid', count: 0, probe };
      }
    }
    cache.set(part, res);
    return res;
  };
}

function classifyTargets(doc, probes, limit = 60) {
  const info = { count: 0, landmark: false, interactive: false, textLength: 0, protected: false, media: false, mediaParent: false, flexGrid: false, root: false };
  if (!doc) return info;
  const win = doc.defaultView;
  const seen = new Set();
  let sampled = 0;
  for (const probe of probes) {
    let list;
    try {
      list = doc.querySelectorAll(probe);
    } catch {
      continue;
    }
    info.count += list.length;
    for (const el of list) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (++sampled > limit) break;
      if (LANDMARK_TAGS.has(el.localName) || el.getAttribute('role') === 'main') info.landmark = true;
      if (el.localName === 'html' || el.localName === 'body') info.root = true;
      if (INTERACTIVE.has(el.localName) || el.getAttribute('role') === 'button') info.interactive = true;
      if (el.querySelector && el.querySelector('a, button, input, select, textarea')) info.interactive = true;
      if (el.localName === 'retro-web-panel') info.protected = true;
      if (MEDIA_TAGS.has(el.localName)) info.media = true;
      else if (el.children && [...el.children].some((c) => MEDIA_TAGS.has(c.localName))) info.mediaParent = true;
      if (!info.flexGrid && win && sampled <= 40) {
        try {
          const d = win.getComputedStyle(el).display || '';
          if (/flex|grid|table/.test(d) && !/inline-block/.test(d)) info.flexGrid = true;
        } catch {
          /* ignore */
        }
      }
      info.textLength += (el.textContent || '').trim().length;
    }
  }
  // de-duplicate count across probes when sampling covered everything
  if (sampled <= limit) info.count = seen.size;
  return info;
}

// ----------------------------------------------------------- declarations ----

function clampNumbers(prop, value, specOverride = null) {
  let spec = specOverride;
  if (!spec) {
    for (const [re, s] of CLAMPS) {
      if (re.test(prop)) {
        spec = s;
        break;
      }
    }
  }
  if (!spec) return value;
  // Walk tokens, skipping strings, url(), var(), color functions and hex colors.
  let out = '';
  let i = 0;
  const s = value;
  const isDigitStart = (c) => /[0-9.]/.test(c);
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") {
      const j = s.indexOf(c, i + 1);
      const k = j < 0 ? s.length : j + 1;
      out += s.slice(i, k);
      i = k;
      continue;
    }
    const fn = /^(url|var|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|attr|counter|counters)\(/i.exec(s.slice(i));
    if (fn) {
      let depth = 0;
      let j = i;
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++;
        else if (s[j] === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      out += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '#') {
      const m = /^#[0-9a-fA-F]{3,8}/.exec(s.slice(i));
      const len = m ? m[0].length : 1;
      out += s.slice(i, i + len);
      i += len;
      continue;
    }
    const prevOk = i === 0 || /[\s,(/]/.test(s[i - 1]) || (s[i - 1] === '-' && (i === 1 || /[\s,(/]/.test(s[i - 2])));
    if ((isDigitStart(c) || (c === '-' && isDigitStart(s[i + 1] || ''))) && prevOk) {
      const m = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?([a-zA-Z%]*)/.exec(s.slice(i));
      if (m) {
        const num = parseFloat(m[0]);
        const unit = m[3].toLowerCase();
        const range = spec[unit];
        if (range && Number.isFinite(num)) {
          const clamped = Math.min(range[1], Math.max(range[0], num));
          out += (clamped === num ? m[0] : String(+clamped.toFixed(3)) + m[3]);
        } else out += m[0];
        i += m[0].length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

function hidingKind(prop, value) {
  const v = value.toLowerCase();
  if (prop === 'display' && v === 'none') return 'display:none';
  if (prop === 'visibility' && (v === 'hidden' || v === 'collapse')) return 'visibility:hidden';
  if (prop === 'opacity' && parseFloat(v) < 0.1) return 'opacity';
  if (prop === 'font-size' && /^0(px|em|rem|%|pt)?$/.test(v)) return 'font-size:0';
  if (prop === 'transform' && /scale\w*\(\s*0(\.0+)?\s*[,)]/.test(v)) return 'scale(0)';
  if ((prop === 'clip-path' || prop === 'clip') && !/none|unset|initial|url\(/.test(v)) return 'clip';
  if (prop === 'text-indent' && parseFloat(v) <= -500) return 'text-indent';
  if (/^(top|left|right|bottom)$/.test(prop) && parseFloat(v) <= -500) return 'offscreen';
  if (/^(width|height|max-width|max-height)$/.test(prop) && /^0(px|em|rem|%)?$/.test(v)) return 'zero-size';
  if (prop === 'content' && v === 'none') return 'content:none';
  return null;
}

function urlsAllowed(value) {
  let ok = true;
  value.replace(URL_RE, (_m, _q, url) => {
    if (!ALLOWED_URL.test(url.trim())) ok = false;
    return _m;
  });
  return ok;
}

function validateDeclaration(d, ctx, out) {
  const { prop } = d;
  let value = d.value;
  const drop = (reason) => {
    out.dropped.push({ selector: ctx.selector, prop, reason });
    return null;
  };
  if (BLOCKED_PROPS.has(prop)) return drop('blocked-property');
  if (value.length > 600) return drop('value-too-long');
  if (DANGEROUS_VALUE.test(value)) return drop('dangerous-value');
  if (/[{}]/.test(value)) return drop('malformed-value');
  if (!urlsAllowed(value)) return drop('external-url');
  if (ctx.fontFace && prop === 'src' && !/^\s*(url\(\s*['"]?data:|local\()/i.test(value)) return drop('external-font');
  if (prop === 'content' && /</.test(value) && !/^["']/.test(value)) return drop('malformed-value');

  // record var() usage
  for (const m of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
    out.varsUsed.add(m[1]);
    if (m[1].startsWith('--icon-')) out.iconVars.add(m[1]);
  }

  if (!ctx.keyframes && !ctx.fontFace) {
    const kind = ctx.pseudo ? null : hidingKind(prop, value);
    if (kind) {
      const t = ctx.targets();
      if (t.protected || t.landmark || t.interactive || t.count > 3 || t.textLength > 200) return drop('hides-content:' + kind);
    }
    if (prop === 'position') {
      const v = value.toLowerCase();
      const t = ctx.targets();
      if (t.protected) return drop('protected');
      // decorative pseudo-elements (overlays, badges) may be fixed/absolute on landmarks
      if (v === 'fixed' && (t.count > 3 || (t.landmark && !ctx.pseudo))) return drop('position-fixed-too-broad');
      if (v === 'absolute' && (t.count > 25 || (t.landmark && !ctx.pseudo))) return drop('position-absolute-too-broad');
    }
    if (prop === 'pointer-events' && /none/i.test(value) && !ctx.pseudo) {
      const t = ctx.targets();
      if (t.count > 20 || t.landmark || t.interactive) return drop('pointer-events-too-broad');
    }
    if (prop === 'overflow' || prop === 'overflow-y') {
      const t = ctx.targets();
      if (t.landmark && /hidden|clip/i.test(value) && /html|body/.test(ctx.selector)) return drop('overflow-hidden-on-root');
    }
  }
  // ---- layout guard rails: keep complex pages working ----
  if (!ctx.keyframes && !ctx.fontFace) {
    const isLayout = LAYOUT_PROPS.test(prop);
    const isSpacing = SPACING_PROPS.test(prop);
    const t = isLayout || isSpacing || /^(font-size|line-height|border(-(top|right|bottom|left))?(-width)?|content)$/.test(prop) ? ctx.targets() : null;
    if (t) {
      if (t.media && !MEDIA_SAFE.test(prop)) return drop('media-element');
      if (prop === 'content' && !/::?(before|after|marker)/.test(ctx.selector)) return drop('content-outside-pseudo');
      if (isLayout) {
        if (t.count > ctx.maxLayoutMatches) return drop('layout-too-broad');
        if (t.mediaParent && MEDIA_CONTAINER_RISKY.test(prop)) return drop('media-container');
        if (prop === 'display' && !ctx.pseudo) {
          const v = value.trim().toLowerCase();
          if (t.root && v !== 'block') return drop('display-on-root');
          if (t.flexGrid && !/^(flex|inline-flex|grid|inline-grid|contents|table.*)$/.test(v)) return drop('display-breaks-layout');
        }
      } else if (isSpacing) {
        if (t.count > ctx.maxSpacingMatches) return drop('spacing-too-broad');
        if (t.count > ctx.maxLayoutMatches) value = clampNumbers(prop, value, GENTLE_CLAMPS[prop.startsWith('margin') ? 'margin' : 'padding']);
      } else if (t.count > ctx.maxSpacingMatches) {
        if (prop === 'font-size') value = clampNumbers(prop, value, GENTLE_CLAMPS['font-size']);
        else if (prop === 'line-height') value = clampNumbers(prop, value, GENTLE_CLAMPS['line-height']);
        else if (prop.startsWith('border')) value = clampNumbers(prop, value, GENTLE_CLAMPS.border);
      }
    }
  }
  value = clampNumbers(prop, value);
  if (prop === 'z-index' && /^-?\d+$/.test(value) && parseInt(value, 10) > 2147483000) value = '2147483000';
  return { prop, value, important: ctx.forceImportant && !ctx.keyframes && !ctx.fontFace ? true : d.important };
}

// ----------------------------------------------------------------- main ----

function serializeDecls(decls) {
  return decls.map((d) => `${d.prop}: ${d.value}${d.important ? ' !important' : ''};`).join(' ');
}

export function validateCss(text, options = {}) {
  const { doc = null, mode = 'design', forceImportant = true, maxRules = 400, maxDecls = 60, allowUnmatched = false, maxLayoutMatches = 40, maxSpacingMatches = 150 } = options;
  const protect = options.protect || DEFAULT_PROTECT;
  const parsed = parseCss(String(text || '').replace(/```[a-z]*/gi, ''));
  const out = { css: '', kept: 0, dropped: [], warnings: [], iconVars: new Set(), varsUsed: new Set(), errors: parsed.errors, mode };
  const match = createMatcher(doc, protect);
  let ruleCount = 0;

  const handleRules = (nodes, inKeyframes, indent) => {
    const lines = [];
    for (const node of nodes) {
      if (ruleCount >= maxRules) {
        out.warnings.push('rule limit reached');
        break;
      }
      if (node.type === 'at') {
        const name = node.name;
        if (BLOCKED_AT.has(name) || node.statement) {
          out.dropped.push({ selector: '@' + name, reason: 'blocked-at-rule' });
          continue;
        }
        if (node.keyframes) {
          if (!/^[\w-]+$/.test(node.prelude)) {
            out.dropped.push({ selector: '@' + name, reason: 'bad-keyframes-name' });
            continue;
          }
          const body = handleRules(node.rules, true, indent + '  ');
          if (body.length) {
            lines.push(`${indent}@${name} ${node.prelude} {`, ...body, `${indent}}`);
            ruleCount++;
          }
          continue;
        }
        if (NESTED_AT.has(name)) {
          if (/url\(|expression|@import/i.test(node.prelude) || node.prelude.length > 200) {
            out.dropped.push({ selector: '@' + name, reason: 'bad-at-prelude' });
            continue;
          }
          const body = handleRules(node.rules, inKeyframes, indent + '  ');
          if (body.length) lines.push(`${indent}@${name} ${node.prelude} {`, ...body, `${indent}}`);
          continue;
        }
        if (name === 'font-face') {
          const ctx = { selector: '@font-face', fontFace: true, keyframes: false, forceImportant, targets: () => ({ count: 0 }) };
          const decls = node.declarations.map((d) => validateDeclaration(d, ctx, out)).filter(Boolean);
          if (decls.some((d) => d.prop === 'src') && decls.some((d) => d.prop === 'font-family')) {
            lines.push(`${indent}@font-face { ${serializeDecls(decls)} }`);
            ruleCount++;
          } else out.dropped.push({ selector: '@font-face', reason: 'font-face-needs-data-src' });
          continue;
        }
        out.dropped.push({ selector: '@' + name, reason: 'unknown-at-rule' });
        continue;
      }

      // plain rule
      let selectorParts;
      let probes = [];
      if (inKeyframes) {
        if (!/^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/i.test(node.selector)) {
          out.dropped.push({ selector: node.selector, reason: 'bad-keyframe-selector' });
          continue;
        }
        selectorParts = [node.selector];
      } else {
        const parts = splitSelectorList(node.selector);
        selectorParts = [];
        const reasons = new Set();
        for (const p of parts) {
          if (p.length > 300) {
            reasons.add('selector-too-long');
            continue;
          }
          const m = match(p);
          if (m.status === 'ok' || m.status === 'unknown' || (m.status === 'nomatch' && allowUnmatched)) {
            selectorParts.push(p);
            if (m.probe) probes.push(m.probe);
          } else reasons.add(m.status === 'nomatch' ? 'no-match' : m.status);
        }
        if (!selectorParts.length) {
          out.dropped.push({ selector: node.selector, reason: [...reasons].join(',') || 'no-selector' });
          continue;
        }
      }
      const selector = selectorParts.join(', ');
      let targetsCache = null;
      const ctx = {
        selector,
        keyframes: inKeyframes,
        fontFace: false,
        forceImportant,
        maxLayoutMatches,
        maxSpacingMatches,
        // every part targets a generated pseudo-element (decorations, not content)
        pseudo: !inKeyframes && selectorParts.every((p) => /::?(before|after|marker)(?![\w-])/.test(p)),
        targets: () => targetsCache || (targetsCache = classifyTargets(doc, probes.length ? probes : selectorParts.map(probeSelector), 400)),
      };
      if (node.declarations.length > maxDecls) out.warnings.push(`truncated declarations for ${selector}`);
      const decls = node.declarations.slice(0, maxDecls).map((d) => validateDeclaration(d, ctx, out)).filter(Boolean);
      if (!decls.length) {
        out.dropped.push({ selector, reason: 'no-valid-declarations' });
        continue;
      }
      lines.push(`${indent}${selector} { ${serializeDecls(decls)} }`);
      ruleCount++;
      out.kept++;
    }
    return lines;
  };

  out.css = handleRules(parsed.rules, false, '').join('\n');
  out.iconVars = [...out.iconVars];
  out.varsUsed = [...out.varsUsed];
  return out;
}

// Validates apply-class directives: the class must exist in the library and the
// selector must match something that is not protected or a landmark root.
export function validateApplyClass(list, { doc, classNames = [], protect = DEFAULT_PROTECT, maxTargets = 200 } = {}) {
  const applied = [];
  const dropped = [];
  const known = new Set(classNames);
  for (const item of list || []) {
    const { selector, className } = item;
    if (!known.has(className)) {
      dropped.push({ ...item, reason: 'unknown-class' });
      continue;
    }
    if (protect.test(selector) || /^(html|body)\b/.test(selector.trim())) {
      dropped.push({ ...item, reason: 'protected' });
      continue;
    }
    if (!doc) {
      applied.push({ ...item, count: 0 });
      continue;
    }
    let els;
    try {
      els = [...doc.querySelectorAll(probeSelector(selector))];
    } catch {
      dropped.push({ ...item, reason: 'invalid' });
      continue;
    }
    els = els.filter((e) => !e.closest('retro-web-panel') && !LANDMARK_TAGS.has(e.localName));
    if (!els.length) {
      dropped.push({ ...item, reason: 'no-match' });
      continue;
    }
    if (els.length > maxTargets) els = els.slice(0, maxTargets);
    applied.push({ ...item, count: els.length, elements: els });
  }
  return { applied, dropped };
}

export function applyClassDirectives(applied) {
  for (const a of applied) for (const el of a.elements || []) el.classList.add(a.className);
}

export function removeClassDirectives(applied) {
  for (const a of applied) for (const el of a.elements || []) el.classList.remove(a.className);
}
