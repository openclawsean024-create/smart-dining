/**
 * AC-002：伺服器端計價（純函式）。
 * 案例來源：restaurant-kiosk computeLinePrice／computeCartTotal 的行為、
 * pos-multitrade pricing.test.ts 的金額驗證案例（負價、0 數量、空購物車）。
 */
import { describe, expect, it } from 'vitest';
import {
  computeDiscount, priceCart, priceLine, PricingError,
  type OrderLineInput, type PricingMenuItem,
} from './pricing.js';

const burger = (overrides: Partial<PricingMenuItem> = {}): PricingMenuItem => ({
  id: 'burger',
  name: '測試牛肉堡',
  basePrice: 179,
  available: true,
  customizationGroups: [
    {
      id: 'g-doneness', groupName: '熟度', type: 'SINGLE', required: true,
      choices: [
        { id: 'c-medium', name: '五分熟', priceDelta: 0, available: true },
        { id: 'c-well', name: '全熟', priceDelta: 0, available: true },
      ],
    },
    {
      id: 'g-addon', groupName: '加購', type: 'MULTI', required: false,
      choices: [
        { id: 'c-cheese', name: '起司片', priceDelta: 15, available: true },
        { id: 'c-bacon', name: '培根', priceDelta: 25, available: true },
        { id: 'c-soldout', name: '酪梨', priceDelta: 30, available: false },
      ],
    },
  ],
  ...overrides,
});

const fries = (overrides: Partial<PricingMenuItem> = {}): PricingMenuItem => ({
  id: 'fries',
  name: '測試薯條',
  basePrice: 30,
  available: true,
  customizationGroups: [
    {
      id: 'g-size', groupName: '份量', type: 'SINGLE', required: true,
      choices: [
        { id: 'c-small', name: '小', priceDelta: -10, available: true },
        { id: 'c-large', name: '大', priceDelta: 20, available: true },
      ],
    },
  ],
  ...overrides,
});

const latte = (overrides: Partial<PricingMenuItem> = {}): PricingMenuItem => ({
  id: 'latte', name: '測試拿鐵', basePrice: 80, available: true, customizationGroups: [], ...overrides,
});

const menuOf = (...items: PricingMenuItem[]) => new Map(items.map((i) => [i.id, i]));
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof PricingError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

describe('AC-002 priceLine：單價＝basePrice＋所選 priceDelta 加總', () => {
  it('AC-002 無客製化：拿鐵 NT$80 × 2 = NT$160', () => {
    const line = priceLine(latte(), { menuItemId: 'latte', quantity: 2 });
    expect(line).toMatchObject({ name: '測試拿鐵', unitPrice: 80, quantity: 2, subtotal: 160, customizations: [] });
  });

  it('AC-002 帶加價選項：179＋起司 15＋培根 25 = 219，× 2 = 438', () => {
    const line = priceLine(burger(), {
      menuItemId: 'burger',
      quantity: 2,
      customizations: [
        { groupId: 'g-doneness', choiceIds: ['c-medium'] },
        { groupId: 'g-addon', choiceIds: ['c-cheese', 'c-bacon'] },
      ],
    });
    expect(line.unitPrice).toBe(219);
    expect(line.subtotal).toBe(438);
  });

  it('AC-002 負的 priceDelta（小份 -10）會降低單價：30 - 10 = 20', () => {
    const line = priceLine(fries(), { menuItemId: 'fries', quantity: 3, customizations: [{ groupId: 'g-size', choiceIds: ['c-small'] }] });
    expect(line.unitPrice).toBe(20);
    expect(line.subtotal).toBe(60);
  });

  it('AC-002 品名與客製化名稱取自菜單資料，並依群組順序輸出', () => {
    const line = priceLine(burger(), {
      menuItemId: 'burger',
      quantity: 1,
      customizations: [
        { groupId: 'g-addon', choiceIds: ['c-bacon'] },
        { groupId: 'g-doneness', choiceIds: ['c-well'] },
      ],
    });
    expect(line.name).toBe('測試牛肉堡');
    expect(line.customizations).toEqual([
      { groupId: 'g-doneness', groupName: '熟度', choiceIds: ['c-well'], choiceNames: ['全熟'] },
      { groupId: 'g-addon', groupName: '加購', choiceIds: ['c-bacon'], choiceNames: ['培根'] },
    ]);
  });

  it('AC-002 輸入物件多帶的 unitPrice／name 不影響結果', () => {
    const tampered = {
      menuItemId: 'latte', quantity: 1, unitPrice: 1, name: '免費的', subtotal: 0,
    } as OrderLineInput;
    const line = priceLine(latte(), tampered);
    expect(line.unitPrice).toBe(80);
    expect(line.name).toBe('測試拿鐵');
  });
});

describe('AC-002 priceLine：驗證規則', () => {
  it.each([0, -1, 1.5, NaN, Infinity, 100, '2', null, undefined])('AC-002 CART_001：數量 %s 不是 1～99 的正整數', (quantity) => {
    expect(code(() => priceLine(latte(), { menuItemId: 'latte', quantity: quantity as number }))).toBe('CART_001');
  });

  it('AC-002 PRODUCT_001：品項為負價', () => {
    expect(code(() => priceLine(latte({ basePrice: -10 }), { menuItemId: 'latte', quantity: 1 }))).toBe('PRODUCT_001');
    expect(code(() => priceLine(latte({ basePrice: NaN }), { menuItemId: 'latte', quantity: 1 }))).toBe('PRODUCT_001');
  });

  it('AC-002 PRODUCT_001：選項折抵後單價變成負數', () => {
    const item = fries({ basePrice: 5 });
    expect(code(() => priceLine(item, { menuItemId: 'fries', quantity: 1, customizations: [{ groupId: 'g-size', choiceIds: ['c-small'] }] }))).toBe('PRODUCT_001');
  });

  it('AC-002 ITEM_UNAVAILABLE：品項已下架', () => {
    expect(code(() => priceLine(latte({ available: false }), { menuItemId: 'latte', quantity: 1 }))).toBe('ITEM_UNAVAILABLE');
  });

  it('AC-002 OPTION_REQUIRED：缺少必選群組（未送、或送空陣列）', () => {
    expect(code(() => priceLine(burger(), { menuItemId: 'burger', quantity: 1 }))).toBe('OPTION_REQUIRED');
    expect(code(() => priceLine(burger(), { menuItemId: 'burger', quantity: 1, customizations: [{ groupId: 'g-doneness', choiceIds: [] }] }))).toBe('OPTION_REQUIRED');
  });

  it('AC-002 OPTION_INVALID：群組不屬於該品項', () => {
    expect(code(() => priceLine(latte(), { menuItemId: 'latte', quantity: 1, customizations: [{ groupId: 'g-addon', choiceIds: ['c-cheese'] }] }))).toBe('OPTION_INVALID');
  });

  it('AC-002 OPTION_INVALID：選項不存在或屬於別的群組', () => {
    const base = { menuItemId: 'burger', quantity: 1 };
    expect(code(() => priceLine(burger(), { ...base, customizations: [{ groupId: 'g-doneness', choiceIds: ['no-such-choice'] }] }))).toBe('OPTION_INVALID');
    expect(code(() => priceLine(burger(), { ...base, customizations: [{ groupId: 'g-doneness', choiceIds: ['c-cheese'] }] }))).toBe('OPTION_INVALID');
  });

  it('AC-002 OPTION_INVALID：單選群組選了兩個、同一選項重複、同一群組送兩次', () => {
    const base = { menuItemId: 'burger', quantity: 1 };
    expect(code(() => priceLine(burger(), { ...base, customizations: [{ groupId: 'g-doneness', choiceIds: ['c-medium', 'c-well'] }] }))).toBe('OPTION_INVALID');
    expect(code(() => priceLine(burger(), { ...base, customizations: [{ groupId: 'g-doneness', choiceIds: ['c-medium'] }, { groupId: 'g-addon', choiceIds: ['c-cheese', 'c-cheese'] }] }))).toBe('OPTION_INVALID');
    expect(code(() => priceLine(burger(), { ...base, customizations: [{ groupId: 'g-doneness', choiceIds: ['c-medium'] }, { groupId: 'g-doneness', choiceIds: ['c-well'] }] }))).toBe('OPTION_INVALID');
  });

  it('AC-002 OPTION_UNAVAILABLE：選項已停用', () => {
    expect(code(() => priceLine(burger(), {
      menuItemId: 'burger', quantity: 1,
      customizations: [{ groupId: 'g-doneness', choiceIds: ['c-medium'] }, { groupId: 'g-addon', choiceIds: ['c-soldout'] }],
    }))).toBe('OPTION_UNAVAILABLE');
  });
});

describe('AC-002 priceCart', () => {
  it('AC-002 加總：拿鐵 80 ＋（薯條大 50 × 2）＋（牛肉堡加起司 194）= 374', () => {
    const cart = priceCart(
      [
        { menuItemId: 'latte', quantity: 1 },
        { menuItemId: 'fries', quantity: 2, customizations: [{ groupId: 'g-size', choiceIds: ['c-large'] }] },
        { menuItemId: 'burger', quantity: 1, customizations: [{ groupId: 'g-doneness', choiceIds: ['c-well'] }, { groupId: 'g-addon', choiceIds: ['c-cheese'] }] },
      ],
      menuOf(latte(), fries(), burger()),
    );
    expect(cart.lines.map((l) => l.subtotal)).toEqual([80, 100, 194]);
    expect(cart.subtotal).toBe(374);
  });

  it('AC-002 同一品項不同客製化可以是兩行，各自計價', () => {
    const cart = priceCart(
      [
        { menuItemId: 'fries', quantity: 1, customizations: [{ groupId: 'g-size', choiceIds: ['c-small'] }] },
        { menuItemId: 'fries', quantity: 1, customizations: [{ groupId: 'g-size', choiceIds: ['c-large'] }] },
      ],
      menuOf(fries()),
    );
    expect(cart.lines.map((l) => l.unitPrice)).toEqual([20, 50]);
    expect(cart.subtotal).toBe(70);
  });

  it('AC-002 ORDER_001：空購物車', () => {
    expect(code(() => priceCart([], menuOf(latte())))).toBe('ORDER_001');
  });

  it('AC-002 ITEM_NOT_FOUND：品項不存在', () => {
    expect(code(() => priceCart([{ menuItemId: 'ghost', quantity: 1 }], menuOf(latte())))).toBe('ITEM_NOT_FOUND');
  });

  it('AC-002 任何一行不合法，整張購物車都不成立', () => {
    expect(code(() => priceCart(
      [{ menuItemId: 'latte', quantity: 1 }, { menuItemId: 'latte', quantity: 0 }],
      menuOf(latte()),
    ))).toBe('CART_001');
  });
});

describe('AC-002 computeDiscount', () => {
  it('AC-002 百分比券：209 的 10% 四捨五入為 21', () => {
    expect(computeDiscount(209, { type: 'PERCENTAGE', value: 10 })).toBe(21);
  });

  it('AC-002 金額券：折抵 20；不超過小計', () => {
    expect(computeDiscount(80, { type: 'AMOUNT', value: 20 })).toBe(20);
    expect(computeDiscount(15, { type: 'AMOUNT', value: 20 })).toBe(15);
  });

  it('AC-002 沒有券或小計為 0 時折扣為 0；百分比上限 100%', () => {
    expect(computeDiscount(100, null)).toBe(0);
    expect(computeDiscount(0, { type: 'AMOUNT', value: 20 })).toBe(0);
    expect(computeDiscount(100, { type: 'PERCENTAGE', value: 150 })).toBe(100);
  });

  it('AC-002 COUPON_INVALID：負值或未知類型', () => {
    expect(code(() => computeDiscount(100, { type: 'AMOUNT', value: -5 }))).toBe('COUPON_INVALID');
    expect(code(() => computeDiscount(100, { type: 'FREE', value: 5 }))).toBe('COUPON_INVALID');
  });
});
