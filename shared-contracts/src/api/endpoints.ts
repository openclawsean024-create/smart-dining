/**
 * REST API 端點契約
 *
 * 每個端點皆定義 Path / Method / Request / Response 型別,
 * 供 backend、kiosk-frontend、mobile-app 三端共用。
 *
 * 路徑常數以 ExportRequest/ExportResponse 後綴命名,
 * 實際 HTTP 介面在 backend 端實作。
 */

import type { Category, MenuItem, CustomizationGroup } from '../types/menu.js';
import type { Cart, Order } from '../types/order.js';
import type { Member, Coupon } from '../types/member.js';

// ============================================================
// Auth
// ============================================================

export interface LoginRequestBody {
  phone: string;
}

export interface LoginResponseBody {
  code: string;
  message: string;
}

export interface VerifyRequestBody {
  phone: string;
  code: string;
}

export interface VerifyResponseBody {
  token: string;
  member: Member;
}

// ============================================================
// Menu
// ============================================================

export interface MenuResponseBody {
  categories: Array<Category & { items: Array<MenuItem & { customizationGroups: CustomizationGroup[] }> }>;
}

// ============================================================
// Orders
// ============================================================

export interface CreateOrderRequestBody {
  cart: Cart;
  memberId?: string;
  couponCode?: string;
}

export interface CreateOrderResponseBody {
  order: Order;
}

export interface GetOrderResponseBody {
  order: Order;
}

export interface GetMemberOrdersResponseBody {
  orders: Order[];
}

export interface UpdateOrderStatusRequestBody {
  status: Order['status'];
  changedBy: string;
}

export interface UpdateOrderStatusResponseBody {
  order: Order;
}

export interface AdvanceOrderResponseBody {
  order: Order;
  advanced: boolean;
}

// ============================================================
// Members
// ============================================================

export interface GetMemberResponseBody {
  member: Member;
}

export interface GetMemberCouponsResponseBody {
  coupons: Coupon[];
}

export interface AddPointsRequestBody {
  delta: number;
  reason: string;
  orderId?: string;
}

export interface AddPointsResponseBody {
  member: Member;
}

// ============================================================
// Health
// ============================================================

export interface HealthResponseBody {
  ok: true;
}

// ============================================================
// Path 常數
// ============================================================

export const API_PATHS = {
  auth: {
    login: '/api/auth/login',
    verify: '/api/auth/verify',
  },
  menu: '/api/menu',
  orders: {
    base: '/api/orders',
    byOrderNo: (orderNo: string) => `/api/orders/${orderNo}`,
    byMember: (memberId: string, limit = 20) => `/api/orders/member/${memberId}?limit=${limit}`,
    updateStatus: (orderNo: string) => `/api/orders/${orderNo}/status`,
  },
  admin: {
    advanceOrder: (orderNo: string) => `/api/admin/orders/${orderNo}/advance`,
  },
  members: {
    byId: (id: string) => `/api/members/${id}`,
    coupons: (id: string) => `/api/members/${id}/coupons`,
    addPoints: (id: string) => `/api/members/${id}/points/add`,
  },
  health: '/healthz',
} as const;