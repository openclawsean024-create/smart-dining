import { apiFetch } from './client';
import {
  API_PATHS,
  type GetOrderResponseBody,
  type GetMemberOrdersResponseBody,
} from '@smart-dining/contracts';

export function getOrder(orderNo: string, signal?: AbortSignal) {
  return apiFetch<GetOrderResponseBody>(API_PATHS.orders.byOrderNo(orderNo), { signal });
}

export function getMemberOrders(memberId: string, limit = 20, signal?: AbortSignal) {
  return apiFetch<GetMemberOrdersResponseBody>(API_PATHS.orders.byMember(memberId, limit), { signal });
}
