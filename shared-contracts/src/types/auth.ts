/**
 * 認證 / JWT 相關型別
 */

import type { Member } from './member.js';
import type { StaffRole } from './staff.js';

export interface LoginRequest {
  phone: string;
}

export interface LoginResponse {
  /**
   * 只有 dev／mock OTP provider 會回傳驗證碼提示；正式簡訊 provider 不回傳。
   */
  code?: string;
  message: string;
}

export interface VerifyRequest {
  phone: string;
  code: string;
}

export interface VerifyResponse {
  token: string;
  member: Member;
}

/** 會員 JWT。舊版 token 沒有 kind 欄位，一律視為會員。 */
export interface MemberJwtPayload {
  kind?: 'member';
  sub: string; // memberId
  phone: string;
  tier: string;
  iat?: number;
  exp?: number;
}

/** 員工 JWT（AC-011）。 */
export interface StaffJwtPayload {
  kind: 'staff';
  sub: string; // staffId
  role: StaffRole;
  name: string;
  iat?: number;
  exp?: number;
}

export type JwtPayload = MemberJwtPayload | StaffJwtPayload;
