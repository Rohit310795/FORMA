// Bundles the functions (and the shared package) into lib/index.js so the
// deployed package doesn't depend on npm workspaces.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(dir, 'src/index.ts')],
  outfile: path.join(dir, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions', '@google-cloud/secret-manager'],
  alias: { '@forma/shared': path.join(dir, '../packages/shared/src/index.ts') },
  logLevel: 'info',
});
