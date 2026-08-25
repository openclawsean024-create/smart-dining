/**
 * 認證 / JWT 相關型別
 */

import type { Member } from './member.js';

export interface LoginRequest {
  phone: string;
}

export interface LoginResponse {
  /**
   * Demo 階段固定回傳 '1234',前端以此驗證碼通過 verify。
   */
  code: string;
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

export interface JwtPayload {
  sub: string; // memberId
  phone: string;
  tier: string;
  iat?: number;
  exp?: number;
}
