import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      // One rule rather than a module-by-module list. The list had two entries
      // and `@shared/currencies` was not one of them, so a test importing it
      // failed to resolve — the shared package's currency logic was simply
      // untestable, and nobody found out until a test tried.
      { find: /^@shared\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/shared/$1.ts') },
      // `server-only` throws when imported outside a React Server Component.
      // Stub it in tests so server modules can be imported directly.
      { find: 'server-only', replacement: path.resolve(__dirname, 'test-stubs/server-only.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
