/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest configuration.
 *
 * - `jsdom` environment: most components and hooks here read from window/document.
 * - `setupFiles`: pulls in jest-dom matchers (toBeInTheDocument, toHaveClass, etc.).
 * - `globals: true`: lets tests use `describe`/`it`/`expect` without imports.
 * - The `@` alias matches tsconfig.json so test files can import the same way
 *   as production code.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'app/**/*.tsx'],
      exclude: ['**/*.d.ts', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
