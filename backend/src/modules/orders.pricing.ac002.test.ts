/**
 * AC-002：POST /api/orders 伺服器端計價（Fastify inject＋測試用 SQLite）。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createTestApp, loginMember, type MemberFixture, type TestApp } from '../test/helpers.js';
import { REPO_ROOT } from '../test/paths.js';
import { DEMO_COUPONS, DEMO_MEMBERS, demoChoiceId, demoGroupId, seedDatabase } from '../seedData.js';

let t: TestApp;
let app: FastifyInstance;
let vip: MemberFixture;
let guestMember: MemberFixture;

// seed 的經典脆雞：basePrice 149；群組 1 主食（必選；玉米蛋堡 +10）、群組 2 醬料（必選）、群組 3 加購（薯條 +30、雞塊 +49、可樂 +15）
const CHICKEN = 'item-crispy-chicken';
const chickenSelections = (extra: Array<{ groupId: string; choiceIds: string[] }> = []) => [
  { groupId: demoGroupId(CHICKEN, 0), choiceIds: [demoChoiceId(CHICKEN, 0, 0)] }, // 白飯 +0
  { groupId: demoGroupId(CHICKEN, 1), choiceIds: [demoChoiceId(CHICKEN, 1, 0)] }, // 醬油 +0
  ...extra,
];
// seed 的招牌滷肉飯：basePrice 80，沒有必選群組
const PORK = 'item-braised-pork';

const post = (payload: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url: '/api/orders', payload: payload as object, headers });

beforeAll(async () => {
  t = await createTestApp();
  app = t.app;
  await seedDatabase(app.prisma, { withDemoOrder: false });
  vip = await loginMember(app, DEMO_MEMBERS.vip.phone);
  guestMember = await loginMember(app, DEMO_MEMBERS.guest.phone);
});

afterAll(async () => {
  await t.close();
});

describe('AC-002 POST /api/orders 伺服器端計價', () => {
  it('AC-002 帶加價選項的總額：149＋玉米蛋堡 10＋薯條 30＋可樂 15 = 204，× 2 = 408', async () => {
    const res = await post({
      cart: {
        items: [{
          menuItemId: CHICKEN,
          quantity: 2,
          customizations: [
            { groupId: demoGroupId(CHICKEN, 0), choiceIds: [demoChoiceId(CHICKEN, 0, 2)] }, // 玉米蛋堡 +10
            { groupId: demoGroupId(CHICKEN, 1), choiceIds: [demoChoiceId(CHICKEN, 1, 1)] }, // 辣油 +0
            { groupId: demoGroupId(CHICKEN, 2), choiceIds: [demoChoiceId(CHICKEN, 2, 0), demoChoiceId(CHICKEN, 2, 2)] }, // 薯條 +30、可樂 +15
          ],
        }],
      },
    });
    expect(res.statusCode).toBe(201);
    const { order } = res.json();
    expect(order.subtotal).toBe(408);
    expect(order.discount).toBe(0);
    expect(order.totalAmount).toBe(408);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ menuItemId: CHICKEN, name: '經典脆雞', quantity: 2, unitPrice: 204, subtotal: 408 });

    const stored = await app.prisma.orderItem.findFirstOrThrow({ where: { order: { orderNo: order.orderNo } } });
    expect(stored.unitPrice).toBe(204);
    expect(JSON.parse(stored.customizations)).toEqual([
      { groupId: demoGroupId(CHICKEN, 0), groupName: '主食選擇', choiceIds: [demoChoiceId(CHICKEN, 0, 2)], choiceNames: ['玉米蛋堡'] },
      { groupId: demoGroupId(CHICKEN, 1), groupName: '醬料選擇', choiceIds: [demoChoiceId(CHICKEN, 1, 1)], choiceNames: ['辣油'] },
      { groupId: demoGroupId(CHICKEN, 2), groupName: '加購', choiceIds: [demoChoiceId(CHICKEN, 2, 0), demoChoiceId(CHICKEN, 2, 2)], choiceNames: ['薯條', '可樂(中)'] },
    ]);
  });

  it('AC-002 竄改前端 unitPrice 無效：送 unitPrice 1、subtotal 1、totalAmount 1，仍以資料庫價格計算', async () => {
    const res = await post({
      cart: { items: [{ menuItemId: PORK, quantity: 3, unitPrice: 1, subtotal: 1, customizations: [] }] },
      totalAmount: 1,
      subtotal: 1,
      discount: 999,
    });
    expect(res.statusCode).toBe(201);
    const { order } = res.json();
    expect(order.items[0].unitPrice).toBe(80);
    expect(order.subtotal).toBe(240);
    expect(order.discount).toBe(0);
    expect(order.totalAmount).toBe(240);
  });

  it('AC-002 品項名稱與客製化名稱取自資料庫，不採用前端傳入值', async () => {
    const res = await post({
      cart: {
        items: [{
          menuItemId: CHICKEN,
          name: '<script>alert(1)</script>',
          quantity: 1,
          customizations: chickenSelections().map((c) => ({ ...c, groupName: '假群組', choiceNames: ['假選項'] })),
        }],
      },
    });
    expect(res.statusCode).toBe(201);
    const item = res.json().order.items[0];
    expect(item.name).toBe('經典脆雞');
    expect(JSON.stringify(item.customizations)).not.toContain('假');
    expect(res.body).not.toContain('script');
  });

  it('AC-002 缺必選群組 400（OPTION_REQUIRED），不建立訂單', async () => {
    const before = await app.prisma.order.count();
    const none = await post({ cart: { items: [{ menuItemId: CHICKEN, quantity: 1 }] } });
    expect(none.statusCode).toBe(400);
    expect(none.json().code).toBe('OPTION_REQUIRED');
    const partial = await post({
      cart: { items: [{ menuItemId: CHICKEN, quantity: 1, customizations: [{ groupId: demoGroupId(CHICKEN, 0), choiceIds: [demoChoiceId(CHICKEN, 0, 0)] }] }] },
    });
    expect(partial.statusCode).toBe(400);
    expect(partial.json().code).toBe('OPTION_REQUIRED');
    expect(await app.prisma.order.count()).toBe(before);
  });

  it('AC-002 下架品項 400（ITEM_UNAVAILABLE）', async () => {
    await app.prisma.menuItem.update({ where: { id: 'item-bubble-tea' }, data: { available: false } });
    try {
      const res = await post({
        cart: {
          items: [{
            menuItemId: 'item-bubble-tea',
            quantity: 1,
            customizations: [
              { groupId: demoGroupId('item-bubble-tea', 0), choiceIds: [demoChoiceId('item-bubble-tea', 0, 0)] },
              { groupId: demoGroupId('item-bubble-tea', 1), choiceIds: [demoChoiceId('item-bubble-tea', 1, 0)] },
            ],
          }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('ITEM_UNAVAILABLE');
    } finally {
      await app.prisma.menuItem.update({ where: { id: 'item-bubble-tea' }, data: { available: true } });
    }
  });

  it('AC-002 不存在的品項 400（ITEM_NOT_FOUND）', async () => {
    const res = await post({ cart: { items: [{ menuItemId: 'item-does-not-exist', quantity: 1 }] } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ITEM_NOT_FOUND');
  });

  it('AC-002 不存在的選項、別的品項的選項、已停用的選項皆 400', async () => {
    const ghost = await post({
      cart: { items: [{ menuItemId: PORK, quantity: 1, customizations: [{ groupId: demoGroupId(PORK, 1), choiceIds: ['no-such-choice'] }] }] },
    });
    expect(ghost.statusCode).toBe(400);
    expect(ghost.json().code).toBe('OPTION_INVALID');

    const foreign = await post({
      cart: { items: [{ menuItemId: PORK, quantity: 1, customizations: [{ groupId: demoGroupId(CHICKEN, 2), choiceIds: [demoChoiceId(CHICKEN, 2, 0)] }] }] },
    });
    expect(foreign.statusCode).toBe(400);
    expect(foreign.json().code).toBe('OPTION_INVALID');

    const eggId = demoChoiceId(PORK, 1, 0); // 加蛋
    await app.prisma.customizationChoice.update({ where: { id: eggId }, data: { available: false } });
    try {
      const disabled = await post({
        cart: { items: [{ menuItemId: PORK, quantity: 1, customizations: [{ groupId: demoGroupId(PORK, 1), choiceIds: [eggId] }] }] },
      });
      expect(disabled.statusCode).toBe(400);
      expect(disabled.json().code).toBe('OPTION_UNAVAILABLE');
    } finally {
      await app.prisma.customizationChoice.update({ where: { id: eggId }, data: { available: true } });
    }
  });

  it.each([0, -1, 1.5, 100, '2', null])('AC-002 非正整數數量 %s 回 400', async (quantity) => {
    const res = await post({ cart: { items: [{ menuItemId: PORK, quantity }] } });
    expect(res.statusCode).toBe(400);
  });

  it('AC-002 負價品項 400（PRODUCT_001）', async () => {
    await app.prisma.menuItem.update({ where: { id: 'item-cola' }, data: { basePrice: -30 } });
    try {
      const res = await post({
        cart: {
          items: [{
            menuItemId: 'item-cola',
            quantity: 1,
            customizations: [
              { groupId: demoGroupId('item-cola', 0), choiceIds: [demoChoiceId('item-cola', 0, 0)] },
              { groupId: demoGroupId('item-cola', 1), choiceIds: [demoChoiceId('item-cola', 1, 0)] },
            ],
          }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('PRODUCT_001');
    } finally {
      await app.prisma.menuItem.update({ where: { id: 'item-cola' }, data: { basePrice: 30 } });
    }
  });

  it.each([
    [{}],
    [{ cart: {} }],
    [{ cart: { items: [] } }],
    [{ cart: { items: 'x' } }],
    [{ cart: { items: [{ quantity: 1 }] } }],
    [{ cart: { items: [{ menuItemId: PORK, quantity: 1, customizations: [{ groupId: 'g' }] }] } }],
  ])('AC-002 不合法的 body %j 回 400', async (body) => {
    const res = await post(body);
    expect(res.statusCode).toBe(400);
  });

  it('AC-002 會員點數依後端計算的小計累積（竄改價格無法多拿點數）', async () => {
    const before = await app.prisma.member.findUniqueOrThrow({ where: { id: guestMember.id } });
    const res = await post(
      { cart: { items: [{ menuItemId: PORK, quantity: 1, unitPrice: 99999 }] } },
      guestMember.headers,
    );
    expect(res.statusCode).toBe(201);
    const after = await app.prisma.member.findUniqueOrThrow({ where: { id: guestMember.id } });
    expect(after.points - before.points).toBe(80);
  });
});

describe('AC-002 優惠券以資料庫為準', () => {
  it.each(['WELCOME10', 'SAVE50'])('AC-002 舊 KIOSK 寫死的券碼 %s 不在資料庫 → 400（COUPON_INVALID）', async (couponCode) => {
    const res = await post({ cart: { items: [{ menuItemId: PORK, quantity: 1 }] }, couponCode }, vip.headers);
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('COUPON_INVALID');
  });

  it('AC-002 會員可用券由 GET /api/members/:id/coupons 提供，內容與資料庫一致', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/members/${vip.id}/coupons`, headers: vip.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().coupons.map((c: { code: string }) => c.code)).toEqual([DEMO_COUPONS.vip10.code]);
  });

  it('AC-002 資料庫的 WELCOME（折抵 20）：小計 80 → 折 20 → 總額 60，且只能用一次', async () => {
    const payload = { cart: { items: [{ menuItemId: PORK, quantity: 1 }] }, couponCode: DEMO_COUPONS.welcome.code };
    const res = await post(payload, guestMember.headers);
    expect(res.statusCode).toBe(201);
    expect(res.json().order).toMatchObject({ subtotal: 80, discount: 20, totalAmount: 60 });

    const again = await post(payload, guestMember.headers);
    expect(again.statusCode).toBe(400);
    expect(again.json().code).toBe('COUPON_INVALID');
  });

  it('AC-002 資料庫的 VIP10（9 折）套用在含加價的小計：(149＋30) × 10% = 18（四捨五入）→ 總額 161', async () => {
    const res = await post(
      {
        cart: { items: [{ menuItemId: CHICKEN, quantity: 1, customizations: chickenSelections([{ groupId: demoGroupId(CHICKEN, 2), choiceIds: [demoChoiceId(CHICKEN, 2, 0)] }]) }] },
        couponCode: DEMO_COUPONS.vip10.code,
      },
      vip.headers,
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().order).toMatchObject({ subtotal: 179, discount: 18, totalAmount: 161 });
    const coupon = await app.prisma.coupon.findUniqueOrThrow({ where: { code: DEMO_COUPONS.vip10.code } });
    expect(coupon.usedAt).not.toBeNull();
  });

  it('AC-002 過期的券 400；計價失敗時券不會被標記為已使用', async () => {
    await app.prisma.coupon.create({
      data: { code: 'TEST-EXPIRED', type: 'AMOUNT', value: 10, memberId: vip.id, expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await post({ cart: { items: [{ menuItemId: PORK, quantity: 1 }] }, couponCode: 'TEST-EXPIRED' }, vip.headers);
    expect(expired.statusCode).toBe(400);

    await app.prisma.coupon.create({
      data: { code: 'TEST-VALID', type: 'AMOUNT', value: 10, memberId: vip.id, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const badCart = await post({ cart: { items: [{ menuItemId: 'item-does-not-exist', quantity: 1 }] }, couponCode: 'TEST-VALID' }, vip.headers);
    expect(badCart.statusCode).toBe(400);
    const coupon = await app.prisma.coupon.findUniqueOrThrow({ where: { code: 'TEST-VALID' } });
    expect(coupon.usedAt).toBeNull();
  });
});

describe('AC-002 KIOSK 不再寫死券碼', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
    }
    return out;
  }

  it('AC-002 kiosk-frontend 原始碼沒有 WELCOME10／SAVE50／VIP10／WELCOME 等寫死的券碼', () => {
    const offenders: string[] = [];
    for (const file of walk(join(REPO_ROOT, 'kiosk-frontend', 'src'))) {
      const text = readFileSync(file, 'utf8');
      if (/WELCOME10|SAVE50|['"`]VIP10['"`]|['"`]WELCOME['"`]/.test(text)) offenders.push(relative(REPO_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
