// Deterministic CSS fixes for issues the model failed to repair. Conservative:
// each rule targets the reported selector only. Output is validated before use.
import { parseColor, contrastRatio } from './inspect.js';

const BLOCKISH = new Set(['div', 'p', 'section', 'article', 'nav', 'header', 'footer', 'main', 'aside', 'ul', 'ol', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'figure', 'fieldset']);

function displayFor(selector, doc) {
  let tag = null;
  try {
    const el = doc && doc.querySelector(selector);
    tag = el && el.localName;
  } catch {
    /* ignore */
  }
  if (!tag) return 'block';
  if (tag === 'li') return 'list-item';
  if (tag === 'table') return 'table';
  if (tag === 'tr') return 'table-row';
  if (/^t[dh]$/.test(tag)) return 'table-cell';
  if (BLOCKISH.has(tag)) return 'block';
  return 'inline-block';
}

export function buildFallbackCss(issues, { doc } = {}) {
  const rules = [];
  const fixed = [];
  const seen = new Set();
  const push = (issue, css) => {
    if (seen.has(css)) return;
    seen.add(css);
    rules.push(css);
    fixed.push({ type: issue.type, selector: issue.selector });
  };
  let overflowRoot = false;
  for (const i of issues) {
    const sel = i.selector;
    switch (i.type) {
      case 'icon-off-center':
        if (i.background) push(i, `${sel} { background-position: 4px center; background-size: 16px 16px; padding-left: 24px; }`);
        else {
          const container = sel.replace(/\s*>\s*(svg|img)(:nth-of-type\(\d+\))?$/, '');
          if (container !== sel) push(i, `${container} { display: inline-flex; align-items: center; justify-content: center; gap: 6px; line-height: normal; }`);
          push(i, `${sel} { display: inline-block; vertical-align: middle; margin: 0; flex: none; }`);
        }
        break;
      case 'icon-overlaps-text':
        // make room for the icon; if the validator refuses the padding (too many
        // elements), loop.js removes the icon instead (see onDropped)
        push(i, `${sel} { padding-left: 24px; background-position: 4px center; background-size: 16px 16px; }`);
        break;
      case 'icon-duplicate':
        push(i, `${sel} { background-image: none; }`);
        break;
      case 'icon-missing':
        if (sel.startsWith('--icon-')) push(i, `:root { ${sel}: var(--icon-placeholder); }`);
        else if (/zero-size/.test(i.detail)) push(i, `${sel} { display: inline-block; width: 16px; height: 16px; min-width: 16px; min-height: 16px; }`);
        else if (/broken image/.test(i.detail)) push(i, `${sel} { background-image: var(--icon-placeholder); background-repeat: no-repeat; background-position: center; background-size: 16px 16px; min-width: 16px; min-height: 16px; }`);
        else push(i, `${sel} { background-image: var(--icon-placeholder); background-repeat: no-repeat; background-position: 4px center; background-size: 16px 16px; }`);
        break;
      case 'overflow-x':
        if (sel === 'html') {
          if (!overflowRoot) push(i, `html, body { overflow-x: hidden; max-width: 100%; }`);
          overflowRoot = true;
        } else push(i, `${sel} { max-width: 100%; box-sizing: border-box; overflow-wrap: anywhere; }`);
        break;
      case 'text-clipped':
        push(i, `${sel} { overflow: visible; white-space: normal; overflow-wrap: anywhere; height: auto; max-height: none; }`);
        break;
      case 'overlap':
        push(i, `${sel} { position: relative; transform: none; margin-bottom: 8px; clear: both; }`);
        break;
      case 'contrast-low': {
        // pick black or white, whichever contrasts more with the measured background
        const bg = parseColor(i.bg) || { r: 255, g: 255, b: 255, a: 1 };
        const black = contrastRatio({ r: 0, g: 0, b: 0 }, bg);
        const white = contrastRatio({ r: 255, g: 255, b: 255 }, bg);
        const color = black >= white ? '#000000' : '#ffffff';
        // if even the best text color is weak (mid-tone background), also fix the background
        const extra = Math.max(black, white) < 4.5 ? ` background-color: ${color === '#000000' ? '#ffffff' : '#000000'};` : '';
        push(i, `${sel} { color: ${color}; text-shadow: none;${extra} }`);
        break;
      }
      case 'font-too-small':
        push(i, `${sel} { font-size: 12px; }`);
        break;
      case 'invisible':
        if (sel === 'body') break;
        push(i, `${sel} { display: ${displayFor(sel, doc)}; visibility: visible; opacity: 1; width: auto; height: auto; min-width: 1em; min-height: 1em; position: static; clip-path: none; transform: none; font-size: 12px; }`);
        break;
      case 'edge-touch':
        push(i, `${sel} { padding-left: 8px; padding-right: 8px; }`);
        break;
      case 'spacing-inconsistent':
        // never impose spacing: uneven gaps are usually the page's design. The
        // geometry guard rolls back spacing we added; nothing to add here.
        break;
      case 'padding-collapsed':
        push(i, `${sel} { padding: 4px 8px; }`);
        break;
      case 'padding-excessive':
        push(i, `${sel} { padding-left: 16px; padding-right: 16px; }`);
        break;
      default:
        break;
    }
  }
  return { css: rules.join('\n'), fixed };
}
