/**
 * PR #3 審查修正（AC-011 範圍：授權、登入、訂單狀態）：
 *   1. 正式環境未接真實簡訊時後端仍可啟動，只有會員登入回 503
 *   2. 驗證碼提示只在明確開啟 OTP_EXPOSE_HINT=1 時回傳
 *   3. 訂單狀態只允許合法轉換；取消時退回庫存、優惠券、點數
 *   5. 員工登入失敗上限：並行請求不能繞過；不同 IP 不會被別人鎖住
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createStaff, createTestApp, loginMember, type StaffFixture, type TestApp } from '../test/helpers.js';
import { seedDatabase, DEMO_MEMBERS } from '../seedData.js';
import { __resetOTPProviderForTests } from '../lib/verifyCode.js';
import { canTransition } from './orders/routes.js';
import { MAX_FAILURES, MAX_FAILURES_PER_IP } from '../lib/loginThrottle.js';

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
  __resetOTPProviderForTests();
});

describe('AC-011 正式環境啟動與會員登入（審查 #1、#2）', () => {
  it('AC-011 NODE_ENV=production 且沒有真實簡訊 provider：後端照常啟動，會員登入 503，其他 API 正常', async () => {
    process.env.NODE_ENV = 'production';
    __resetOTPProviderForTests();
    const t = await createTestApp();
    try {
      await seedDatabase(t.app.prisma, { withDemoOrder: false });
      expect((await t.app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await t.app.inject({ method: 'GET', url: '/api/menu' })).statusCode).toBe(200);
      const login = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { phone: '0900000001' } });
      expect(login.statusCode).toBe(503);
      expect(login.json().code).toBe('OTP_UNAVAILABLE');
      const verify = await t.app.inject({ method: 'POST', url: '/api/auth/verify', payload: { phone: '0900000001', code: '123456' } });
      expect(verify.statusCode).toBe(503);
      const staff = await createStaff(t.app, 'MANAGER');
      expect(staff.token).not.toBe('');
    } finally {
      await t.close();
    }
  });

  it.each([
    ['未設定 OTP_EXPOSE_HINT', { NODE_ENV: 'test' }, false],
    ['OTP_EXPOSE_HINT=1', { NODE_ENV: 'test', OTP_EXPOSE_HINT: '1' }, true],
    ['OTP_EXPOSE_HINT=true（只認 1）', { NODE_ENV: 'test', OTP_EXPOSE_HINT: 'true' }, false],
  ])('AC-011 驗證碼提示：%s', async (_label, envs, exposed) => {
    delete process.env.OTP_EXPOSE_HINT;
    Object.assign(process.env, envs);
    __resetOTPProviderForTests();
    const t = await createTestApp();
    try {
      const res = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { phone: '0900000301' } });
      expect(res.statusCode).toBe(200);
      if (exposed) expect(res.json().code).toMatch(/^\d{6}$/);
      else expect(res.json()).not.toHaveProperty('code');
    } finally {
      await t.close();
    }
  });
});

describe('AC-011 訂單狀態轉換（審查 #3）', () => {
  let t: TestApp;
  let app: FastifyInstance;
  let manager: StaffFixture;
  let kitchen: StaffFixture;
  let cashier: StaffFixture;

  beforeAll(async () => {
    t = await createTestApp();
    app = t.app;
    await seedDatabase(app.prisma, { withDemoOrder: false });
    manager = await createStaff(app, 'MANAGER');
    kitchen = await createStaff(app, 'KITCHEN');
    cashier = await createStaff(app, 'CASHIER');
  });
  afterAll(async () => {
    await t.close();
  });

  const newOrder = async (payload: Record<string, unknown> = { cart: { items: [{ menuItemId: 'item-chicken-nuggets', quantity: 1 }] } }, headers = {}) => {
    const res = await app.inject({ method: 'POST', url: '/api/orders', payload, headers });
    expect(res.statusCode).toBe(201);
    return res.json().order.orderNo as string;
  };
  const patch = (orderNo: string, status: string, who: StaffFixture) =>
    app.inject({ method: 'PATCH', url: `/api/orders/${orderNo}/status`, headers: who.headers, payload: { status } });

  it('AC-011 canTransition：製作階段只能往前、完成只能從 READY、終態不可再改', () => {
    expect(canTransition('QUEUED', 'PREPARING')).toBe(true);
    expect(canTransition('QUEUED', 'READY')).toBe(true);
    expect(canTransition('READY', 'COMPLETED')).toBe(true);
    expect(canTransition('PLATING', 'CANCELLED')).toBe(true);
    expect(canTransition('COOKING', 'PREPARING')).toBe(false);
    expect(canTransition('QUEUED', 'QUEUED')).toBe(false);
    expect(canTransition('QUEUED', 'COMPLETED')).toBe(false);
    for (const to of ['QUEUED', 'READY', 'COMPLETED', 'CANCELLED'] as const) {
      expect(canTransition('COMPLETED', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });

  it('AC-011 已完成的訂單：內場不能改回 QUEUED、收銀不能取消（409），狀態不變', async () => {
    const orderNo = await newOrder();
    expect((await patch(orderNo, 'READY', kitchen)).statusCode).toBe(200);
    expect((await patch(orderNo, 'COMPLETED', cashier)).statusCode).toBe(200);
    const back = await patch(orderNo, 'QUEUED', kitchen);
    expect(back.statusCode).toBe(409);
    expect(back.json().code).toBe('INVALID_TRANSITION');
    expect((await patch(orderNo, 'CANCELLED', cashier)).statusCode).toBe(409);
    expect((await patch(orderNo, 'CANCELLED', manager)).statusCode).toBe(409);
    const order = await app.prisma.order.findUniqueOrThrow({ where: { orderNo } });
    expect(order.status).toBe('COMPLETED');
    // 已完成的訂單不會回到 KDS
    const kds = await app.inject({ method: 'GET', url: '/api/admin/orders', headers: kitchen.headers });
    expect(kds.json().orders.map((o: { orderNo: string }) => o.orderNo)).not.toContain(orderNo);
  });

  it('AC-011 不能往回、不能未到 READY 就完成、已取消不能再改', async () => {
    const orderNo = await newOrder();
    expect((await patch(orderNo, 'COOKING', kitchen)).statusCode).toBe(200);
    expect((await patch(orderNo, 'PREPARING', kitchen)).statusCode).toBe(409);
    expect((await patch(orderNo, 'COMPLETED', cashier)).statusCode).toBe(409);
    expect((await patch(orderNo, 'CANCELLED', cashier)).statusCode).toBe(200);
    expect((await patch(orderNo, 'READY', kitchen)).statusCode).toBe(409);
    expect((await patch(orderNo, 'CANCELLED', manager)).statusCode).toBe(409);
  });

  it('AC-011 並行的兩個狀態變更只有一個成功', async () => {
    const orderNo = await newOrder();
    expect((await patch(orderNo, 'READY', kitchen)).statusCode).toBe(200);
    const results = await Promise.all([patch(orderNo, 'COMPLETED', cashier), patch(orderNo, 'CANCELLED', manager)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const logs = await app.prisma.orderStatusLog.findMany({ where: { order: { orderNo } } });
    expect(logs.filter((l) => l.status === 'COMPLETED' || l.status === 'CANCELLED')).toHaveLength(1);
  });

  it('AC-011 取消訂單：退回庫存、優惠券與這張訂單給的點數', async () => {
    await app.prisma.menuItem.update({ where: { id: 'item-chicken-nuggets' }, data: { stock: 5 } });
    const vip = await loginMember(app, DEMO_MEMBERS.vip.phone);
    const before = await app.prisma.member.findUniqueOrThrow({ where: { id: vip.id } });

    const orderNo = await newOrder(
      { cart: { items: [{ menuItemId: 'item-chicken-nuggets', quantity: 2 }] }, couponCode: 'VIP10' },
      vip.headers,
    );
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: 'item-chicken-nuggets' } })).stock).toBe(3);
    expect((await app.prisma.coupon.findUniqueOrThrow({ where: { code: 'VIP10' } })).usedAt).not.toBeNull();
    const placed = await app.prisma.order.findUniqueOrThrow({ where: { orderNo } });
    expect(placed.pointsEarned).toBe(Math.floor(placed.subtotal));
    expect((await app.prisma.member.findUniqueOrThrow({ where: { id: vip.id } })).points).toBe(before.points + placed.pointsEarned);

    expect((await patch(orderNo, 'CANCELLED', cashier)).statusCode).toBe(200);
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: 'item-chicken-nuggets' } })).stock).toBe(5);
    expect((await app.prisma.coupon.findUniqueOrThrow({ where: { code: 'VIP10' } })).usedAt).toBeNull();
    expect((await app.prisma.member.findUniqueOrThrow({ where: { id: vip.id } })).points).toBe(before.points);

    // 優惠券可以再次使用
    await newOrder({ cart: { items: [{ menuItemId: 'item-chicken-nuggets', quantity: 1 }] }, couponCode: 'VIP10' }, vip.headers);
    await app.prisma.menuItem.update({ where: { id: 'item-chicken-nuggets' }, data: { stock: null } });
  });

  it('AC-011 取消不追蹤庫存的品項：庫存維持不追蹤（null）', async () => {
    const orderNo = await newOrder();
    expect((await patch(orderNo, 'CANCELLED', manager)).statusCode).toBe(200);
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: 'item-chicken-nuggets' } })).stock).toBeNull();
  });
});

describe('AC-011 員工登入失敗上限（審查 #5）', () => {
  let t: TestApp;
  let app: FastifyInstance;

  beforeAll(async () => {
    t = await createTestApp();
    app = t.app;
  });
  afterAll(async () => {
    await t.close();
  });

  const login = (username: string, password: string, remoteAddress: string) =>
    app.inject({ method: 'POST', url: '/api/staff/login', payload: { username, password }, remoteAddress });

  it('AC-011 同時送出大量錯誤密碼：最多 MAX_FAILURES 次進到密碼比對，其餘 429', async () => {
    const victim = await createStaff(app, 'MANAGER');
    const results = await Promise.all(Array.from({ length: 15 }, () => login(victim.username, randomUUID(), '10.0.0.1')));
    const codes = results.map((r) => r.statusCode);
    expect(codes.filter((c) => c === 401).length).toBeLessThanOrEqual(MAX_FAILURES);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(15 - MAX_FAILURES);
    // 同一 IP 用正確密碼也被擋
    expect((await login(victim.username, victim.password, '10.0.0.1')).statusCode).toBe(429);
  });

  it('AC-011 別的 IP 打錯 5 次，不會把店長從自己的 IP 鎖住', async () => {
    const victim = await createStaff(app, 'MANAGER');
    for (let i = 0; i < MAX_FAILURES; i++) {
      expect((await login(victim.username, randomUUID(), '10.0.0.2')).statusCode).toBe(401);
    }
    expect((await login(victim.username, victim.password, '10.0.0.2')).statusCode).toBe(429);
    expect((await login(victim.username, victim.password, '10.0.0.3')).statusCode).toBe(200);
  });

  it('AC-011 同一 IP 輪流猜很多帳號：達 IP 上限後全部 429', async () => {
    const victim = await createStaff(app, 'KITCHEN');
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) {
      expect((await login('no-such-' + i, randomUUID(), '10.0.0.4')).statusCode).toBe(401);
    }
    expect((await login(victim.username, victim.password, '10.0.0.4')).statusCode).toBe(429);
    expect((await login(victim.username, victim.password, '10.0.0.5')).statusCode).toBe(200);
  });
});
