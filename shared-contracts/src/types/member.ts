/**
 * 會員 / 優惠券 / 點數相關型別
 */

import type { OrderStatus } from './order.js';

export type MemberTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Member {
  id: string;
  phone: string;
  name?: string | null;
  points: number;
  tier: MemberTier;
  createdAt: string;
}

export type CouponType = 'PERCENTAGE' | 'AMOUNT';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  expiresAt: string;
  usedAt?: string | null;
  memberId?: string | null;
}

export interface PointsTransaction {
  id: string;
  memberId: string;
  delta: number;
  reason: string;
  orderId?: string | null;
  createdAt: string;
}

export interface OrderStatusLog {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedAt: string;
  changedBy: string;
}
