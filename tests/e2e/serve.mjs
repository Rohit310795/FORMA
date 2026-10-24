// Minimal static server with SPA fallback for E2E runs: node tests/e2e/serve.mjs <dir> <port>
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [dir, port] = [path.resolve(process.argv[2]), Number(process.argv[3] || 8081)];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const isFile = (p) => stat(p).then((s) => s.isFile(), () => false);

async function resolve(url) {
  const base = path.join(dir, url);
  if (!base.startsWith(dir)) return undefined;
  for (const candidate of [base, `${base}.html`, path.join(base, 'index.html')]) if (await isFile(candidate)) return candidate;
  return path.join(dir, 'index.html'); // SPA fallback
}

http
  .createServer(async (req, res) => {
    const file = await resolve(decodeURIComponent((req.url || '/').split('?')[0]));
    if (!file) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`serving ${dir} on ${port}`));
