// esbuild bundler for retro-web.
//   node userscript/build.mjs          one-shot build
//   node userscript/build.mjs --watch  rebuild on change
//
// Outputs (all under userscript/dist/):
//   retro.user.js        the Tampermonkey userscript (header from header.txt)
//   retro.dev.user.js    dev stub with a file:// @require pointing at THIS checkout (git-ignored)
//   retro.lib.js         IIFE library (global RetroWebLib) for Playwright/eval/training
//   host/index.html      model host page
//   host/host.js         model host bundle (includes WebLLM)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { svgToDataUri } from './src/util/svg-data-uri.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const watch = process.argv.includes('--watch');
const header = fs.readFileSync(path.join(here, 'header.txt'), 'utf8').trim();

fs.mkdirSync(path.join(dist, 'host'), { recursive: true });

// Inline `svg("relative/path.svg")` macros in library.css as data URIs.
const assetInliner = {
  name: 'retro-asset-inliner',
  setup(build) {
    build.onLoad({ filter: /assets[\\/]library\.css$/ }, async (args) => {
      const dir = path.dirname(args.path);
      const watchFiles = [args.path];
      let css = await fs.promises.readFile(args.path, 'utf8');
      css = css.replace(/svg\(\s*["']?([^"')]+?\.svg)["']?\s*\)/g, (_m, rel) => {
        const file = path.join(dir, rel);
        watchFiles.push(file);
        const uri = svgToDataUri(fs.readFileSync(file, 'utf8'));
        if (!uri) throw new Error(`Not an SVG: ${file}`);
        return `url("${uri}")`;
      });
      return { contents: css, loader: 'text', watchFiles };
    });
  },
};

const common = {
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'firefox115'],
  legalComments: 'none',
  logLevel: 'info',
  plugins: [assetInliner],
  loader: { '.svg': 'text', '.txt': 'text', '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
};

const userscript = {
  ...common,
  entryPoints: [path.join(here, 'src/index.js')],
  outfile: path.join(dist, 'retro.user.js'),
  banner: { js: header + '\n' },
  minify: false,
};

const lib = {
  ...common,
  entryPoints: [path.join(here, 'src/lib.js')],
  outfile: path.join(dist, 'retro.lib.js'),
  globalName: 'RetroWebLib',
  minify: false,
};

const host = {
  ...common,
  entryPoints: [path.join(here, 'host/host.js')],
  outfile: path.join(dist, 'host/host.js'),
  minify: true,
  sourcemap: false,
};

function writeDevStub() {
  const abs = path.join(dist, 'retro.user.js');
  const stub = header
    .replace('@name         retro-web', '@name         retro-web (dev)')
    .replace(/\/\/ ==\/UserScript==/, `// @require      ${pathToFileURL(abs).href}\n// ==/UserScript==`);
  fs.writeFileSync(path.join(dist, 'retro.dev.user.js'), stub + '\n\n// Loaded from dist/retro.user.js via @require above.\n');
}

function copyHostHtml() {
  fs.copyFileSync(path.join(here, 'host/index.html'), path.join(dist, 'host/index.html'));
}

async function run() {
  copyHostHtml();
  writeDevStub();
  if (watch) {
    const ctxs = await Promise.all([userscript, lib, host].map((o) => esbuild.context(o)));
    await Promise.all(ctxs.map((c) => c.watch()));
    fs.watch(path.join(here, 'host/index.html'), () => copyHostHtml());
    console.log('[retro-web] watching…');
  } else {
    await Promise.all([userscript, lib, host].map((o) => esbuild.build(o)));
    const size = (f) => (fs.statSync(path.join(dist, f)).size / 1024).toFixed(1) + ' KB';
    console.log(`[retro-web] retro.user.js ${size('retro.user.js')}, retro.lib.js ${size('retro.lib.js')}, host/host.js ${size('host/host.js')}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
