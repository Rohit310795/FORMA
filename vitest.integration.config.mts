import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@forma/shared': path.resolve(__dirname, 'packages/shared/src/index.ts') } },
  test: {
    include: ['tests/integration/**/*.int.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      GCLOUD_PROJECT: 'demo-forma',
      FUNCTIONS_EMULATOR: 'true',
      FORMA_USAGE_HASH_SALT: 'test-salt',
    },
  },
});
