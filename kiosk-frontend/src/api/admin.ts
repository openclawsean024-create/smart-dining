/**
 * Admin API — 門市端推進訂單狀態 / 取得訂單清單(測試用)。
 */
import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type { AdvanceOrderResponseBody } from '@smart-dining/contracts';

export async function advanceOrder(orderNo: string): Promise<AdvanceOrderResponseBody> {
  return request<AdvanceOrderResponseBody>(API_PATHS.admin.advanceOrder(orderNo), {
    method: 'POST',
    noAuth: true,
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
 * 取得所有 active(QUEUED/PREPARING/COOKING/PLATING/READY)訂單的最小展示資料。
 * 後端尚未實作專屬 admin list endpoint,因此這裡呼叫 orders 並就地過濾。
 */
export async function listActiveOrders(): Promise<AdminActiveOrderItem[]> {
  // 後端目前沒有 list-all endpoint,先走 fallback:從每筆 ORDER_NO 結構未知
  // 直接 GET /api/orders 在 fastify 不存在,改為前端輪詢各筆個別,先用 mock fallback 防止拋錯。
  // 後續若 backend 補上 GET /api/admin/orders,只須替換這支實作。
  type ListResp = { orders: AdminActiveOrderItem[] };
  try {
    const res = await request<ListResp>('/api/admin/orders', { method: 'GET', noAuth: true });
    return res.orders ?? [];
  } catch {
    // 後端尚未提供此 endpoint 時回傳空陣列
    return [];
  }
}
