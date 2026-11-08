// Tiny static server for the model host page (no dependencies).
//   npm run host          -> http://localhost:4173/
//   PORT=5000 npm run host
//
// Besides dist/host/ it serves the built bundle so a remote dev box (Codespaces,
// a VM) can feed Tampermonkey directly:
//   /retro.user.js          the userscript bundle
//   /retro.remote.user.js   a stub whose @require points back at this server's public URL
//   /retro.lib.js           the harness library
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const root = path.join(dist, 'host');
const header = fs.readFileSync(path.join(here, '..', 'header.txt'), 'utf8').trim();

// Public base URL of this server as seen by the browser (Codespaces/VS Code
// forwarding sets x-forwarded-* headers; otherwise fall back to the Host header).
function publicBase(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${port}`;
  const proto = req.headers['x-forwarded-proto'] || (/\.(app\.github\.dev|githubpreview\.dev|gitpod\.io)$/.test(host.split(':')[0]) ? 'https' : 'http');
  return `${proto}://${host}`;
}

function remoteStub(base) {
  return (
    header
      .replace('@name         retro-web', '@name         retro-web (remote dev)')
      .replace(/\/\/ @(downloadURL|updateURL)[^\n]*\n/g, '')
      .replace(/\/\/ ==\/UserScript==/, `// @require      ${base}/retro.user.js?t=${Date.now()}\n// ==/UserScript==`) +
    `\n\n// Loaded from ${base}/retro.user.js via @require above. Set Tampermonkey's Externals update\n// interval to "Always" so rebuilds are picked up; set the panel's Host URL to ${base}/\n`
  );
}
const port = Number(process.env.PORT || 4173);
const hostName = process.env.HOST || '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

export function createHostServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/retro.remote.user.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(remoteStub(publicBase(req)));
      return;
    }
    if (url.pathname === '/retro.user.js' || url.pathname === '/retro.lib.js') {
      fs.readFile(path.join(dist, url.pathname.slice(1)), (err, data) => {
        if (err) return res.writeHead(404, { 'content-type': 'text/plain' }).end('not built — run `npm run build`');
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache', 'access-control-allow-origin': '*' });
        res.end(data);
      });
      return;
    }
    let file = path.normalize(path.join(root, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': types[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-cache',
        // WebGPU does not need cross-origin isolation; WebLLM's optional
        // multi-threaded paths are not used here.
        'access-control-allow-origin': '*',
      });
      res.end(data);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(path.join(root, 'host.js'))) {
    console.error('dist/host/host.js missing — run `npm run build` first.');
    process.exit(1);
  }
  createHostServer().listen(port, hostName, () => {
    console.log(`[retro-web] model host at http://localhost:${port}/  (serving ${root})`);
    console.log(`[retro-web] userscript at http://localhost:${port}/retro.user.js · remote stub at /retro.remote.user.js`);
    if (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
      const pub = `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
      console.log(`[retro-web] Codespaces: make port ${port} Public, then install ${pub}/retro.remote.user.js and set Host URL = ${pub}/`);
    }
  });
}
