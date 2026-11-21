/**
 * 後台菜單管理 API(AC-005;只有店長)。
 */
import { request } from './client';
import { API_PATHS } from '@smart-dining/contracts';
import type {
  AdminMenuItemResponseBody,
  AdminMenuResponseBody,
  MenuItemInput,
} from '@smart-dining/contracts';

export function listMenuItems(): Promise<AdminMenuResponseBody> {
  return request<AdminMenuResponseBody>(API_PATHS.admin.menuItems, { auth: 'staff' });
}

export function createMenuItem(input: MenuItemInput): Promise<AdminMenuItemResponseBody> {
  return request<AdminMenuItemResponseBody>(API_PATHS.admin.menuItems, { method: 'POST', body: input, auth: 'staff' });
}

export function updateMenuItem(id: string, patch: Partial<MenuItemInput>): Promise<AdminMenuItemResponseBody> {
  return request<AdminMenuItemResponseBody>(API_PATHS.admin.menuItem(id), { method: 'PATCH', body: patch, auth: 'staff' });
}

export function deleteMenuItem(id: string): Promise<void> {
  return request<void>(API_PATHS.admin.menuItem(id), { method: 'DELETE', auth: 'staff' });
}
