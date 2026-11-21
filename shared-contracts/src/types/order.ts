/**
 * 訂單 / 購物車相關型別
 */

import type { OrderStatusLog } from './member.js';

export type OrderStatus =
  | 'QUEUED'
  | 'PREPARING'
  | 'COOKING'
  | 'PLATING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

/** 進行中的訂單狀態（後台清單與 KDS 顯示的範圍；AC-004）。 */
export const ACTIVE_ORDER_STATUSES = ['QUEUED', 'PREPARING', 'COOKING', 'PLATING', 'READY'] as const;

/**
 * 顧客在購物車中選擇的客製化明細,序列化後存入 OrderItem.customizations。
 */
export interface CartCustomizationSelection {
  groupId: string;
  groupName: string;
  choiceIds: string[];
  choiceNames: string[];
}

/**
 * 下單時每個品項要送的內容（AC-002）。
 * 後端只採用品項 ID、數量、選項 ID；價格與品名由後端從資料庫計算，前端的價格只作顯示。
 */
export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  customizations?: Array<{ groupId: string; choiceIds: string[] }>;
}

/** @deprecated 舊版購物車品項（含前端價格與品名）；下單請改用 OrderLineInput。 */
export interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  customizations: CartCustomizationSelection[];
}

export interface Cart {
  items: OrderLineInput[];
}

export interface PickupInfo {
  pickupNumber: number;
  estimatedReadyAt: string; // ISO 8601
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /**
   * 儲存 CartCustomizationSelection[]
   */
  customizations: CartCustomizationSelection[];
  subtotal: number;
}

export interface Order {
  id: string;
  orderNo: string;
  memberId?: string | null;
  totalAmount: number;
  subtotal: number;
  discount: number;
  status: OrderStatus;
  pickupNumber: number;
  estimatedReadyAt: string;
  createdAt: string;
  completedAt?: string | null;
  items: OrderItem[];
  statusLog?: OrderStatusLog[];
}
