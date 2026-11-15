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

// ------------------------------------------------------------
// 測試 fixture：帳號與 token。密碼在執行時隨機產生，repo 內沒有任何固定密碼。
// ------------------------------------------------------------
import type { StaffRole } from '../../../shared-contracts/src/index.js';
import { hashPassword } from '../lib/password.js';

export interface StaffFixture {
  id: string;
  username: string;
  role: StaffRole;
  password: string;
  token: string;
  headers: { authorization: string };
}

export async function createStaff(
  app: FastifyInstance,
  role: StaffRole,
  overrides: { username?: string; active?: boolean } = {},
): Promise<StaffFixture> {
  const username = overrides.username ?? `${role.toLowerCase()}-${randomUUID().slice(0, 8)}`;
  const password = randomUUID(); // 每次執行隨機產生（36 字元，低於 bcrypt 的 72 bytes 上限）
  const staff = await app.prisma.staff.create({
    data: {
      username,
      name: '測試' + role,
      role,
      active: overrides.active ?? true,
      passwordHash: await hashPassword(password),
    },
  });
  let token = '';
  if (staff.active) {
    const res = await app.inject({ method: 'POST', url: '/api/staff/login', payload: { username, password } });
    if (res.statusCode !== 200) throw new Error('staff fixture login failed: ' + res.body);
    token = res.json().token;
  }
  return { id: staff.id, username, role, password, token, headers: { authorization: 'Bearer ' + token } };
}

export interface MemberFixture {
  id: string;
  phone: string;
  token: string;
  headers: { authorization: string };
}

/** 以 dev OTP 流程登入會員（不存在則建立）。phone 請用 0900-000-xxx 假號。 */
export async function loginMember(app: FastifyInstance, phone: string): Promise<MemberFixture> {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { phone } });
  if (login.statusCode !== 200) throw new Error('member fixture login failed: ' + login.body);
  const verify = await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    payload: { phone, code: login.json().code },
  });
  if (verify.statusCode !== 200) throw new Error('member fixture verify failed: ' + verify.body);
  const { token, member } = verify.json();
  return { id: member.id, phone, token, headers: { authorization: 'Bearer ' + token } };
}

/** 測試用假手機號碼：0900-000-1xx（與 seed 的 001／002 不重複）。 */
export const TEST_PHONES = {
  alice: '0900000101',
  bob: '0900000102',
} as const;
