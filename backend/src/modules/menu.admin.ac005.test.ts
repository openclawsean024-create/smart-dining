/**
 * AC-005：菜單管理（新增、編輯、軟刪除、上下架、成本與庫存）。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createStaff, createTestApp, loginMember, TEST_PHONES,
  type MemberFixture, type StaffFixture, type TestApp,
} from '../test/helpers.js';
import { seedDatabase } from '../seedData.js';

let t: TestApp;
let app: FastifyInstance;
let manager: StaffFixture;
let cashier: StaffFixture;
let kitchen: StaffFixture;
let member: MemberFixture;

const ITEMS = '/api/admin/menu/items';
const itemUrl = (id: string) => `${ITEMS}/${id}`;

const newItem = (overrides: Record<string, unknown> = {}) => ({
  categoryId: 'cat-side',
  name: '測試新品',
  basePrice: 65,
  cost: 25,
  stock: 20,
  reorderLevel: 5,
  sku: 'TEST-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
  ...overrides,
});

async function create(body: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: ITEMS, headers: manager.headers, payload: body });
  expect(res.statusCode).toBe(201);
  return res.json().item as { id: string; [k: string]: unknown };
}

async function kioskMenuIds(): Promise<string[]> {
  const res = await app.inject({ method: 'GET', url: '/api/menu' });
  expect(res.statusCode).toBe(200);
  return res.json().categories.flatMap((c: { items: Array<{ id: string }> }) => c.items.map((i) => i.id));
}

const order = (menuItemId: string, quantity = 1) =>
  app.inject({ method: 'POST', url: '/api/orders', payload: { cart: { items: [{ menuItemId, quantity }] } } });

beforeAll(async () => {
  t = await createTestApp();
  app = t.app;
  await seedDatabase(app.prisma, { withDemoOrder: false });
  manager = await createStaff(app, 'MANAGER');
  cashier = await createStaff(app, 'CASHIER');
  kitchen = await createStaff(app, 'KITCHEN');
  member = await loginMember(app, TEST_PHONES.alice);
});

afterAll(async () => {
  await t.close();
});

describe('AC-005 權限：只有店長可以管理菜單', () => {
  it.each([
    ['GET', ITEMS],
    ['POST', ITEMS],
    ['PATCH', itemUrl('item-cola')],
    ['DELETE', itemUrl('item-cola')],
  ] as const)('AC-005 %s %s：無 token 401、會員／收銀／內場 403', async (method, url) => {
    const payload = method === 'POST' ? newItem() : method === 'PATCH' ? { available: false } : undefined;
    expect((await app.inject({ method, url, payload })).statusCode).toBe(401);
    for (const who of [member.headers, cashier.headers, kitchen.headers]) {
      expect((await app.inject({ method, url, headers: who, payload })).statusCode).toBe(403);
    }
    const cola = await app.prisma.menuItem.findUniqueOrThrow({ where: { id: 'item-cola' } });
    expect(cola.available).toBe(true);
    expect(cola.deletedAt).toBeNull();
  });
});

describe('AC-005 CRUD', () => {
  it('AC-005 列表：含成本、庫存、低庫存旗標與分類名稱，以及分類清單', async () => {
    await app.prisma.menuItem.update({ where: { id: 'item-cola' }, data: { stock: 3, reorderLevel: 10 } });
    const res = await app.inject({ method: 'GET', url: ITEMS, headers: manager.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.categories.map((c: { id: string }) => c.id)).toEqual(['cat-recommend', 'cat-main', 'cat-side', 'cat-drink']);
    const cola = body.items.find((i: { id: string }) => i.id === 'item-cola');
    expect(cola).toMatchObject({ name: '可樂(中)', basePrice: 30, cost: 12, stock: 3, reorderLevel: 10, lowStock: true, categoryName: '飲料' });
    const pork = body.items.find((i: { id: string }) => i.id === 'item-braised-pork');
    expect(pork).toMatchObject({ stock: null, lowStock: false });
    await app.prisma.menuItem.update({ where: { id: 'item-cola' }, data: { stock: null } });
  });

  it('AC-005 新增：201，出現在後台列表與 KIOSK 菜單，可以下單', async () => {
    const item = await create(newItem({ name: '測試炸物', basePrice: 70 }));
    expect(item).toMatchObject({ name: '測試炸物', basePrice: 70, cost: 25, stock: 20, available: true, categoryName: '配餐小點' });
    expect(await kioskMenuIds()).toContain(item.id);
    const res = await order(item.id, 2);
    expect(res.statusCode).toBe(201);
    expect(res.json().order.subtotal).toBe(140);
  });

  it('AC-005 新增：省略選填欄位時採預設值（成本 0、不追蹤庫存、門檻 10、上架）', async () => {
    const item = await create({ categoryId: 'cat-main', name: '測試簡單品項', basePrice: 50 });
    expect(item).toMatchObject({ cost: 0, stock: null, reorderLevel: 10, available: true, sku: null, lowStock: false });
  });

  it.each([
    [{ name: '' }],
    [{ name: '   ' }],
    [{ basePrice: -1 }],
    [{ basePrice: '50' }],
    [{ cost: -5 }],
    [{ stock: -1 }],
    [{ stock: 1.5 }],
    [{ reorderLevel: -1 }],
    [{ categoryId: 'cat-not-exist' }],
    [{ imageUrl: 'javascript:alert(1)' }],
    [{ unknownField: 1 }],
  ])('AC-005 新增不合法 %j → 400', async (patch) => {
    const before = await app.prisma.menuItem.count();
    const res = await app.inject({ method: 'POST', url: ITEMS, headers: manager.headers, payload: newItem(patch) });
    expect(res.statusCode).toBe(400);
    expect(await app.prisma.menuItem.count()).toBe(before);
  });

  it('AC-005 SKU 不可與其他未刪除品項重複（409）；刪除後可再使用', async () => {
    const a = await create(newItem({ sku: 'TEST-DUP-1' }));
    const dup = await app.inject({ method: 'POST', url: ITEMS, headers: manager.headers, payload: newItem({ sku: 'TEST-DUP-1' }) });
    expect(dup.statusCode).toBe(409);
    expect((await app.inject({ method: 'DELETE', url: itemUrl(a.id), headers: manager.headers })).statusCode).toBe(204);
    await create(newItem({ sku: 'TEST-DUP-1' }));
  });

  it('AC-005 編輯：可改名稱、售價、成本、庫存、分類；KIOSK 下單用新售價', async () => {
    const item = await create(newItem({ name: '測試舊名', basePrice: 60 }));
    const res = await app.inject({
      method: 'PATCH', url: itemUrl(item.id), headers: manager.headers,
      payload: { name: '測試新名', basePrice: 88, cost: 30, stock: 4, reorderLevel: 5, categoryId: 'cat-main' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().item).toMatchObject({ name: '測試新名', basePrice: 88, cost: 30, stock: 4, lowStock: true, categoryName: '招牌主餐' });
    const ordered = await order(item.id);
    expect(ordered.statusCode).toBe(201);
    expect(ordered.json().order.items[0]).toMatchObject({ name: '測試新名', unitPrice: 88 });
  });

  it('AC-005 編輯：stock 設 null 代表不追蹤；不合法內容 400；不存在 404；空內容 400', async () => {
    const item = await create(newItem());
    const untrack = await app.inject({ method: 'PATCH', url: itemUrl(item.id), headers: manager.headers, payload: { stock: null } });
    expect(untrack.json().item.stock).toBeNull();
    expect((await app.inject({ method: 'PATCH', url: itemUrl(item.id), headers: manager.headers, payload: { basePrice: -1 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: itemUrl(item.id), headers: manager.headers, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: itemUrl('nope'), headers: manager.headers, payload: { basePrice: 1 } })).statusCode).toBe(404);
  });

  it('AC-005 軟刪除：204；從後台列表與 KIOSK 菜單消失、下單 400；歷史訂單保留；再刪 404、不能再編輯', async () => {
    const item = await create(newItem({ name: '測試將刪除' }));
    const before = await order(item.id);
    expect(before.statusCode).toBe(201);

    expect((await app.inject({ method: 'DELETE', url: itemUrl(item.id), headers: manager.headers })).statusCode).toBe(204);

    const row = await app.prisma.menuItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.deletedAt).not.toBeNull();
    const list = (await app.inject({ method: 'GET', url: ITEMS, headers: manager.headers })).json();
    expect(list.items.map((i: { id: string }) => i.id)).not.toContain(item.id);
    expect(await kioskMenuIds()).not.toContain(item.id);

    const after = await order(item.id);
    expect(after.statusCode).toBe(400);
    expect(after.json().code).toBe('ITEM_UNAVAILABLE');

    const old = await app.inject({ method: 'GET', url: `/api/orders/${before.json().order.orderNo}` });
    expect(old.json().order.items[0].name).toBe('測試將刪除');

    expect((await app.inject({ method: 'DELETE', url: itemUrl(item.id), headers: manager.headers })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: itemUrl(item.id), headers: manager.headers, payload: { available: true } })).statusCode).toBe(404);
  });
});

describe('AC-005 上下架與庫存影響 KIOSK 菜單', () => {
  it('AC-005 下架後 GET /api/menu 不含該品項、下單 400；重新上架後恢復', async () => {
    const id = 'item-french-fries';
    expect(await kioskMenuIds()).toContain(id);

    const off = await app.inject({ method: 'PATCH', url: itemUrl(id), headers: manager.headers, payload: { available: false } });
    expect(off.statusCode).toBe(200);
    expect(off.json().item.available).toBe(false);
    expect(await kioskMenuIds()).not.toContain(id);
    const res = await order(id);
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ITEM_UNAVAILABLE');

    // 下架品項仍在後台列表（才能重新上架）
    const list = (await app.inject({ method: 'GET', url: ITEMS, headers: manager.headers })).json();
    expect(list.items.find((i: { id: string }) => i.id === id).available).toBe(false);

    await app.inject({ method: 'PATCH', url: itemUrl(id), headers: manager.headers, payload: { available: true } });
    expect(await kioskMenuIds()).toContain(id);
  });

  it('AC-005 庫存為 0：不出現在 KIOSK 菜單，下單 400（ITEM_OUT_OF_STOCK）', async () => {
    const item = await create(newItem({ stock: 0 }));
    expect(await kioskMenuIds()).not.toContain(item.id);
    const res = await order(item.id);
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ITEM_OUT_OF_STOCK');
  });

  it('AC-005 下單扣庫存；超過剩餘數量 400 且不扣；賣完後從 KIOSK 菜單消失', async () => {
    const item = await create(newItem({ stock: 3 }));
    expect((await order(item.id, 2)).statusCode).toBe(201);
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: item.id } })).stock).toBe(1);

    const tooMany = await order(item.id, 2);
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().code).toBe('ITEM_OUT_OF_STOCK');
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: item.id } })).stock).toBe(1);

    expect((await order(item.id, 1)).statusCode).toBe(201);
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: item.id } })).stock).toBe(0);
    expect(await kioskMenuIds()).not.toContain(item.id);
  });

  it('AC-005 同一品項分兩行下單，合計數量也不能超過庫存', async () => {
    const item = await create(newItem({ stock: 2 }));
    const res = await app.inject({
      method: 'POST', url: '/api/orders',
      payload: { cart: { items: [{ menuItemId: item.id, quantity: 1 }, { menuItemId: item.id, quantity: 2 }] } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ITEM_OUT_OF_STOCK');
  });

  it('AC-005 並行下單不會把庫存扣成負數', async () => {
    const item = await create(newItem({ stock: 3 }));
    const results = await Promise.all(Array.from({ length: 6 }, () => order(item.id)));
    const ok = results.filter((r) => r.statusCode === 201).length;
    expect(ok).toBe(3);
    expect(results.filter((r) => r.statusCode === 400).length).toBe(3);
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: item.id } })).stock).toBe(0);
  });

  it('AC-005 不追蹤庫存（null）的品項不受庫存限制，也不會被扣', async () => {
    const item = await create(newItem({ stock: null }));
    expect((await order(item.id, 50)).statusCode).toBe(201);
    expect((await app.prisma.menuItem.findUniqueOrThrow({ where: { id: item.id } })).stock).toBeNull();
  });

  it('AC-005 KIOSK 菜單不洩漏成本、庫存、SKU', async () => {
    const item = await create(newItem({ sku: 'TEST-SECRET-SKU', cost: 12.34 }));
    const res = await app.inject({ method: 'GET', url: '/api/menu' });
    const found = res.json().categories.flatMap((c: { items: Array<Record<string, unknown>> }) => c.items).find((i: { id: string }) => i.id === item.id);
    expect(found).toBeTruthy();
    expect(found).not.toHaveProperty('cost');
    expect(found).not.toHaveProperty('stock');
    expect(found).not.toHaveProperty('sku');
    expect(res.body).not.toContain('TEST-SECRET-SKU');
  });
});
