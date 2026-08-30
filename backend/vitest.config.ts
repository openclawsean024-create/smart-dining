import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Minimal vitest config.
 *
 * Why we override defaults:
 * - The project's tsconfig has `rootDir: ".."` and `outDir: "./dist"`,
 *   which makes vitest's bundled TS resolver think source files compile
 *   into `dist/`. We point `resolve.alias` straight at the TS source so
 *   vitest reads the same files tsc reads, no stale build artifacts.
 * - We also drop the `.js` → `.ts` extension rewrite: tests can import
 *   either form and both land on `src/lib/verifyCode.ts`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      // Force every .js / .ts lookup under src/ back onto the TS source,
      // bypassing any outDir inference.
      {
        find: /^(\.\.?\/.*)\.js$/,
        replacement: '$1',
      },
    ],
  },
});
