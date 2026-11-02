import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_CSS, MANIFEST, manifestToPrompt, libraryVarNames, libraryClassNames, estimateTokens } from '../src/assets/index.js';
import { parseCss } from '../src/validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'src', 'assets');

describe('asset library and manifest', () => {
  it('inlines every asset as a data URI (no svg() macros, no external urls)', () => {
    expect(LIBRARY_CSS).not.toMatch(/svg\(/);
    expect(LIBRARY_CSS).not.toMatch(/url\(\s*["']?https?:/);
    expect(LIBRARY_CSS).toMatch(/--icon-home:\s*url\("data:image\/svg\+xml,/);
  });
  it('every custom property in library.css is listed in the manifest and vice versa', () => {
    const { rules } = parseCss(LIBRARY_CSS);
    const root = rules.find((r) => r.type === 'rule' && r.selector === ':root');
    const defined = new Set(root.declarations.map((d) => d.prop));
    const listed = libraryVarNames();
    for (const v of listed) expect(defined.has(v), `manifest lists ${v} but library.css does not define it`).toBe(true);
    for (const v of defined) expect(listed.has(v), `library.css defines ${v} but manifest does not list it`).toBe(true);
  });
  it('every component class in library.css is listed in the manifest and vice versa', () => {
    const { rules } = parseCss(LIBRARY_CSS);
    const classes = new Set();
    for (const r of rules) if (r.type === 'rule') for (const m of r.selector.matchAll(/\.([a-zA-Z][\w-]*)/g)) classes.add(m[1]);
    const listed = new Set(libraryClassNames());
    for (const c of listed) expect(classes.has(c), `manifest lists .${c} but library.css has no rule for it`).toBe(true);
    for (const c of classes) expect(listed.has(c), `library.css styles .${c} but manifest does not list it`).toBe(true);
  });
  it('every svg file on disk is used by library.css', () => {
    for (const dir of ['icons', 'backgrounds', 'cursors']) {
      for (const f of fs.readdirSync(path.join(assets, dir))) {
        const src = fs.readFileSync(path.join(assets, 'library.css'), 'utf8');
        expect(src.includes(`${dir}/${f}`), `${dir}/${f} is not referenced by library.css`).toBe(true);
      }
    }
  });
  it('manifest prompt fits the default budget', () => {
    const p = manifestToPrompt();
    expect(estimateTokens(p)).toBeLessThanOrEqual(700);
    expect(p).toContain('--icon-NAME');
    expect(MANIFEST.icons.length).toBeGreaterThan(30);
  });
  it('library css parses without errors', () => {
    const { errors } = parseCss(LIBRARY_CSS);
    expect(errors).toEqual([]);
  });
});
