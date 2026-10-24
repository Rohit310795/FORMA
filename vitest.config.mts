import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@forma/shared': path.resolve(__dirname, 'packages/shared/src/index.ts') },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'functions/test/**/*.test.ts', 'apps/mobile/test/**/*.test.ts'],
    exclude: ['**/*.rules.test.ts', '**/*.int.test.ts', '**/node_modules/**'],
    environment: 'node',
  },
});
