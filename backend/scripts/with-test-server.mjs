#!/usr/bin/env node
/**
 * 以一次性的測試環境執行指令：
 *   1. 建立暫存 SQLite（prisma db push）並寫入示範資料（seed）
 *   2. 在空閒埠啟動 backend
 *   3. 執行傳入的指令（環境變數 API_BASE 指向該 backend；E2E_STAFF_PASSWORD 為本次隨機產生的示範員工密碼）
 *   4. 關閉 backend、刪除暫存檔，並以該指令的結束碼結束
 *
 * 用法：node scripts/with-test-server.mjs <command> [args...]
 * JWT_SECRET 與示範員工密碼每次隨機產生，不落地、不進版本庫。
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { freePort, prepareDatabase, startServer, stopServer, waitForHealth } from './lib/test-backend.mjs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-test-server.mjs <command> [args...]');
  process.exit(2);
}

let server;
let cleanup = () => {};
let exitCode = 1;
try {
  const port = await freePort();
  const apiBase = 'http://127.0.0.1:' + port;
  const staffPassword = randomBytes(18).toString('base64url');
  const prepared = prepareDatabase({
    port,
    jwtSecret: randomBytes(32).toString('hex'),
    staffPassword,
    extraEnv: { API_BASE: apiBase, E2E_STAFF_PASSWORD: staffPassword },
  });
  cleanup = prepared.cleanup;

  server = startServer(prepared.env);
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  try {
    await waitForHealth(apiBase, server);
  } catch (e) {
    console.error(serverLog.slice(-2000));
    throw e;
  }

  exitCode = await new Promise((res) => {
    const child = spawn(command, args, { env: prepared.env, stdio: 'inherit' });
    child.on('error', (e) => { console.error(e.message); res(127); });
    child.on('exit', (code, signal) => res(code ?? (signal ? 1 : 0)));
  });
} catch (e) {
  console.error('[with-test-server] ' + (e?.message || e));
  exitCode = 1;
} finally {
  await stopServer(server);
  cleanup();
}
process.exit(exitCode);
