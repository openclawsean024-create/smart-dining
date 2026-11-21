/**
 * Playwright E2E 設定（設定模式參考 pos-multitrade/playwright.config.ts；SPEC §12.1 #13）。
 *
 * 會自動啟動三個服務（使用專用埠，不與本機開發用的 4000／5173／5174 衝突）：
 *   - backend      :4100（暫存 SQLite＋seed，結束後刪除）
 *   - kiosk-frontend :5273（/api、/socket.io 代理到上面的 backend）
 *   - mobile-app     :5274（同上）
 *
 * JWT secret 與示範員工密碼在每次執行時隨機產生，只存在於這次執行的環境變數。
 * 前置：`npm run build -w @smart-dining/contracts`（前端 dev server 讀 contracts 的 dist）。
 */
import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const BACKEND_PORT = 4100;
const KIOSK_PORT = 5273;
const MOBILE_PORT = 5274;

// worker 行程會繼承主行程的環境變數，所以只有第一次載入設定檔時會產生
process.env.E2E_STAFF_PASSWORD ??= randomBytes(18).toString('base64url');
process.env.E2E_JWT_SECRET ??= randomBytes(32).toString('hex');

export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
export const KIOSK_URL = `http://127.0.0.1:${KIOSK_PORT}`;
export const MOBILE_URL = `http://127.0.0.1:${MOBILE_PORT}`;

process.env.E2E_BACKEND_URL = BACKEND_URL;
process.env.E2E_KIOSK_URL = KIOSK_URL;
process.env.E2E_MOBILE_URL = MOBILE_URL;

const viteEnv = { VITE_PROXY_TARGET: BACKEND_URL };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'retain-on-failure',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node backend/scripts/start-e2e-backend.mjs',
      url: BACKEND_URL + '/healthz',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(BACKEND_PORT),
        E2E_CORS_ORIGIN: `${KIOSK_URL},${MOBILE_URL}`,
      },
    },
    {
      command: `npx vite --port ${KIOSK_PORT} --strictPort --host 127.0.0.1`,
      cwd: './kiosk-frontend',
      url: KIOSK_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: viteEnv,
    },
    {
      command: `npx vite --port ${MOBILE_PORT} --strictPort --host 127.0.0.1`,
      cwd: './mobile-app',
      url: MOBILE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: viteEnv,
    },
  ],
});
