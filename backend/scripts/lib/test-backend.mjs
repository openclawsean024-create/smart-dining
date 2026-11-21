/**
 * 一次性的測試 backend：暫存 SQLite＋seed＋啟動 server。
 * with-test-server.mjs（API 腳本用）與 start-e2e-backend.mjs（Playwright 用）共用。
 *
 * JWT secret 與示範員工密碼由呼叫端傳入（都是執行時隨機產生），不落地、不進版本庫。
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = (name) => resolve(backendRoot, '..', 'node_modules', '.bin', name);

export function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

/**
 * 建立暫存資料庫並 seed。回傳啟動 server 需要的環境變數與清理函式。
 */
export function prepareDatabase({ port, jwtSecret, staffPassword, extraEnv = {}, dir }) {
  // dir：固定的暫存目錄（每次先清空再建立）；未指定時用系統暫存區的隨機目錄
  let tmp;
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    tmp = dir;
  } else {
    tmp = mkdtempSync(join(tmpdir(), 'smart-dining-e2e-'));
  }
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: 'file:' + join(tmp, 'e2e.db'),
    JWT_SECRET: jwtSecret,
    PORT: String(port),
    OTP_PROVIDER: 'mock', // 一次性隨機驗證碼；腳本從 login 回應的 code 取得
    OTP_EXPOSE_HINT: '1',
    SEED_STAFF_PASSWORD: staffPassword,
    ...extraEnv,
  };
  const cleanup = () => rmSync(tmp, { recursive: true, force: true });
  try {
    execFileSync(bin('prisma'), ['db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'], {
      cwd: backendRoot, env, stdio: 'pipe',
    });
    execFileSync(bin('tsx'), ['src/seed.ts'], { cwd: backendRoot, env, stdio: 'pipe' });
  } catch (e) {
    cleanup();
    throw new Error('failed to prepare test database: ' + (e?.stderr?.toString?.() || e?.message || e));
  }
  return { env, cleanup };
}

export function startServer(env, stdio = ['ignore', 'pipe', 'pipe']) {
  return spawn(bin('tsx'), ['src/server.ts'], { cwd: backendRoot, env, stdio });
}

export async function waitForHealth(base, child, timeoutMs = 30_000) {
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

export function stopServer(server) {
  if (!server || server.exitCode !== null) return Promise.resolve();
  server.kill('SIGTERM');
  return new Promise((r) => {
    server.on('exit', r);
    setTimeout(r, 3000);
  });
}
