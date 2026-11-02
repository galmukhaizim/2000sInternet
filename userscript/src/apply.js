// Applies CSS to the page in a CSP-resistant way.
//
// Preferred: constructed stylesheets (document.adoptedStyleSheets), which
// `style-src` policies do not govern. Fallback: a <style> element. Each "slot"
// owns one sheet; slots are created in cascade order so later slots win ties.
import { canUseAdoptedStyleSheets } from './csp.js';

export class StyleSlot {
  constructor(doc, name, { forceElement = false } = {}) {
    this.doc = doc;
    this.name = name;
    this.css = '';
    this.mode = 'blocked';
    this.sheet = null;
    this.el = null;
    if (!forceElement && canUseAdoptedStyleSheets(doc)) {
      try {
        this.sheet = new CSSStyleSheet();
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, this.sheet];
        this.mode = 'adopted';
      } catch {
        this.sheet = null;
      }
    }
    if (!this.sheet) {
      try {
        const el = doc.createElement('style');
        el.setAttribute('data-retro-web', name);
        (doc.head || doc.documentElement).appendChild(el);
        this.el = el;
        this.mode = 'element';
      } catch {
        this.mode = 'blocked';
      }
    }
  }

  set(css) {
    this.css = String(css || '');
    if (this.mode === 'adopted') {
      try {
        this.sheet.replaceSync(this.css);
        return true;
      } catch (e) {
        console.warn('[retro-web] replaceSync failed for', this.name, e);
        return false;
      }
    }
    if (this.mode === 'element') {
      this.el.textContent = this.css;
      // When CSP blocks the inline style, Chrome leaves `sheet` null.
      if (this.css && !this.el.sheet) {
        this.mode = 'blocked';
        return false;
      }
      return true;
    }
    return false;
  }

  append(css) {
    return this.set(this.css + '\n' + css);
  }

  clear() {
    return this.set('');
  }

  get ruleCount() {
    try {
      const sheet = this.mode === 'adopted' ? this.sheet : this.el && this.el.sheet;
      return sheet ? sheet.cssRules.length : 0;
    } catch {
      return 0;
    }
  }

  get working() {
    return this.mode !== 'blocked';
  }

  dispose() {
    try {
      if (this.mode === 'adopted') {
        this.doc.adoptedStyleSheets = this.doc.adoptedStyleSheets.filter((s) => s !== this.sheet);
      } else if (this.el) {
        this.el.remove();
      }
    } catch {
      /* ignore */
    }
  }
}

// Cascade order matters: library < icons < design < patches < fallbacks < panel.
export const SLOT_ORDER = ['library', 'icons', 'design', 'patch', 'fallback', 'panel'];

export function createSlots(doc = document) {
  const slots = {};
  for (const name of SLOT_ORDER) slots[name] = new StyleSlot(doc, name);
  slots.working = () => SLOT_ORDER.every((n) => slots[n].working);
  slots.disposeAll = () => SLOT_ORDER.forEach((n) => slots[n].dispose());
  return slots;
}

// Incrementally extracts complete top-level CSS rules from a growing stream so
// they can be validated and applied while the model is still generating.
export class RuleStreamer {
  constructor() {
    this.buffer = '';
    this.flushedUpTo = 0;
  }

  // Returns the newly completed chunk of CSS (may be empty).
  push(delta) {
    this.buffer += delta;
    let depth = 0;
    let inStr = null;
    let inComment = false;
    let lastComplete = this.flushedUpTo;
    for (let i = this.flushedUpTo; i < this.buffer.length; i++) {
      const c = this.buffer[i];
      const n = this.buffer[i + 1];
      if (inComment) {
        if (c === '*' && n === '/') {
          inComment = false;
          i++;
          if (depth === 0) lastComplete = i + 1;
        }
        continue;
      }
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '/' && n === '*') {
        inComment = true;
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        inStr = c;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth = Math.max(0, depth - 1);
        if (depth === 0) lastComplete = i + 1;
      }
    }
    if (lastComplete > this.flushedUpTo) {
      const chunk = this.buffer.slice(this.flushedUpTo, lastComplete);
      this.flushedUpTo = lastComplete;
      return chunk;
    }
    return '';
  }

  // Everything, including an unterminated tail (dropped by the validator if malformed).
  rest() {
    const chunk = this.buffer.slice(this.flushedUpTo);
    this.flushedUpTo = this.buffer.length;
    return chunk;
  }
}
