import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared/fees': path.resolve(__dirname, '../../packages/shared/fees.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
