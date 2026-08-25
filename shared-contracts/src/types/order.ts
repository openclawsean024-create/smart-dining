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

/**
 * 顧客在購物車中選擇的客製化明細,序列化後存入 OrderItem.customizations。
 */
export interface CartCustomizationSelection {
  groupId: string;
  groupName: string;
  choiceIds: string[];
  choiceNames: string[];
}

export interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  customizations: CartCustomizationSelection[];
}

export interface Cart {
  items: CartItem[];
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
