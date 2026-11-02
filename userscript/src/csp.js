// Detects what the page's Content Security Policy (or the browser) blocks so
// the rest of the script can degrade instead of crashing.

export function createCspMonitor(doc = document) {
  const blocked = new Set();
  const listener = (e) => {
    const d = (e.effectiveDirective || e.violatedDirective || '').split(' ')[0];
    if (d) blocked.add(d);
  };
  try {
    doc.addEventListener('securitypolicyviolation', listener);
  } catch {
    /* ignore */
  }
  return {
    blocked,
    has(directive) {
      return blocked.has(directive);
    },
    dispose() {
      try {
        doc.removeEventListener('securitypolicyviolation', listener);
      } catch {
        /* ignore */
      }
    },
  };
}

export function canUseAdoptedStyleSheets(doc = document) {
  try {
    return (
      'adoptedStyleSheets' in doc &&
      typeof CSSStyleSheet === 'function' &&
      typeof CSSStyleSheet.prototype.replaceSync === 'function'
    );
  } catch {
    return false;
  }
}

// Inserts a throwaway <style> and checks whether it took effect. Inline style
// elements are blocked by `style-src` policies without 'unsafe-inline'.
export function probeInlineStyle(doc = document) {
  try {
    const root = doc.head || doc.documentElement;
    const probe = doc.createElement('retro-web-probe');
    const style = doc.createElement('style');
    style.textContent = 'retro-web-probe{position:absolute;left:-7777px}';
    root.appendChild(style);
    root.appendChild(probe);
    const ok = !!style.sheet && getComputedStyle(probe).left === '-7777px';
    style.remove();
    probe.remove();
    return ok;
  } catch {
    return false;
  }
}

export function hasWebGPU() {
  try {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  } catch {
    return false;
  }
}

export function describeEnvironment(doc = document) {
  return {
    adoptedStyleSheets: canUseAdoptedStyleSheets(doc),
    inlineStyle: probeInlineStyle(doc),
    webgpu: hasWebGPU(),
  };
}
