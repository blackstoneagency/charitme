import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared/fees': path.resolve(__dirname, '../../packages/shared/fees.ts'),
      '@shared/entitlements': path.resolve(__dirname, '../../packages/shared/entitlements.ts'),
      // `server-only` throws when imported outside a React Server Component.
      // Stub it in tests so server modules can be imported directly.
      'server-only': path.resolve(__dirname, 'test-stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
