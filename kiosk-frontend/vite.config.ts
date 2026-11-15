import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
  },
  // 元件測試(vitest + jsdom + Testing Library)
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // 測試直接讀 shared-contracts 的 TS 原始檔,不依賴先 build 出 dist
    alias: {
      '@smart-dining/contracts': fileURLToPath(new URL('../shared-contracts/src/index.ts', import.meta.url)),
    },
  },
});
