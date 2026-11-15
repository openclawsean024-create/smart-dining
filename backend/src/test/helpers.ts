/**
 * 整合測試工具：以獨立的 SQLite 檔建立 Fastify app（搭配 app.inject 使用）。
 */
import { copyFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { TEST_DB_DIR, TEMPLATE_DB_PATH } from './paths.js';

export interface TestApp {
  app: FastifyInstance;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const dbPath = resolve(TEST_DB_DIR, `test-${randomUUID()}.db`);
  copyFileSync(TEMPLATE_DB_PATH, dbPath);
  // 動態載入：確保 setupEnv 已先設定環境變數。
  const { buildApp } = await import('../app.js');
  const app = await buildApp({ logger: false, databaseUrl: 'file:' + dbPath });
  await app.ready();
  return {
    app,
    close: async () => {
      await app.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-journal', { force: true });
    },
  };
}

/** 讓 app 監聽隨機埠，回傳 base URL（給需要真實 HTTP／WebSocket 的測試）。 */
export async function listen(app: FastifyInstance): Promise<string> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  if (!addr || typeof addr === 'string') throw new Error('unexpected server address');
  return `http://127.0.0.1:${addr.port}`;
}
