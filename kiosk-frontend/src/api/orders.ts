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
    noAuth: true, // 訂單建立時不一定登入(token 由 memberId 取代)
  });
}

export async function getOrder(orderNo: string): Promise<GetOrderResponseBody> {
  return request<GetOrderResponseBody>(API_PATHS.orders.byOrderNo(orderNo));
}
