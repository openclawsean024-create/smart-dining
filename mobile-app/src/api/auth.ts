import { apiFetch } from './client';
import { API_PATHS, type LoginRequestBody, type LoginResponseBody, type VerifyRequestBody, type VerifyResponseBody } from '@smart-dining/contracts';

export function requestLoginCode(phone: string) {
  const body: LoginRequestBody = { phone };
  return apiFetch<LoginResponseBody>(API_PATHS.auth.login, { method: 'POST', body });
}

export function verifyLoginCode(phone: string, code: string) {
  const body: VerifyRequestBody = { phone, code };
  return apiFetch<VerifyResponseBody>(API_PATHS.auth.verify, { method: 'POST', body });
}
