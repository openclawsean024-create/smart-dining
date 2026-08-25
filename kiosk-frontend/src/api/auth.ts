/**
 * 認證 API(會員手機 + 驗證碼登入)
 *
 * Demo 流程:
 *   1. POST /api/auth/login { phone } → 回傳驗證碼(1234)
 *   2. POST /api/auth/verify { phone, code } → 回傳 JWT + Member
 */

import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type {
  LoginRequestBody,
  LoginResponseBody,
  VerifyRequestBody,
  VerifyResponseBody,
} from '@smart-dining/contracts';

export async function login(phone: string): Promise<LoginResponseBody> {
  const payload: LoginRequestBody = { phone };
  return request<LoginResponseBody>(API_PATHS.auth.login, {
    method: 'POST',
    body: payload,
    noAuth: true,
  });
}

export async function verify(phone: string, code: string): Promise<VerifyResponseBody> {
  const payload: VerifyRequestBody = { phone, code };
  return request<VerifyResponseBody>(API_PATHS.auth.verify, {
    method: 'POST',
    body: payload,
    noAuth: true,
  });
}
