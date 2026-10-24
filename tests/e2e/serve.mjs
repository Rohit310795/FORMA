// Minimal static server with SPA fallback for E2E runs: node tests/e2e/serve.mjs <dir> <port>
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [dir, port] = [path.resolve(process.argv[2]), Number(process.argv[3] || 8081)];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
http
  .createServer(async (req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(dir, url);
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      const html = path.join(dir, `${url}.html`);
      file = await stat(html).then(() => html, () => path.join(dir, 'index.html'));
    }
    try {
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`serving ${dir} on ${port}`));
