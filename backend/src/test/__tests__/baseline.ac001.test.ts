/**
 * AC-001：基線與 CI 擋錯。
 * - test-api.sh 遇到 404／500 必須以非 0 結束
 * - npm scripts 指到存在的檔案、fastify-plugin 列入依賴
 * - CI 的 lint／test／build／e2e 不得使用 continue-on-error
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { BACKEND_ROOT, REPO_ROOT } from '../paths.js';
import { createTestApp, listen, type TestApp } from '../helpers.js';
import { seedDatabase } from '../../seedData.js';

function runScript(cmd: string, args: string[], env: Record<string, string>) {
  return new Promise<{ code: number | null; output: string }>((res) => {
    const child = spawn(cmd, args, {
      cwd: BACKEND_ROOT,
      env: { ...process.env, PATH: dirname(process.execPath) + ':' + (process.env.PATH ?? ''), ...env },
    });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('exit', (code) => res({ code, output }));
  });
}

function stubServer(status: number): Promise<{ server: Server; base: string }> {
  return new Promise((res) => {
    const server = createServer((_req, reply) => {
      reply.writeHead(status, { 'content-type': 'application/json' });
      reply.end(JSON.stringify({ error: 'stub ' + status }));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('no address');
      res({ server, base: 'http://127.0.0.1:' + addr.port });
    });
  });
}

describe('AC-001 test-api.sh 擋錯', () => {
  let stub: Server | undefined;
  let testApp: TestApp | undefined;

  afterEach(async () => {
    await new Promise<void>((r) => (stub ? stub.close(() => r()) : r()));
    stub = undefined;
    await testApp?.close();
    testApp = undefined;
  });

  it('AC-001 API 全部回 404 時 test-api.sh 以非 0 結束', async () => {
    const s = await stubServer(404);
    stub = s.server;
    const { code, output } = await runScript('bash', ['scripts/test-api.sh'], { API_BASE: s.base });
    expect(code).not.toBe(0);
    expect(output).toContain('FAIL');
    expect(output).toContain('API SMOKE TEST FAILED');
  });

  it('AC-001 API 全部回 500 時 test-api.sh 以非 0 結束', async () => {
    const s = await stubServer(500);
    stub = s.server;
    const { code, output } = await runScript('bash', ['scripts/test-api.sh'], { API_BASE: s.base });
    expect(code).not.toBe(0);
    expect(output).toContain('got 500');
  });

  it('AC-001 backend 連不上時 test-api.sh 以非 0 結束', async () => {
    const { code } = await runScript('bash', ['scripts/test-api.sh'], { API_BASE: 'http://127.0.0.1:1' });
    expect(code).not.toBe(0);
  });

  it('AC-001 對正常且已 seed 的 backend，test-api.sh 以 0 結束', async () => {
    testApp = await createTestApp();
    const staffPassword = randomUUID(); // 每次執行隨機產生，只存在這個測試的資料庫
    await seedDatabase(testApp.app.prisma, { staffPassword });
    const base = await listen(testApp.app);
    const { code, output } = await runScript('bash', ['scripts/test-api.sh'], {
      API_BASE: base,
      E2E_STAFF_PASSWORD: staffPassword,
    });
    expect(output).not.toContain('FAIL');
    expect(code).toBe(0);
  });
});

describe('AC-001 腳本與依賴', () => {
  const pkg = JSON.parse(readFileSync(resolve(BACKEND_ROOT, 'package.json'), 'utf8'));

  it('AC-001 test:e2e／test:api／test:ws 參照的腳本檔都存在', () => {
    for (const name of ['test:e2e', 'test:api', 'test:ws']) {
      const script: string = pkg.scripts[name];
      expect(script, name).toBeTruthy();
      const files = script.split(/\s+/).filter((t) => /\.(mjs|sh)$/.test(t));
      expect(files.length, name).toBeGreaterThan(0);
      for (const f of files) {
        expect(existsSync(resolve(BACKEND_ROOT, f)), `${name} → ${f}`).toBe(true);
      }
    }
  });

  it('AC-001 fastify-plugin 列入 backend dependencies', () => {
    expect(pkg.dependencies['fastify-plugin']).toBeTruthy();
  });
});

describe('AC-001 CI 擋錯', () => {
  const ci = readFileSync(resolve(REPO_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');

  /** 取出 jobs 底下某個 job 的文字區塊（兩格縮排的 key）。 */
  function jobBlock(name: string): string {
    const lines = ci.split('\n');
    const start = lines.findIndex((l) => l === `  ${name}:`);
    expect(start, `job ${name} 存在`).toBeGreaterThanOrEqual(0);
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => /^ {2}\S/.test(l));
    return rest.slice(0, end === -1 ? undefined : end).join('\n');
  }

  it.each(['lint', 'test', 'build', 'e2e'])('AC-001 CI job %s 沒有 continue-on-error', (job) => {
    expect(jobBlock(job)).not.toMatch(/continue-on-error/);
  });

  it('AC-001 CI 不以「|| npm install」等 fallback 掩蓋安裝失敗', () => {
    expect(ci).not.toMatch(/npm ci[^\n]*\|\|/);
  });

  it('AC-001 lint job 包含 backend typecheck、kiosk lint、mobile typecheck', () => {
    const lint = jobBlock('lint');
    expect(lint).toMatch(/tsc --noEmit/);
    expect(lint).toMatch(/npm run lint/);
    expect(lint).toMatch(/npm run typecheck/);
  });

  it('AC-001 build 需等 lint 與 test 通過', () => {
    expect(jobBlock('build')).toMatch(/needs: \[lint, test\]/);
  });
});
