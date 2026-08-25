import { apiFetch } from './client';
import {
  API_PATHS,
  type GetMemberResponseBody,
  type GetMemberCouponsResponseBody,
} from '@smart-dining/contracts';

export function getMember(id: string, signal?: AbortSignal) {
  return apiFetch<GetMemberResponseBody>(API_PATHS.members.byId(id), { signal });
}

export function getMemberCoupons(id: string, signal?: AbortSignal) {
  return apiFetch<GetMemberCouponsResponseBody>(API_PATHS.members.coupons(id), { signal });
}
