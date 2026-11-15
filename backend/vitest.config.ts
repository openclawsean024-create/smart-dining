import { defineConfig } from 'vitest/config';

/**
 * Vitest 設定。
 *
 * - tsconfig 的 rootDir 為 ".."、outDir 為 "./dist"；以 alias 把 `.js` 匯入導回 TS 原始檔，
 *   避免讀到過期的 build 產物。
 * - globalSetup 建立測試用 SQLite 範本；setupFiles 在每個測試檔載入前設定環境變數。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setupEnv.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: [
      {
        find: /^(\.\.?\/.*)\.js$/,
        replacement: '$1',
      },
    ],
  },
});
