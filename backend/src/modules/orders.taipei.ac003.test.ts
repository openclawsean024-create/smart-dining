/**
 * AC-003：訂單號與取餐號依台灣時區（Asia/Taipei）每日重置，跨日不需重啟服務。
 * 以 fake timers 模擬台灣時間 23:59 → 00:01 與 07:59（UTC 仍是前一天）。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, type TestApp } from '../test/helpers.js';
import { seedDatabase } from '../seedData.js';

let t: TestApp;
let app: FastifyInstance;

const placeOrder = async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/orders',
    payload: { cart: { items: [{ menuItemId: 'item-braised-pork', quantity: 1 }] } },
  });
  expect(res.statusCode).toBe(201);
  return res.json().order as { orderNo: string; pickupNumber: number; createdAt: string };
};

/** 只替換 Date（不動 setTimeout 等），讓資料庫與 HTTP 的非同步流程照常運作。 */
const setNow = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
};

beforeAll(async () => {
  t = await createTestApp();
  app = t.app;
  await seedDatabase(app.prisma, { withDemoOrder: false });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await t.close();
});

describe('AC-003 訂單號與取餐號依台灣時區每日重置', () => {
  it('AC-003 同一個服務實例：台灣 23:59 → 00:01 跨日後流水號從 1 開始；07:59（UTC 前一天）沿用台灣日期', async () => {
    // 台灣 2026-03-10 23:59（UTC 15:59）
    setNow('2026-03-10T15:59:00Z');
    const a = await placeOrder();
    expect(a.orderNo).toBe('SD-20260310-0001');
    expect(a.pickupNumber).toBe(1);
    expect(new Date(a.createdAt).toISOString()).toBe('2026-03-10T15:59:00.000Z');

    const b = await placeOrder();
    expect(b.orderNo).toBe('SD-20260310-0002');
    expect(b.pickupNumber).toBe(2);

    // 台灣 2026-03-11 00:01（UTC 仍是 03-10 16:01）— 沒有重啟服務
    setNow('2026-03-10T16:01:00Z');
    const c = await placeOrder();
    expect(c.orderNo).toBe('SD-20260311-0001');
    expect(c.pickupNumber).toBe(1);

    // 台灣 2026-03-11 07:59（UTC 03-10 23:59，UTC 日期還是前一天）
    setNow('2026-03-10T23:59:00Z');
    const d = await placeOrder();
    expect(d.orderNo).toBe('SD-20260311-0002');
    expect(d.pickupNumber).toBe(2);

    // 台灣 2026-03-11 08:01（UTC 03-11 00:01，UTC 換日）— 台灣仍是同一天，不重置
    setNow('2026-03-11T00:01:00Z');
    const e = await placeOrder();
    expect(e.orderNo).toBe('SD-20260311-0003');
    expect(e.pickupNumber).toBe(3);

    // 台灣 2026-03-12 00:00 整
    setNow('2026-03-11T16:00:00Z');
    const f = await placeOrder();
    expect(f.orderNo).toBe('SD-20260312-0001');
    expect(f.pickupNumber).toBe(1);
  });

  it('AC-003 訂單號在資料庫中唯一，且同一台灣日的取餐號不重複', async () => {
    setNow('2026-05-01T04:00:00Z'); // 台灣 05/01 12:00
    const orders = [];
    for (let i = 0; i < 5; i++) orders.push(await placeOrder());
    expect(orders.map((o) => o.orderNo)).toEqual([
      'SD-20260501-0001', 'SD-20260501-0002', 'SD-20260501-0003', 'SD-20260501-0004', 'SD-20260501-0005',
    ]);
    expect(orders.map((o) => o.pickupNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('AC-003 同時送出多筆訂單：全部成功，訂單號與取餐號不重複', async () => {
    setNow('2026-08-01T04:00:00Z'); // 台灣 08/01 12:00
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/orders',
          payload: { cart: { items: [{ menuItemId: 'item-braised-pork', quantity: 1 }] } },
        }),
      ),
    );
    expect(results.map((r) => r.statusCode)).toEqual(Array(8).fill(201));
    const orders = results.map((r) => r.json().order as { orderNo: string; pickupNumber: number });
    expect(new Set(orders.map((o) => o.orderNo)).size).toBe(8);
    expect(orders.map((o) => o.pickupNumber).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(orders.map((o) => o.orderNo).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => 'SD-20260801-' + String(i + 1).padStart(4, '0')),
    );
  });

  it('AC-003 前一天的訂單不影響今天的流水號（即使前一天訂單很多）', async () => {
    setNow('2026-06-01T10:00:00Z'); // 台灣 06/01 18:00
    for (let i = 0; i < 3; i++) await placeOrder();
    setNow('2026-06-02T01:00:00Z'); // 台灣 06/02 09:00
    const next = await placeOrder();
    expect(next.orderNo).toBe('SD-20260602-0001');
    expect(next.pickupNumber).toBe(1);
  });
});
