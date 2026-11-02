import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svgToDataUri } from './userscript/src/util/svg-data-uri.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Mirror of the esbuild asset-inliner so tests import the same library.css.
const LIB = path.join(here, 'userscript/src/assets/library.css');
const VIRTUAL = '\0retro-library-css';
const assetInliner = {
  name: 'retro-asset-inliner',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!source.endsWith('library.css') || !importer) return null;
    const abs = path.resolve(path.dirname(importer), source);
    return abs === LIB ? VIRTUAL : null;
  },
  load(id) {
    if (id !== VIRTUAL) return null;
    const dir = path.dirname(LIB);
    let css = fs.readFileSync(LIB, 'utf8');
    css = css.replace(/svg\(\s*["']?([^"')]+?\.svg)["']?\s*\)/g, (_m, rel) => `url("${svgToDataUri(fs.readFileSync(path.join(dir, rel), 'utf8'))}")`);
    return `export default ${JSON.stringify(css)};`;
  },
};

export default defineConfig({
  plugins: [assetInliner],
  test: {
    environment: 'jsdom',
    include: ['userscript/test/**/*.test.js'],
    root: here,
  },
});
