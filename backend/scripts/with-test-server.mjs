#!/usr/bin/env node
/**
 * 以一次性的測試環境執行指令：
 *   1. 建立暫存 SQLite（prisma db push）並寫入示範資料（seed）
 *   2. 在空閒埠啟動 backend
 *   3. 執行傳入的指令（環境變數 API_BASE 指向該 backend）
 *   4. 關閉 backend、刪除暫存檔，並以該指令的結束碼結束
 *
 * 用法：node scripts/with-test-server.mjs <command> [args...]
 * JWT_SECRET 每次隨機產生，不落地、不進版本庫。
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-test-server.mjs <command> [args...]');
  process.exit(2);
}

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bin = (name) => resolve(backendRoot, '..', 'node_modules', '.bin', name);

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

async function waitForHealth(base, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('backend exited early with code ' + child.exitCode);
    try {
      const r = await fetch(base + '/healthz');
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('backend did not become healthy within ' + timeoutMs + 'ms');
}

const tmp = mkdtempSync(join(tmpdir(), 'smart-dining-e2e-'));
const port = await freePort();
const apiBase = 'http://127.0.0.1:' + port;
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: 'file:' + join(tmp, 'e2e.db'),
  JWT_SECRET: randomBytes(32).toString('hex'),
  PORT: String(port),
  OTP_PROVIDER: 'dev',
  API_BASE: apiBase,
};

let server;
let exitCode = 1;
try {
  execFileSync(bin('prisma'), ['db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'], {
    cwd: backendRoot, env, stdio: 'pipe',
  });
  execFileSync(bin('tsx'), ['src/seed.ts'], { cwd: backendRoot, env, stdio: 'pipe' });

  server = spawn(bin('tsx'), ['src/server.ts'], { cwd: backendRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const child = spawn(command, args, { env, stdio: 'inherit' });
    child.on('error', (e) => { console.error(e.message); res(127); });
    child.on('exit', (code, signal) => res(code ?? (signal ? 1 : 0)));
  });
} catch (e) {
  console.error('[with-test-server] ' + (e?.stderr?.toString?.() || e?.message || e));
  exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((r) => { server.on('exit', r); setTimeout(r, 3000); });
  }
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(exitCode);
