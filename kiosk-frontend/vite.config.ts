import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 啟動時就預先打包這些依賴；避免第一次進到某頁（例如 KDS 的 socket.io-client）時
  // Vite 才發現新依賴而整頁重新載入（冷啟動的 E2E 會因此不穩定）
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'zustand', 'zustand/middleware', 'swr', 'clsx', 'qrcode', 'socket.io-client'],
  },
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
