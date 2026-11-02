// Tiny static server for the model host page (no dependencies).
//   npm run host          -> http://localhost:4173/
//   PORT=5000 npm run host
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', 'dist', 'host');
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
  });
}
