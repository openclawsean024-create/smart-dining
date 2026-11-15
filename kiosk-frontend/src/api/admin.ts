/**
 * Admin API — 後台訂單清單、推進與完成取餐。皆需員工 JWT(AC-011)。
 */
import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type {
  AdminOrdersResponseBody,
  AdvanceOrderResponseBody,
  UpdateOrderStatusResponseBody,
} from '@smart-dining/contracts';

/** 進行中訂單(QUEUED～READY),依建立時間由舊到新(AC-004)。 */
export async function listActiveOrders(): Promise<AdminOrdersResponseBody> {
  return request<AdminOrdersResponseBody>(API_PATHS.admin.orders, { method: 'GET', auth: 'staff' });
}

/** 推進到下一個製作階段(店長、內場)。 */
export async function advanceOrder(orderNo: string): Promise<AdvanceOrderResponseBody> {
  return request<AdvanceOrderResponseBody>(API_PATHS.admin.advanceOrder(orderNo), {
    method: 'POST',
    auth: 'staff',
  });
}

/** 顧客已取餐:READY → COMPLETED(店長、收銀)。 */
export async function completeOrder(orderNo: string): Promise<UpdateOrderStatusResponseBody> {
  return request<UpdateOrderStatusResponseBody>(API_PATHS.orders.updateStatus(orderNo), {
    method: 'PATCH',
    body: { status: 'COMPLETED' },
    auth: 'staff',
  });
}
