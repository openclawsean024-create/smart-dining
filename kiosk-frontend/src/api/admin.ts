/**
 * Admin API — 門市端推進訂單狀態 / 取得訂單清單。皆需員工 JWT(AC-011)。
 */
import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type { AdvanceOrderResponseBody } from '@smart-dining/contracts';

export async function advanceOrder(orderNo: string): Promise<AdvanceOrderResponseBody> {
  return request<AdvanceOrderResponseBody>(API_PATHS.admin.advanceOrder(orderNo), {
    method: 'POST',
    auth: 'staff',
  });
}

export interface AdminActiveOrderItem {
  orderNo: string;
  pickupNumber: number;
  status: import('@smart-dining/contracts').OrderStatus;
  createdAt: string;
  totalAmount: number;
  itemSummary: string;
}

/**
 * 取得所有進行中訂單的最小展示資料。
 * 後端的 GET /api/admin/orders 於 AC-004 補上;在那之前失敗時回傳空陣列。
 */
export async function listActiveOrders(): Promise<AdminActiveOrderItem[]> {
  type ListResp = { orders: AdminActiveOrderItem[] };
  try {
    const res = await request<ListResp>('/api/admin/orders', { method: 'GET', auth: 'staff' });
    return res.orders ?? [];
  } catch {
    return [];
  }
}
