/**
 * AC-004：後台訂單清單（GET /api/admin/orders）與推進後的 Socket 事件。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  createStaff, createTestApp, listen, loginMember, TEST_PHONES,
  type MemberFixture, type StaffFixture, type TestApp,
} from '../test/helpers.js';
import { demoChoiceId, demoGroupId, seedDatabase } from '../seedData.js';

let t: TestApp;
let app: FastifyInstance;
let base: string;
let manager: StaffFixture;
let cashier: StaffFixture;
let kitchen: StaffFixture;
let member: MemberFixture;

const sockets: Socket[] = [];

const CHICKEN = 'item-crispy-chicken';

async function placeOrder(headers: Record<string, string> = {}): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/orders',
    headers,
    payload: {
      cart: {
        items: [
          {
            menuItemId: CHICKEN,
            quantity: 2,
            customizations: [
              { groupId: demoGroupId(CHICKEN, 0), choiceIds: [demoChoiceId(CHICKEN, 0, 0)] }, // 白飯
              { groupId: demoGroupId(CHICKEN, 1), choiceIds: [demoChoiceId(CHICKEN, 1, 1)] }, // 辣油
              { groupId: demoGroupId(CHICKEN, 2), choiceIds: [demoChoiceId(CHICKEN, 2, 0)] }, // 薯條
            ],
          },
          { menuItemId: 'item-braised-pork', quantity: 1 },
        ],
      },
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().order.orderNo;
}

const list = (headers?: Record<string, string>) => app.inject({ method: 'GET', url: '/api/admin/orders', headers });
const advance = (orderNo: string, who: StaffFixture) =>
  app.inject({ method: 'POST', url: `/api/admin/orders/${orderNo}/advance`, headers: who.headers });

function connect(namespace: string, auth?: Record<string, unknown>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(base + namespace, { transports: ['websocket'], auth, reconnection: false });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

/** 等到條件成立或逾時。 */
async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

beforeAll(async () => {
  t = await createTestApp();
  app = t.app;
  await seedDatabase(app.prisma, { withDemoOrder: false });
  manager = await createStaff(app, 'MANAGER');
  cashier = await createStaff(app, 'CASHIER');
  kitchen = await createStaff(app, 'KITCHEN');
  member = await loginMember(app, TEST_PHONES.alice);
  base = await listen(app);
});

beforeEach(async () => {
  await app.prisma.orderStatusLog.deleteMany();
  await app.prisma.orderItem.deleteMany();
  await app.prisma.order.deleteMany();
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await t.close();
});

describe('AC-004 GET /api/admin/orders', () => {
  it('AC-004 需員工 JWT：無 token 401、會員 token 403；店長／收銀／內場皆 200', async () => {
    expect((await list()).statusCode).toBe(401);
    expect((await list(member.headers)).statusCode).toBe(403);
    for (const staff of [manager, cashier, kitchen]) {
      expect((await list(staff.headers)).statusCode).toBe(200);
    }
  });

  it('AC-004 沒有進行中訂單時回傳空陣列與 serverTime', async () => {
    const res = await list(kitchen.headers);
    const body = res.json();
    expect(body.orders).toEqual([]);
    expect(new Date(body.serverTime).toISOString()).toBe(body.serverTime);
  });

  it('AC-004 只含進行中狀態（QUEUED～READY），不含 COMPLETED／CANCELLED', async () => {
    const statuses = ['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY', 'COMPLETED', 'CANCELLED'];
    const byStatus = new Map<string, string>();
    for (const status of statuses) {
      const orderNo = await placeOrder();
      await app.prisma.order.update({ where: { orderNo }, data: { status } });
      byStatus.set(status, orderNo);
    }
    const body = (await list(kitchen.headers)).json();
    const returned = body.orders.map((o: { status: string }) => o.status);
    expect(returned).toEqual(['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY']);
    const orderNos = body.orders.map((o: { orderNo: string }) => o.orderNo);
    expect(orderNos).not.toContain(byStatus.get('COMPLETED'));
    expect(orderNos).not.toContain(byStatus.get('CANCELLED'));
  });

  it('AC-004 依建立時間由舊到新排序（與建立順序、訂單號無關）', async () => {
    const a = await placeOrder();
    const b = await placeOrder();
    const c = await placeOrder();
    // 故意把時間調成 c 最舊、a 次之、b 最新
    await app.prisma.order.update({ where: { orderNo: c }, data: { createdAt: new Date('2026-04-01T01:00:00Z') } });
    await app.prisma.order.update({ where: { orderNo: a }, data: { createdAt: new Date('2026-04-01T01:05:00Z') } });
    await app.prisma.order.update({ where: { orderNo: b }, data: { createdAt: new Date('2026-04-01T01:10:00Z') } });

    const body = (await list(manager.headers)).json();
    expect(body.orders.map((o: { orderNo: string }) => o.orderNo)).toEqual([c, a, b]);
  });

  it('AC-004 每筆含取餐號、品項與客製化（已解析成陣列）、品項摘要、建立時間', async () => {
    const orderNo = await placeOrder();
    const [order] = (await list(kitchen.headers)).json().orders;
    expect(order).toMatchObject({ orderNo, status: 'QUEUED', pickupNumber: 1, itemSummary: '經典脆雞 x 2 · 招牌滷肉飯 x 1' });
    expect(new Date(order.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toMatchObject({ name: '經典脆雞', quantity: 2 });
    expect(order.items[0].customizations).toEqual([
      { groupId: demoGroupId(CHICKEN, 0), groupName: '主食選擇', choiceIds: [demoChoiceId(CHICKEN, 0, 0)], choiceNames: ['白飯'] },
      { groupId: demoGroupId(CHICKEN, 1), groupName: '醬料選擇', choiceIds: [demoChoiceId(CHICKEN, 1, 1)], choiceNames: ['辣油'] },
      { groupId: demoGroupId(CHICKEN, 2), groupName: '加購', choiceIds: [demoChoiceId(CHICKEN, 2, 0)], choiceNames: ['薯條'] },
    ]);
    expect(order.items[1].customizations).toEqual([]);
  });

  it('AC-004 會員訂單出現在清單中，但回應不含會員手機號碼', async () => {
    await placeOrder(member.headers);
    const res = await list(kitchen.headers);
    expect(res.json().orders).toHaveLength(1);
    expect(res.body).not.toContain(TEST_PHONES.alice);
    expect(res.body).not.toContain('phone');
  });

  it('AC-004 推進到 READY 仍在清單；設為 COMPLETED 後離開清單', async () => {
    const orderNo = await placeOrder();
    for (const expected of ['PREPARING', 'COOKING', 'PLATING', 'READY']) {
      const res = await advance(orderNo, kitchen);
      expect(res.statusCode).toBe(200);
      expect(res.json().order.status).toBe(expected);
    }
    expect((await list(kitchen.headers)).json().orders.map((o: { status: string }) => o.status)).toEqual(['READY']);

    // READY 之後不能再用 advance 推進
    const again = await advance(orderNo, kitchen);
    expect(again.json().advanced).toBe(false);

    const done = await app.inject({
      method: 'PATCH', url: `/api/orders/${orderNo}/status`, headers: cashier.headers, payload: { status: 'COMPLETED' },
    });
    expect(done.statusCode).toBe(200);
    expect((await list(kitchen.headers)).json().orders).toEqual([]);
  });

  it('AC-004 舊格式或損壞的客製化資料不會讓清單壞掉', async () => {
    const orderNo = await placeOrder();
    const items = await app.prisma.orderItem.findMany({ where: { order: { orderNo } }, orderBy: { name: 'asc' } });
    await app.prisma.orderItem.update({ where: { id: items[0]!.id }, data: { customizations: 'not-json' } });
    await app.prisma.orderItem.update({
      where: { id: items[1]!.id },
      data: { customizations: JSON.stringify([{ groupName: '甜度', choice: '半糖' }]) },
    });
    const res = await list(kitchen.headers);
    expect(res.statusCode).toBe(200);
    const all = res.json().orders[0].items.map((it: { customizations: unknown }) => it.customizations);
    expect(all).toEqual(expect.arrayContaining([
      [],
      [{ groupId: '', groupName: '甜度', choiceIds: [], choiceNames: ['半糖'] }],
    ]));
  });
});

describe('AC-004 訂單 API 的輸出格式（手機追蹤頁使用）', () => {
  it('AC-004 GET /api/orders/:orderNo 的 customizations 是陣列，並提供 statusLog', async () => {
    const orderNo = await placeOrder();
    await advance(orderNo, kitchen);
    const res = await app.inject({ method: 'GET', url: `/api/orders/${orderNo}` });
    expect(res.statusCode).toBe(200);
    const { order } = res.json();
    expect(Array.isArray(order.items[0].customizations)).toBe(true);
    expect(order.statusLog.map((l: { status: string }) => l.status)).toEqual(['QUEUED', 'PREPARING']);
  });
});

describe('AC-004 推進後 Socket 事件送達手機端（/tracking）', () => {
  it('AC-004 KDS 推進到 READY：追蹤該訂單的手機收到 statusChanged × 4、progress × 4、ready × 1', async () => {
    const orderNo = await placeOrder();
    const other = await placeOrder();

    const phone = await connect('/tracking');
    const events: Array<{ type: string; orderNo: string; status?: string; stage?: string }> = [];
    phone.on('order:statusChanged', (p) => events.push({ type: 'statusChanged', ...p }));
    phone.on('order:progress', (p) => events.push({ type: 'progress', ...p }));
    phone.on('order:ready', (p) => events.push({ type: 'ready', ...p }));
    const ack = await new Promise<{ ok: boolean; orderNo: string }>((resolve) => phone.emit('track:order', { orderNo }, resolve));
    expect(ack).toEqual({ ok: true, orderNo });

    for (let i = 0; i < 4; i++) expect((await advance(orderNo, kitchen)).statusCode).toBe(200);
    await advance(other, kitchen); // 別張訂單的事件不應送到這支手機

    await waitFor(() => events.some((e) => e.type === 'ready'));
    await new Promise((r) => setTimeout(r, 100));

    expect(events.filter((e) => e.type === 'statusChanged').map((e) => e.status)).toEqual(['PREPARING', 'COOKING', 'PLATING', 'READY']);
    expect(events.filter((e) => e.type === 'progress').map((e) => e.stage)).toEqual(['PREPARING', 'COOKING', 'PLATING', 'READY']);
    expect(events.filter((e) => e.type === 'ready')).toHaveLength(1);
    expect(events.every((e) => e.orderNo === orderNo)).toBe(true);
  });
});

describe('AC-004 KDS 通知通道（/kds，需員工 JWT）', () => {
  it('AC-004 沒有 token、亂填 token、會員 token 都連不上 /kds', async () => {
    await expect(connect('/kds')).rejects.toThrow(/Unauthorized/);
    await expect(connect('/kds', { token: 'not-a-jwt' })).rejects.toThrow(/Unauthorized/);
    await expect(connect('/kds', { token: member.token })).rejects.toThrow(/Unauthorized/);
  });

  it('AC-004 員工連上 /kds 後，新訂單與狀態推進都會收到 kds:orderChanged', async () => {
    const kds = await connect('/kds', { token: kitchen.token });
    const events: Array<{ orderNo: string; status: string; reason: string }> = [];
    kds.on('kds:orderChanged', (p) => events.push(p));

    const orderNo = await placeOrder();
    await waitFor(() => events.length >= 1);
    expect(events[0]).toEqual({ orderNo, status: 'QUEUED', reason: 'created' });

    await advance(orderNo, kitchen);
    await waitFor(() => events.length >= 2);
    expect(events[1]).toEqual({ orderNo, status: 'PREPARING', reason: 'status' });
  });

  it('AC-004 已停用的員工連不上 /kds', async () => {
    const leaving = await createStaff(app, 'KITCHEN');
    await app.prisma.staff.update({ where: { id: leaving.id }, data: { active: false } });
    await expect(connect('/kds', { token: leaving.token })).rejects.toThrow(/Unauthorized/);
  });
});
