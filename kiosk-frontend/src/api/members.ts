/**
 * 會員 API(需會員 JWT;只能查自己的資料,AC-011)
 */
import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type { GetMemberCouponsResponseBody } from '@smart-dining/contracts';

/** 取得會員目前可用的優惠券(未使用、未過期);券碼以資料庫為準(AC-002)。 */
export async function getMemberCoupons(memberId: string): Promise<GetMemberCouponsResponseBody> {
  return request<GetMemberCouponsResponseBody>(API_PATHS.members.coupons(memberId), { auth: 'member' });
}
