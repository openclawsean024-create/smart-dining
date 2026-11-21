#!/usr/bin/env node
/**
 * 給 Playwright webServer 使用的 backend：暫存 SQLite＋seed 後常駐，收到 SIGTERM／SIGINT 時清理。
 *
 * 必要環境變數（由 playwright.config.ts 於執行時隨機產生後傳入，不寫死在 repo）：
 *   PORT、E2E_JWT_SECRET、E2E_STAFF_PASSWORD
 */
import { resolve } from 'node:path';
import { backendRoot, prepareDatabase, startServer, stopServer } from './lib/test-backend.mjs';

const port = Number(process.env.PORT);
const jwtSecret = process.env.E2E_JWT_SECRET;
const staffPassword = process.env.E2E_STAFF_PASSWORD;
if (!port || !jwtSecret || !staffPassword) {
  console.error('start-e2e-backend: PORT, E2E_JWT_SECRET and E2E_STAFF_PASSWORD are required');
  process.exit(2);
}

// 固定放在 repo 的 .e2e-tmp/（已列入 .gitignore），每次啟動先清空；
// 即使行程被強制結束來不及清理，也不會在系統暫存區留下一堆目錄。
const { env, cleanup } = prepareDatabase({
  port,
  jwtSecret,
  staffPassword,
  dir: resolve(backendRoot, '..', '.e2e-tmp', 'backend'),
  extraEnv: process.env.E2E_CORS_ORIGIN ? { CORS_ORIGIN: process.env.E2E_CORS_ORIGIN } : {},
});
const server = startServer(env, 'inherit');

let shuttingDown = false;
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopServer(server);
  cleanup();
  process.exit(code);
}
process.on('SIGTERM', () => void shutdown(0));
process.on('SIGINT', () => void shutdown(0));
server.on('exit', (code) => void shutdown(code ?? 1));
