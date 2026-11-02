// Loads dist/retro.lib.js (an IIFE exposing RetroWebLib) into Node, with or
// without a jsdom window. Used by the CLIs shared with training/ and eval/.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const LIB_PATH = path.join(here, '..', 'dist', 'retro.lib.js');

export function loadLib(context = {}) {
  if (!fs.existsSync(LIB_PATH)) throw new Error('dist/retro.lib.js missing — run `npm run build`');
  const code = fs.readFileSync(LIB_PATH, 'utf8');
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, ...context });
  vm.runInContext(code + '\n;globalThis.__lib = RetroWebLib;', ctx);
  return ctx.__lib;
}

// Lib bound to a jsdom window so DOM-dependent functions (validateCss,
// summarizePage without layout) work on an HTML string.
export async function loadLibWithDom(html, url = 'http://localhost/') {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const w = dom.window;
  const lib = loadLib({ window: w, document: w.document, CSS: w.CSS, DOMParser: w.DOMParser, XMLSerializer: w.XMLSerializer, Node: w.Node, navigator: w.navigator, performance: w.performance, getComputedStyle: w.getComputedStyle.bind(w) });
  return { lib, dom, document: w.document };
}

export function readJsonLines(file) {
  const text = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}
