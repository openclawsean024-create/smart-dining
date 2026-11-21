/**
 * AC-011:後台畫面需員工登入,並依角色限制。
 * (真正的授權在後端;這裡驗證前端守門與 token 的使用方式。)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Staff } from '@smart-dining/contracts';
import { RequireStaff } from '../RequireStaff';
import { useStaffStore } from '../../../store/staffStore';
import { request, ApiError } from '../../../api/client';

const kitchen: Staff = { id: 'staff-k', username: 'kitchen-test', name: '測試內場', role: 'KITCHEN' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  useStaffStore.getState().clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AC-011 RequireStaff', () => {
  it('AC-011 未登入時顯示員工登入表單,不顯示後台內容', () => {
    render(
      <RequireStaff>
        <div data-testid="secret">後台內容</div>
      </RequireStaff>,
    );
    expect(screen.getByTestId('staff-login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
  });

  it('AC-011 帳密正確 → 顯示後台內容;密碼不保存在任何 storage', async () => {
    const typedPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); // 每次隨機
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: 'staff-jwt', staff: kitchen }));
    render(
      <RequireStaff>
        <div data-testid="secret">後台內容</div>
      </RequireStaff>,
    );
    await userEvent.type(screen.getByTestId('staff-username'), 'kitchen-test');
    await userEvent.type(screen.getByTestId('staff-password'), typedPassword);
    await userEvent.click(screen.getByTestId('staff-login-submit'));

    expect(await screen.findByTestId('secret')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/staff/login');
    expect(JSON.parse(String(init?.body))).toEqual({ username: 'kitchen-test', password: typedPassword });
    expect(useStaffStore.getState().token).toBe('staff-jwt');
    const stored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(stored).not.toContain(typedPassword);
  });

  it('AC-011 帳密錯誤(401)→ 顯示錯誤訊息,仍停在登入表單', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'invalid credentials' }));
    render(
      <RequireStaff>
        <div data-testid="secret">後台內容</div>
      </RequireStaff>,
    );
    await userEvent.type(screen.getByTestId('staff-username'), 'kitchen-test');
    await userEvent.type(screen.getByTestId('staff-password'), 'wrong-password');
    await userEvent.click(screen.getByTestId('staff-login-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('帳號或密碼錯誤');
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
    expect(useStaffStore.getState().token).toBeNull();
  });

  it('AC-011 角色不在允許名單 → 顯示權限不足,不顯示內容', () => {
    useStaffStore.getState().setSession('staff-jwt', kitchen);
    render(
      <RequireStaff roles={['MANAGER']}>
        <div data-testid="secret">菜單管理</div>
      </RequireStaff>,
    );
    expect(screen.getByTestId('staff-forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
  });

  it('AC-011 角色符合 → 顯示內容', () => {
    useStaffStore.getState().setSession('staff-jwt', kitchen);
    render(
      <RequireStaff roles={['MANAGER', 'KITCHEN']}>
        <div data-testid="secret">KDS</div>
      </RequireStaff>,
    );
    expect(screen.getByTestId('secret')).toBeInTheDocument();
  });
});

describe('AC-011 API client 的員工身分', () => {
  it('AC-011 auth: staff 的請求帶員工 JWT;auth: none 不帶 Authorization', async () => {
    useStaffStore.getState().setSession('staff-jwt', kitchen);
    fetchMock.mockImplementation(async () => jsonResponse(200, { ok: true }));

    await request('/api/admin/orders', { auth: 'staff' });
    const staffHeaders = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(staffHeaders.Authorization).toBe('Bearer staff-jwt');

    await request('/api/menu', { auth: 'none' });
    const publicHeaders = fetchMock.mock.calls[1]![1]!.headers as Record<string, string>;
    expect(publicHeaders.Authorization).toBeUndefined();
  });

  it('AC-011 員工 API 回 401 → 清除登入狀態(畫面回到登入頁)', async () => {
    useStaffStore.getState().setSession('expired-jwt', kitchen);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }));
    render(
      <RequireStaff>
        <div data-testid="secret">後台內容</div>
      </RequireStaff>,
    );
    expect(screen.getByTestId('secret')).toBeInTheDocument();

    await expect(request('/api/admin/orders', { auth: 'staff' })).rejects.toBeInstanceOf(ApiError);
    await waitFor(() => expect(screen.getByTestId('staff-login-form')).toBeInTheDocument());
    expect(useStaffStore.getState().token).toBeNull();
  });
});
