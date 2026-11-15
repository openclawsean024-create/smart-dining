/**
 * 訂單 API
 */

import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type {
  CreateOrderRequestBody,
  CreateOrderResponseBody,
  GetOrderResponseBody,
} from '@smart-dining/contracts';

export async function createOrder(payload: CreateOrderRequestBody): Promise<CreateOrderResponseBody> {
  return request<CreateOrderResponseBody>(API_PATHS.orders.base, {
    method: 'POST',
    body: payload,
    // 有登入會員時帶會員 JWT;後端以 token 判定會員身分(AC-011),訪客則不帶
    auth: 'member',
  });
}

export async function getOrder(orderNo: string): Promise<GetOrderResponseBody> {
  return request<GetOrderResponseBody>(API_PATHS.orders.byOrderNo(orderNo));
}
