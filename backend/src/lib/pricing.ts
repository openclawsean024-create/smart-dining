/**
 * 伺服器端計價（AC-002 / FR-002）。
 *
 * 純函式、不碰資料庫：呼叫端先把品項（含客製化群組與選項）查出來再傳進來。
 * - 客製化加價計算改寫自 restaurant-kiosk `web/src/lib/helpers.ts` 的 computeLinePrice／computeCartTotal（SPEC §12.1 #1）
 * - 金額驗證規則改寫自 pos-multitrade `src/lib/pricing.ts`（負價、非正整數數量、空購物車；SPEC §12.1 #9）
 *
 * 前端傳入的價格與品名一律不採用；單價＝basePrice＋所選選項 priceDelta 加總，品名取自資料庫。
 */
import type { CartCustomizationSelection } from '../../../shared-contracts/src/index.js';

export type PricingErrorCode =
  | 'ORDER_001' // 購物車為空
  | 'CART_001' // 數量必須為正整數
  | 'PRODUCT_001' // 品項價格錯誤（負價、非數字）
  | 'ITEM_NOT_FOUND' // 品項不存在
  | 'ITEM_UNAVAILABLE' // 品項已下架或已刪除
  | 'ITEM_OUT_OF_STOCK' // 庫存為 0 或不足（AC-005）
  | 'OPTION_INVALID' // 選項或群組不屬於該品項、重複、單選群組選了多個
  | 'OPTION_UNAVAILABLE' // 選項已停用
  | 'OPTION_REQUIRED' // 缺少必選群組
  | 'COUPON_INVALID'; // 優惠券不存在、已使用、過期或不屬於該會員

/** 計價或下單驗證失敗；路由層一律轉成 HTTP 400。 */
export class PricingError extends Error {
  readonly code: PricingErrorCode;
  constructor(code: PricingErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'PricingError';
    this.code = code;
  }
}

export const MAX_LINE_QUANTITY = 99;

export interface PricingChoice {
  id: string;
  name: string;
  priceDelta: number;
  available: boolean;
}

export interface PricingGroup {
  id: string;
  groupName: string;
  type: string; // 'SINGLE' | 'MULTI'
  required: boolean;
  choices: PricingChoice[];
}

export interface PricingMenuItem {
  id: string;
  name: string;
  basePrice: number;
  available: boolean;
  /** 軟刪除時間；有值視同下架 */
  deletedAt?: Date | null;
  /** 庫存；null／undefined＝不追蹤 */
  stock?: number | null;
  customizationGroups: PricingGroup[];
}

/** 前端下單時每一行只需要（也只採用）這些欄位。 */
export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  customizations?: Array<{ groupId: string; choiceIds: string[] }>;
}

export interface PricedLine {
  menuItemId: string;
  /** 取自資料庫的品名 */
  name: string;
  quantity: number;
  /** basePrice＋所選 priceDelta 加總 */
  unitPrice: number;
  subtotal: number;
  /** 以資料庫的群組／選項名稱重建，存入 OrderItem.customizations */
  customizations: CartCustomizationSelection[];
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
}

function assertValidQuantity(quantity: unknown): asserts quantity is number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_LINE_QUANTITY) {
    throw new PricingError('CART_001', `quantity must be an integer between 1 and ${MAX_LINE_QUANTITY}`);
  }
}

/**
 * 單一品項在指定選項下的單價：basePrice＋Σ priceDelta。
 * 同時驗證選項是否合法，回傳以資料庫名稱重建的客製化明細。
 */
export function priceLine(item: PricingMenuItem, input: OrderLineInput): PricedLine {
  assertValidQuantity(input.quantity);
  if (!item.available || item.deletedAt) {
    throw new PricingError('ITEM_UNAVAILABLE', `menu item ${item.id} is not available`);
  }
  if (item.stock != null && item.stock <= 0) {
    throw new PricingError('ITEM_OUT_OF_STOCK', `menu item ${item.id} is out of stock`);
  }
  if (!Number.isFinite(item.basePrice) || item.basePrice < 0) {
    throw new PricingError('PRODUCT_001', `menu item ${item.id} has an invalid price`);
  }

  const groupsById = new Map(item.customizationGroups.map((g) => [g.id, g]));
  const selectedByGroup = new Map<string, string[]>();
  for (const sel of input.customizations ?? []) {
    const group = groupsById.get(sel.groupId);
    if (!group) {
      throw new PricingError('OPTION_INVALID', `group ${sel.groupId} does not belong to menu item ${item.id}`);
    }
    if (selectedByGroup.has(group.id)) {
      throw new PricingError('OPTION_INVALID', `group ${group.id} is selected more than once`);
    }
    if (new Set(sel.choiceIds).size !== sel.choiceIds.length) {
      throw new PricingError('OPTION_INVALID', `group ${group.id} has duplicate choices`);
    }
    if (group.type === 'SINGLE' && sel.choiceIds.length > 1) {
      throw new PricingError('OPTION_INVALID', `group ${group.id} allows only one choice`);
    }
    selectedByGroup.set(group.id, sel.choiceIds);
  }

  let unitPrice = item.basePrice;
  const customizations: CartCustomizationSelection[] = [];
  // 依菜單定義的群組順序輸出，並檢查必選
  for (const group of item.customizationGroups) {
    const choiceIds = selectedByGroup.get(group.id) ?? [];
    if (group.required && choiceIds.length === 0) {
      throw new PricingError('OPTION_REQUIRED', `group ${group.id} (${group.groupName}) is required`);
    }
    if (choiceIds.length === 0) continue;
    const choiceNames: string[] = [];
    for (const choiceId of choiceIds) {
      const choice = group.choices.find((c) => c.id === choiceId);
      if (!choice) {
        throw new PricingError('OPTION_INVALID', `choice ${choiceId} does not belong to group ${group.id}`);
      }
      if (!choice.available) {
        throw new PricingError('OPTION_UNAVAILABLE', `choice ${choiceId} is not available`);
      }
      if (!Number.isFinite(choice.priceDelta)) {
        throw new PricingError('PRODUCT_001', `choice ${choiceId} has an invalid price`);
      }
      unitPrice += choice.priceDelta;
      choiceNames.push(choice.name);
    }
    customizations.push({ groupId: group.id, groupName: group.groupName, choiceIds: [...choiceIds], choiceNames });
  }

  if (unitPrice < 0) {
    throw new PricingError('PRODUCT_001', `menu item ${item.id} resolves to a negative price`);
  }

  return {
    menuItemId: item.id,
    name: item.name,
    quantity: input.quantity,
    unitPrice,
    subtotal: Math.round(unitPrice * input.quantity),
    customizations,
  };
}

/** 整張購物車的計價。menu 以品項 ID 為 key。 */
export function priceCart(inputs: OrderLineInput[], menu: ReadonlyMap<string, PricingMenuItem>): PricedCart {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new PricingError('ORDER_001', 'cart is empty');
  }
  const lines = inputs.map((input) => {
    const item = menu.get(input.menuItemId);
    if (!item) {
      throw new PricingError('ITEM_NOT_FOUND', `menu item ${input.menuItemId} does not exist`);
    }
    return priceLine(item, input);
  });
  // 同一品項分成多行（不同客製化）時，合計數量也不能超過庫存
  const qtyByItem = new Map<string, number>();
  for (const l of lines) qtyByItem.set(l.menuItemId, (qtyByItem.get(l.menuItemId) ?? 0) + l.quantity);
  for (const [id, qty] of qtyByItem) {
    const stock = menu.get(id)?.stock;
    if (stock != null && qty > stock) {
      throw new PricingError('ITEM_OUT_OF_STOCK', `menu item ${id} has only ${stock} left`);
    }
  }
  return { lines, subtotal: lines.reduce((sum, l) => sum + l.subtotal, 0) };
}

export interface PricingCoupon {
  type: string; // 'PERCENTAGE' | 'AMOUNT'
  value: number;
}

/** 折扣金額（整數）：百分比券四捨五入；金額券不超過小計。 */
export function computeDiscount(subtotal: number, coupon: PricingCoupon | null | undefined): number {
  if (!coupon || subtotal <= 0) return 0;
  if (!Number.isFinite(coupon.value) || coupon.value < 0) {
    throw new PricingError('COUPON_INVALID', 'coupon has an invalid value');
  }
  if (coupon.type === 'PERCENTAGE') {
    return Math.min(subtotal, Math.round((subtotal * Math.min(coupon.value, 100)) / 100));
  }
  if (coupon.type === 'AMOUNT') {
    return Math.min(subtotal, Math.round(coupon.value));
  }
  throw new PricingError('COUPON_INVALID', `unknown coupon type ${coupon.type}`);
}
