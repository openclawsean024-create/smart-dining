/**
 * AC-011：員工角色與 API 授權。
 * 逐一斷言「無 token 401」「角色不符 403」「本人／合格角色 200」。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, relative } from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  createStaff, createTestApp, loginMember, TEST_PHONES,
  type MemberFixture, type StaffFixture, type TestApp,
} from '../../test/helpers.js';
import { REPO_ROOT } from '../../test/paths.js';
import { DEMO_COUPONS, DEMO_MEMBERS, DEMO_STAFF, seedDatabase } from '../../seedData.js';
import { hashPassword, isBcryptHash, MAX_PASSWORD_BYTES, verifyPassword } from '../../lib/password.js';
import { MAX_FAILURES } from '../../lib/loginThrottle.js';

let t: TestApp;
let app: FastifyInstance;
let manager: StaffFixture;
let cashier: StaffFixture;
let kitchen: StaffFixture;
let alice: MemberFixture;
let bob: MemberFixture;

const json = (headers: Record<string, string> = {}) => ({ 'content-type': 'application/json', ...headers });

async function newOrder(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/orders',
    payload: { cart: { items: [{ menuItemId: 'item-braised-pork', name: '招牌滷肉飯', quantity: 1, customizations: [] }] } },
  });
  expect(res.statusCode).toBe(201);
  return res.json().order.orderNo;
}

beforeAll(async () => {
  t = await createTestApp();
  app = t.app;
  await seedDatabase(app.prisma, { withDemoOrder: false });
  manager = await createStaff(app, 'MANAGER');
  cashier = await createStaff(app, 'CASHIER');
  kitchen = await createStaff(app, 'KITCHEN');
  alice = await loginMember(app, TEST_PHONES.alice);
  bob = await loginMember(app, TEST_PHONES.bob);
});

afterAll(async () => {
  await t.close();
});

describe('AC-011 員工登入與密碼雜湊', () => {
  it('AC-011 員工密碼以 bcrypt 雜湊儲存，資料庫沒有明碼', async () => {
    const row = await app.prisma.staff.findUniqueOrThrow({ where: { id: manager.id } });
    expect(isBcryptHash(row.passwordHash)).toBe(true);
    expect(row.passwordHash).not.toContain(manager.password);
    expect(await verifyPassword(manager.password, row.passwordHash)).toBe(true);
    expect(await verifyPassword(manager.password + 'x', row.passwordHash)).toBe(false);
  });

  it('AC-011 超過 bcrypt 72 bytes 上限的密碼一律拒絕（避免尾端被截斷後仍能通過）', async () => {
    const base = 'a'.repeat(MAX_PASSWORD_BYTES);
    const hash = await hashPassword(base);
    expect(await verifyPassword(base, hash)).toBe(true);
    expect(await verifyPassword(base + 'anything', hash)).toBe(false);
    await expect(hashPassword(base + 'x')).rejects.toThrow(/at most/);
    await expect(hashPassword('short')).rejects.toThrow(/at least/);
  });

  it('AC-011 seed 建立的示範員工只存 bcrypt 雜湊，且沒給密碼就不建立員工', async () => {
    const other = await createTestApp();
    try {
      await seedDatabase(other.app.prisma, { withDemoOrder: false });
      expect(await other.app.prisma.staff.count()).toBe(0);

      const password = 'seed-test-' + Math.random().toString(36).slice(2);
      await seedDatabase(other.app.prisma, { withDemoOrder: false, staffPassword: password });
      const rows = await other.app.prisma.staff.findMany();
      expect(rows.map((r) => r.username).sort()).toEqual(DEMO_STAFF.map((s) => s.username).sort());
      for (const r of rows) {
        expect(isBcryptHash(r.passwordHash)).toBe(true);
        expect(r.passwordHash).not.toContain(password);
      }
    } finally {
      await other.close();
    }
  });

  it('AC-011 正確帳密登入回傳 token 與員工資料，且不含 passwordHash', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/staff/login',
      payload: { username: manager.username, password: manager.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.staff).toEqual({ id: manager.id, username: manager.username, name: '測試MANAGER', role: 'MANAGER' });
    expect(res.body).not.toContain('passwordHash');
  });

  it('AC-011 密碼錯誤、帳號不存在、帳號停用皆回 401', async () => {
    const wrong = await app.inject({
      method: 'POST', url: '/api/staff/login',
      payload: { username: cashier.username, password: cashier.password + '-wrong' },
    });
    expect(wrong.statusCode).toBe(401);

    const unknown = await app.inject({
      method: 'POST', url: '/api/staff/login',
      payload: { username: 'no-such-staff', password: randomUUID() },
    });
    expect(unknown.statusCode).toBe(401);

    const inactive = await createStaff(app, 'CASHIER', { active: false });
    const res = await app.inject({
      method: 'POST', url: '/api/staff/login',
      payload: { username: inactive.username, password: inactive.password },
    });
    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['admin', 'admin'],
    ['admin', '1234'],
    ['manager01', '1234'],
    ['manager01', 'admin'],
  ])('AC-011 沒有明碼預設帳密可用：%s／%s 回 401', async (username, password) => {
    const other = await createTestApp();
    try {
      await seedDatabase(other.app.prisma, { withDemoOrder: false, staffPassword: 'seed-' + Math.random().toString(36).slice(2) + '-pw' });
      const res = await other.app.inject({ method: 'POST', url: '/api/staff/login', payload: { username, password } });
      expect(res.statusCode).toBe(401);
    } finally {
      await other.close();
    }
  });

  it('AC-011 會員登入不再接受固定驗證碼 1234：只有這次寄出的一次性驗證碼有效，連錯 5 次才作廢', async () => {
    const phone = '0900000199';
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { phone } });
    expect(login.statusCode).toBe(200);
    const sent: string = login.json().code;
    expect(sent).toMatch(/^\d{6}$/);

    const fixed = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { phone, code: '1234' } });
    expect(fixed.statusCode).toBe(401);
    // 猜錯不會讓本人的驗證碼失效（否則任何人都能讓別人無法登入）
    const afterGuess = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { phone, code: sent } });
    expect(afterGuess.statusCode).toBe(200);
    // 一次性：用過就不能再用
    const reused = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { phone, code: sent } });
    expect(reused.statusCode).toBe(401);

    // 連續猜錯 5 次才作廢
    const again = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { phone } });
    for (let i = 0; i < 5; i++) {
      const wrong = String((Number(again.json().code) + 1 + i) % 1_000_000).padStart(6, '0');
      expect((await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { phone, code: wrong } })).statusCode).toBe(401);
    }
    const voided = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { phone, code: again.json().code } });
    expect(voided.statusCode).toBe(401);
  });

  it('AC-011 連續登入失敗達上限後回 429', async () => {
    const victim = await createStaff(app, 'KITCHEN');
    for (let i = 0; i < MAX_FAILURES; i++) {
      const res = await app.inject({
        method: 'POST', url: '/api/staff/login',
        payload: { username: victim.username, password: randomUUID() + i },
      });
      expect(res.statusCode).toBe(401);
    }
    const blocked = await app.inject({
      method: 'POST', url: '/api/staff/login',
      payload: { username: victim.username, password: victim.password },
    });
    expect(blocked.statusCode).toBe(429);
  });

  it('AC-011 GET /api/staff/me：無 token 401、會員 token 403、員工 200', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/staff/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/staff/me', headers: alice.headers })).statusCode).toBe(403);
    const ok = await app.inject({ method: 'GET', url: '/api/staff/me', headers: kitchen.headers });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().staff.role).toBe('KITCHEN');
  });

  it('AC-011 偽造或亂填的 token 回 401；停用後原 token 立即失效', async () => {
    const garbage = await app.inject({ method: 'GET', url: '/api/staff/me', headers: { authorization: 'Bearer not-a-jwt' } });
    expect(garbage.statusCode).toBe(401);

    // 自己組一個未簽章正確的 staff token（alg none 風格）
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ kind: 'staff', sub: manager.id, role: 'MANAGER', name: 'x' })).toString('base64url'),
      'invalid-signature',
    ].join('.');
    const res = await app.inject({ method: 'GET', url: '/api/staff/me', headers: { authorization: 'Bearer ' + forged } });
    expect(res.statusCode).toBe(401);

    const leaving = await createStaff(app, 'MANAGER');
    expect((await app.inject({ method: 'GET', url: '/api/staff/me', headers: leaving.headers })).statusCode).toBe(200);
    await app.prisma.staff.update({ where: { id: leaving.id }, data: { active: false } });
    expect((await app.inject({ method: 'GET', url: '/api/staff/me', headers: leaving.headers })).statusCode).toBe(401);
  });
});

describe('AC-011 會員 API 只允許本人或店長', () => {
  const memberEndpoints = [
    (id: string) => `/api/members/${id}`,
    (id: string) => `/api/members/${id}/coupons`,
    (id: string) => `/api/orders/member/${id}`,
  ];

  it.each(memberEndpoints)('AC-011 %o：無 token 401', async (path) => {
    const res = await app.inject({ method: 'GET', url: path(alice.id) });
    expect(res.statusCode).toBe(401);
  });

  it.each(memberEndpoints)('AC-011 %o：其他會員 403', async (path) => {
    const res = await app.inject({ method: 'GET', url: path(alice.id), headers: bob.headers });
    expect(res.statusCode).toBe(403);
  });

  it.each(memberEndpoints)('AC-011 %o：收銀與內場 403', async (path) => {
    expect((await app.inject({ method: 'GET', url: path(alice.id), headers: cashier.headers })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: path(alice.id), headers: kitchen.headers })).statusCode).toBe(403);
  });

  it.each(memberEndpoints)('AC-011 %o：本人 200', async (path) => {
    const res = await app.inject({ method: 'GET', url: path(alice.id), headers: alice.headers });
    expect(res.statusCode).toBe(200);
  });

  it.each(memberEndpoints)('AC-011 %o：店長 200', async (path) => {
    const res = await app.inject({ method: 'GET', url: path(alice.id), headers: manager.headers });
    expect(res.statusCode).toBe(200);
  });

  it('AC-011 本人取得的會員資料是自己的', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/members/${alice.id}`, headers: alice.headers });
    expect(res.json().member).toMatchObject({ id: alice.id, phone: TEST_PHONES.alice });
  });
});

describe('AC-011 加點數只允許店長', () => {
  const url = (id: string) => `/api/members/${id}/points/add`;
  const payload = { delta: 10, reason: '測試補點' };

  it('AC-011 無 token 401，且點數不變', async () => {
    const before = await app.prisma.member.findUniqueOrThrow({ where: { id: alice.id } });
    const res = await app.inject({ method: 'POST', url: url(alice.id), payload });
    expect(res.statusCode).toBe(401);
    const after = await app.prisma.member.findUniqueOrThrow({ where: { id: alice.id } });
    expect(after.points).toBe(before.points);
  });

  it('AC-011 會員本人不能替自己加點數（403）', async () => {
    const res = await app.inject({ method: 'POST', url: url(alice.id), headers: alice.headers, payload });
    expect(res.statusCode).toBe(403);
    expect(await app.prisma.pointsTransaction.count({ where: { memberId: alice.id } })).toBe(0);
  });

  it('AC-011 收銀與內場 403', async () => {
    expect((await app.inject({ method: 'POST', url: url(alice.id), headers: cashier.headers, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: url(alice.id), headers: kitchen.headers, payload })).statusCode).toBe(403);
  });

  it('AC-011 店長 200，點數增加並寫入 PointsTransaction', async () => {
    const before = await app.prisma.member.findUniqueOrThrow({ where: { id: alice.id } });
    const res = await app.inject({ method: 'POST', url: url(alice.id), headers: manager.headers, payload });
    expect(res.statusCode).toBe(200);
    expect(res.json().member.points).toBe(before.points + 10);
    const txs = await app.prisma.pointsTransaction.findMany({ where: { memberId: alice.id } });
    expect(txs).toHaveLength(1);
    expect(txs[0]!.delta).toBe(10);
    expect(txs[0]!.reason).toContain('staff:' + manager.id);
  });

  it.each([
    [{ delta: 0, reason: 'x' }],
    [{ delta: 1.5, reason: 'x' }],
    [{ delta: '10', reason: 'x' }],
    [{ delta: 10 }],
    [{ delta: 10, reason: '   ' }],
    [{ delta: 10_000_000, reason: 'x' }],
  ])('AC-011 店長送出不合法的內容 %o 回 400', async (body) => {
    const res = await app.inject({ method: 'POST', url: url(alice.id), headers: json(manager.headers), payload: body });
    expect(res.statusCode).toBe(400);
  });

  it('AC-011 扣點不可讓點數變成負數（400）；會員不存在 404', async () => {
    const neg = await app.inject({ method: 'POST', url: url(bob.id), headers: manager.headers, payload: { delta: -1, reason: '測試扣點' } });
    expect(neg.statusCode).toBe(400);
    const missing = await app.inject({ method: 'POST', url: url('no-such-member'), headers: manager.headers, payload });
    expect(missing.statusCode).toBe(404);
  });
});

describe('AC-011 訂單推進與狀態 API 需員工角色', () => {
  it('AC-011 POST /api/admin/orders/:orderNo/advance：無 token 401、會員 403、收銀 403', async () => {
    const orderNo = await newOrder();
    const url = `/api/admin/orders/${orderNo}/advance`;
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url, headers: alice.headers })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url, headers: cashier.headers })).statusCode).toBe(403);
    const order = await app.prisma.order.findUniqueOrThrow({ where: { orderNo } });
    expect(order.status).toBe('QUEUED');
  });

  it('AC-011 advance：內場與店長 200，並以員工身分寫入狀態紀錄', async () => {
    const orderNo = await newOrder();
    const url = `/api/admin/orders/${orderNo}/advance`;
    const a = await app.inject({ method: 'POST', url, headers: kitchen.headers });
    expect(a.statusCode).toBe(200);
    expect(a.json()).toMatchObject({ advanced: true, newStatus: 'PREPARING' });
    const b = await app.inject({ method: 'POST', url, headers: manager.headers });
    expect(b.statusCode).toBe(200);
    expect(b.json().newStatus).toBe('COOKING');
    const order = await app.prisma.order.findUniqueOrThrow({ where: { orderNo }, include: { statusLogs: true } });
    expect(order.statusLogs.map((l) => l.changedBy)).toEqual(
      expect.arrayContaining(['system', 'staff:' + kitchen.id, 'staff:' + manager.id]),
    );
  });

  it('AC-011 PATCH /api/orders/:orderNo/status：無 token 401、會員 403', async () => {
    const orderNo = await newOrder();
    const url = `/api/orders/${orderNo}/status`;
    expect((await app.inject({ method: 'PATCH', url, payload: { status: 'READY' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url, headers: alice.headers, payload: { status: 'READY' } })).statusCode).toBe(403);
    expect((await app.prisma.order.findUniqueOrThrow({ where: { orderNo } })).status).toBe('QUEUED');
  });

  it('AC-011 PATCH status 依角色限制：收銀不能設製作階段、內場不能設完成／取消', async () => {
    const orderNo = await newOrder();
    const url = `/api/orders/${orderNo}/status`;
    expect((await app.inject({ method: 'PATCH', url, headers: cashier.headers, payload: { status: 'COOKING' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url, headers: kitchen.headers, payload: { status: 'COMPLETED' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url, headers: kitchen.headers, payload: { status: 'CANCELLED' } })).statusCode).toBe(403);
    expect((await app.prisma.order.findUniqueOrThrow({ where: { orderNo } })).status).toBe('QUEUED');
  });

  it('AC-011 PATCH status：內場設 COOKING、收銀設 COMPLETED、店長設 CANCELLED 皆 200', async () => {
    const orderNo = await newOrder();
    const url = `/api/orders/${orderNo}/status`;
    const k = await app.inject({ method: 'PATCH', url, headers: kitchen.headers, payload: { status: 'COOKING', changedBy: 'spoofed' } });
    expect(k.statusCode).toBe(200);
    // 完成取餐只能從 READY（狀態轉換規則，見 orders.transitions.test.ts）
    const r = await app.inject({ method: 'PATCH', url, headers: kitchen.headers, payload: { status: 'READY' } });
    expect(r.statusCode).toBe(200);
    const c = await app.inject({ method: 'PATCH', url, headers: cashier.headers, payload: { status: 'COMPLETED' } });
    expect(c.statusCode).toBe(200);
    expect(c.json().order.completedAt).toBeTruthy();
    // 已完成的訂單不能再取消；店長取消用另一張進行中的訂單
    expect((await app.inject({ method: 'PATCH', url, headers: manager.headers, payload: { status: 'CANCELLED' } })).statusCode).toBe(409);
    const other = await newOrder();
    const m = await app.inject({ method: 'PATCH', url: `/api/orders/${other}/status`, headers: manager.headers, payload: { status: 'CANCELLED' } });
    expect(m.statusCode).toBe(200);
    const otherLogs = await app.prisma.orderStatusLog.findMany({ where: { order: { orderNo: other } } });
    expect(otherLogs.map((l) => l.changedBy)).toContain('staff:' + manager.id);

    const logs = await app.prisma.orderStatusLog.findMany({ where: { order: { orderNo } } });
    expect(logs.map((l) => l.changedBy)).not.toContain('spoofed');
    expect(logs.map((l) => l.changedBy)).toEqual(
      expect.arrayContaining(['staff:' + kitchen.id, 'staff:' + cashier.id]),
    );
  });

  it('AC-011 PATCH status：不合法的狀態 400、訂單不存在 404', async () => {
    const orderNo = await newOrder();
    const bad = await app.inject({ method: 'PATCH', url: `/api/orders/${orderNo}/status`, headers: manager.headers, payload: { status: 'DONE' } });
    expect(bad.statusCode).toBe(400);
    const missing = await app.inject({ method: 'PATCH', url: '/api/orders/SD-00000000-0000/status', headers: manager.headers, payload: { status: 'READY' } });
    expect(missing.statusCode).toBe(404);
  });
});

describe('AC-011 下單時的會員身分與優惠券歸屬', () => {
  const cart = { items: [{ menuItemId: 'item-braised-pork', name: '招牌滷肉飯', quantity: 1, customizations: [] }] };

  it('AC-011 body 帶 memberId 但沒有 token → 401，不建立訂單', async () => {
    const before = await app.prisma.order.count();
    const res = await app.inject({ method: 'POST', url: '/api/orders', payload: { cart, memberId: alice.id } });
    expect(res.statusCode).toBe(401);
    expect(await app.prisma.order.count()).toBe(before);
  });

  it('AC-011 body 的 memberId 與 token 不同人 → 403，對方點數不變', async () => {
    const before = await app.prisma.member.findUniqueOrThrow({ where: { id: alice.id } });
    const res = await app.inject({ method: 'POST', url: '/api/orders', headers: bob.headers, payload: { cart, memberId: alice.id } });
    expect(res.statusCode).toBe(403);
    const after = await app.prisma.member.findUniqueOrThrow({ where: { id: alice.id } });
    expect(after.points).toBe(before.points);
  });

  it('AC-011 員工 token 不能替任意會員掛單（403）', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/orders', headers: manager.headers, payload: { cart, memberId: alice.id } });
    expect(res.statusCode).toBe(403);
  });

  it('AC-011 會員 token 下單 → 訂單掛在 token 的會員上；訪客下單 memberId 為 null', async () => {
    const mine = await app.inject({ method: 'POST', url: '/api/orders', headers: bob.headers, payload: { cart } });
    expect(mine.statusCode).toBe(201);
    expect(mine.json().order.memberId).toBe(bob.id);
    const guest = await app.inject({ method: 'POST', url: '/api/orders', payload: { cart } });
    expect(guest.statusCode).toBe(201);
    expect(guest.json().order.memberId).toBeNull();
  });

  it('AC-011 無效的 Authorization 下單回 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/orders', headers: { authorization: 'Bearer nope' }, payload: { cart } });
    expect(res.statusCode).toBe(401);
  });

  it('AC-011 綁定其他會員的優惠券不能被訪客或別人使用（400），券仍未使用', async () => {
    const code = DEMO_COUPONS.vip10.code; // 綁定 seed 的示範會員
    const guest = await app.inject({ method: 'POST', url: '/api/orders', payload: { cart, couponCode: code } });
    expect(guest.statusCode).toBe(400);
    const other = await app.inject({ method: 'POST', url: '/api/orders', headers: alice.headers, payload: { cart, couponCode: code } });
    expect(other.statusCode).toBe(400);
    const coupon = await app.prisma.coupon.findUniqueOrThrow({ where: { code } });
    expect(coupon.usedAt).toBeNull();

    const owner = await loginMember(app, DEMO_MEMBERS.vip.phone);
    const ok = await app.inject({ method: 'POST', url: '/api/orders', headers: owner.headers, payload: { cart, couponCode: code } });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().order.discount).toBeGreaterThan(0);
  });
});

describe('AC-011 repo 內沒有明碼預設密碼', () => {
  const ROOTS = ['backend/src', 'backend/scripts', 'backend/prisma', 'kiosk-frontend/src', 'mobile-app/src', 'shared-contracts/src', 'scripts'];
  const SELF = 'backend/src/modules/__tests__/authz.ac011.test.ts';

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|mjs|js|sh|prisma|json)$/.test(name)) out.push(full);
    }
    return out;
  }

  it('AC-011 原始碼沒有 password: \'...\' 這類寫死的密碼，也沒有 admin/admin', () => {
    const offenders: string[] = [];
    const patterns = [
      /password\s*[:=]\s*['"`][^'"`$]+['"`]/i, // 例如 password 後接冒號與引號包住的字面值（不含樣板字串變數）
      /passwordHash\s*[:=]\s*['"`]/i,
      /admin\s*\/\s*admin/i,
      /\bpin\s*[:=]\s*['"`]\d{4,}['"`]/i,
    ];
    for (const root of ROOTS) {
      for (const file of walk(join(REPO_ROOT, root))) {
        const rel = relative(REPO_ROOT, file);
        if (rel === SELF) continue;
        const text = readFileSync(file, 'utf8');
        text.split('\n').forEach((line, i) => {
          if (patterns.some((p) => p.test(line))) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
