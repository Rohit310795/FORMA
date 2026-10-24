// Assembles the single Firebase Hosting site:
//   /         → mobile app web build (apps/mobile/dist)
//   /admin/*  → admin console static export (apps/admin/out)
// Run after `npm run build:mobile:web` and `npm run build:admin`.
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'hosting');
const mobile = path.join(root, 'apps/mobile/dist');
const admin = path.join(root, 'apps/admin/out');
for (const dir of [mobile, admin]) if (!existsSync(dir)) throw new Error(`Missing build output: ${dir}`);

rmSync(out, { recursive: true, force: true });
cpSync(mobile, out, { recursive: true });
// The admin export's own root pages would clash with the app's; everything else is namespaced.
const skip = new Set(['index.html', 'index.txt', '404.html', '404', 'favicon.ico', '_not-found.html', '_not-found.txt', '_not-found']);
for (const entry of readdirSync(admin)) {
  if (skip.has(entry) || entry.startsWith('__next.')) continue;
  if (existsSync(path.join(out, entry))) throw new Error(`Hosting path clash: ${entry}`);
  cpSync(path.join(admin, entry), path.join(out, entry), { recursive: true });
}
console.log(`Hosting site assembled in ${path.relative(root, out)}/`);
