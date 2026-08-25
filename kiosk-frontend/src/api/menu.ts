/**
 * 菜單 API
 */

import { request } from './client';
import type { MenuResponseBody } from '@smart-dining/contracts';

export async function getMenu(): Promise<MenuResponseBody> {
  return request<MenuResponseBody>('/api/menu');
}
