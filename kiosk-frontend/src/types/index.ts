/**
 * 重新匯出 @smart-dining/contracts 共用型別,
 * 並補上 KIOSK 前端用到的擴充型別。
 */

export * from '@smart-dining/contracts';

import type { MenuItem, CustomizationGroup } from '@smart-dining/contracts';

/**
 * 購物車內的品項,包含客製化選擇(用於 cartStore)。
 */
export interface CartLine {
  /** localStorage 用的 stable id */
  lineId: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  imageUrl?: string | null;
  quantity: number;
  /** 已選的客製化:groupId → choiceIds[] */
  customizations: Record<string, string[]>;
  /** 客製化群組快取(送出訂單時用) */
  customizationGroups: CustomizationGroup[];
  /** 計算後的單價(含客製化加價) */
  unitPrice: number;
}

/**
 * 加入購物車時的最小輸入。
 */
export interface AddToCartInput {
  menuItem: MenuItem & { customizationGroups?: CustomizationGroup[] };
  quantity: number;
  customizations: Record<string, string[]>;
}

/**
 * CartLine 的價格細節。
 */
export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  total: number;
}

/**
 * 結帳時選擇的優惠券。
 */
export interface SelectedCoupon {
  code: string;
  type: 'PERCENTAGE' | 'AMOUNT';
  value: number;
  label: string;
}

/**
 * 已登入的會員資訊(從 localStorage 還原)。
 */
export interface AuthSession {
  token: string;
  member: import('@smart-dining/contracts').Member;
}

/**
 * 訂單回應的最小展示用型別(CompletePage)。
 */
export interface OrderDisplay {
  orderNo: string;
  pickupNumber: number;
  estimatedReadyAt: string;
  status: import('@smart-dining/contracts').OrderStatus;
  totalAmount: number;
}

/**
 * 自訂 choice 解析後的明細(顯示用)。
 */
export interface ResolvedCustomization {
  groupName: string;
  choiceNames: string[];
}
