/**
 * 員工登入 API(AC-011)
 */
import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type { StaffLoginRequestBody, StaffLoginResponseBody } from '@smart-dining/contracts';

export async function staffLogin(username: string, password: string): Promise<StaffLoginResponseBody> {
  const payload: StaffLoginRequestBody = { username, password };
  return request<StaffLoginResponseBody>(API_PATHS.staff.login, {
    method: 'POST',
    body: payload,
    auth: 'none',
  });
}
