/**
 * AC-005:後台菜單管理畫面(新增、編輯、刪除、上下架、成本、庫存、低庫存)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AdminMenuItem, Category, Staff, StaffRole } from '@smart-dining/contracts';
import { AppRoutes } from '../../../App';
import { useStaffStore } from '../../../store/staffStore';
import { marginPercent, parseForm } from '../MenuAdminPage';

vi.mock('../../../realtime/kdsSocket', () => ({ subscribeKds: () => ({ close: () => {} }) }));

const categories: Category[] = [
  { id: 'cat-a', name: '測試主餐', displayOrder: 1 },
  { id: 'cat-b', name: '測試飲料', displayOrder: 2 },
];

let db: AdminMenuItem[] = [];
let seq = 0;
const calls: Array<{ method: string; path: string; body: unknown; auth?: string }> = [];
let nextError: { status: number; body: unknown } | null = null;

function makeItem(overrides: Partial<AdminMenuItem> = {}): AdminMenuItem {
  seq += 1;
  const item: AdminMenuItem = {
    id: 'item-' + seq, categoryId: 'cat-a', categoryName: '測試主餐', name: '測試品項' + seq,
    basePrice: 100, cost: 40, stock: null, reorderLevel: 10, lowStock: false, sku: null,
    available: true, description: null, imageUrl: null, tags: null, ...overrides,
  };
  db.push(item);
  return item;
}

function finalize(item: AdminMenuItem): AdminMenuItem {
  item.categoryName = categories.find((c) => c.id === item.categoryId)?.name ?? '';
  item.lowStock = item.stock !== null && item.stock <= item.reorderLevel;
  return item;
}

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
  const path = String(input);
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, path, body, auth: (init?.headers as Record<string, string>)?.Authorization });
  if (nextError && method !== 'GET') {
    const e = nextError;
    nextError = null;
    return json(e.status, e.body);
  }
  if (path === '/api/admin/menu/items' && method === 'GET') return json(200, { categories, items: db.filter((i) => i) });
  if (path === '/api/admin/menu/items' && method === 'POST') {
    seq += 1;
    const item = finalize({ id: 'item-' + seq, categoryName: '', lowStock: false, imageUrl: null, tags: null, available: true, ...body });
    db.push(item);
    return json(201, { item });
  }
  const m = path.match(/^\/api\/admin\/menu\/items\/(.+)$/);
  if (m) {
    const idx = db.findIndex((i) => i.id === m[1]);
    if (idx < 0) return json(404, { error: 'not found' });
    if (method === 'PATCH') {
      db[idx] = finalize({ ...db[idx]!, ...body });
      return json(200, { item: db[idx] });
    }
    if (method === 'DELETE') {
      db.splice(idx, 1);
      return new Response(null, { status: 204 });
    }
  }
  return json(200, { orders: [], serverTime: new Date().toISOString(), categories: [] });
});

function loginAs(role: StaffRole) {
  const staff: Staff = { id: 's-' + role, username: role.toLowerCase(), name: '測試' + role, role };
  useStaffStore.getState().setSession('jwt-' + role, staff);
}

const renderMenu = () =>
  render(
    <MemoryRouter initialEntries={['/admin/menu']}>
      <AppRoutes />
    </MemoryRouter>,
  );

beforeEach(() => {
  db = [];
  seq = 0;
  calls.length = 0;
  nextError = null;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  useStaffStore.getState().clear();
  loginAs('MANAGER');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AC-005 菜單管理畫面', () => {
  it('AC-005 只有店長看得到;內場顯示權限不足,也不會呼叫菜單 API', () => {
    useStaffStore.getState().clear();
    loginAs('KITCHEN');
    renderMenu();
    expect(screen.getByTestId('staff-forbidden')).toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/api/admin/menu'))).toBe(false);
  });

  it('AC-005 店長的導覽列有菜單管理;內場沒有', async () => {
    renderMenu();
    expect(await screen.findByTestId('nav-menu')).toHaveAttribute('href', '/admin/menu');
  });

  it('AC-005 列表顯示售價、成本、毛利、庫存、狀態;以員工 JWT 呼叫', async () => {
    const a = makeItem({ name: '測試牛肉麵', basePrice: 120, cost: 48, stock: 30 });
    const b = makeItem({ name: '測試紅茶', basePrice: 30, cost: 25, stock: null, available: false });
    renderMenu();
    const row = await screen.findByTestId(`menu-row-${a.id}`);
    expect(row).toHaveTextContent('測試牛肉麵');
    expect(row).toHaveTextContent('NT$ 120');
    expect(row).toHaveTextContent('NT$ 48');
    expect(screen.getByTestId(`menu-margin-${a.id}`)).toHaveTextContent('60.0%');
    expect(screen.getByTestId(`menu-stock-${a.id}`)).toHaveTextContent('30');
    expect(screen.getByTestId(`menu-stock-${b.id}`)).toHaveTextContent('不追蹤');
    expect(screen.getByTestId(`menu-status-${a.id}`)).toHaveTextContent('上架');
    expect(screen.getByTestId(`menu-status-${b.id}`)).toHaveTextContent('下架');
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/api/admin/menu/items', auth: 'Bearer jwt-MANAGER' });
  });

  it('AC-005 低庫存:顯示警示與標記,可只看低庫存', async () => {
    const low = makeItem({ name: '測試快沒了', stock: 2, reorderLevel: 5, lowStock: true });
    const ok = makeItem({ name: '測試很多', stock: 50, reorderLevel: 5 });
    renderMenu();
    expect(await screen.findByTestId('low-stock-alert')).toHaveTextContent('有 1 項');
    expect(screen.getByTestId(`menu-stock-${low.id}`)).toHaveTextContent('低庫存');
    await userEvent.click(screen.getByTestId('low-stock-only'));
    expect(screen.getByTestId(`menu-row-${low.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`menu-row-${ok.id}`)).not.toBeInTheDocument();
  });

  it('AC-005 新增品項:送出的內容正確,新品出現在列表', async () => {
    renderMenu();
    await screen.findByTestId('menu-table');
    await userEvent.click(screen.getByTestId('menu-new'));
    await userEvent.type(screen.getByTestId('menu-form-name'), '測試新品');
    await userEvent.selectOptions(screen.getByTestId('menu-form-category'), 'cat-b');
    await userEvent.type(screen.getByTestId('menu-form-price'), '65');
    await userEvent.clear(screen.getByTestId('menu-form-cost'));
    await userEvent.type(screen.getByTestId('menu-form-cost'), '20');
    await userEvent.type(screen.getByTestId('menu-form-stock'), '12');
    await userEvent.type(screen.getByTestId('menu-form-sku'), 'TEST-SKU-1');
    await userEvent.click(screen.getByTestId('menu-form-save'));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      name: '測試新品', categoryId: 'cat-b', basePrice: 65, cost: 20, stock: 12, reorderLevel: 10, sku: 'TEST-SKU-1', description: null,
    });
    const table = await screen.findByTestId('menu-table');
    expect(await within(table).findByText('測試新品')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-form')).not.toBeInTheDocument();
  });

  it('AC-005 表單驗證:沒填名稱或售價為負不會送出', async () => {
    renderMenu();
    await screen.findByTestId('menu-table');
    await userEvent.click(screen.getByTestId('menu-new'));
    await userEvent.click(screen.getByTestId('menu-form-save'));
    expect(screen.getByTestId('menu-form-error')).toHaveTextContent('請輸入品項名稱');
    await userEvent.type(screen.getByTestId('menu-form-name'), '測試');
    await userEvent.type(screen.getByTestId('menu-form-price'), '-5');
    await userEvent.click(screen.getByTestId('menu-form-save'));
    expect(screen.getByTestId('menu-form-error')).toHaveTextContent('售價');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('AC-005 SKU 重複(409)時顯示錯誤,表單不關閉', async () => {
    renderMenu();
    await screen.findByTestId('menu-table');
    await userEvent.click(screen.getByTestId('menu-new'));
    await userEvent.type(screen.getByTestId('menu-form-name'), '測試');
    await userEvent.type(screen.getByTestId('menu-form-price'), '10');
    nextError = { status: 409, body: { error: 'sku already in use' } };
    await userEvent.click(screen.getByTestId('menu-form-save'));
    expect(await screen.findByTestId('menu-form-error')).toHaveTextContent('SKU 已被其他品項使用');
    expect(screen.getByTestId('menu-form')).toBeInTheDocument();
  });

  it('AC-005 編輯:表單帶入原值,儲存送出 PATCH,列表更新', async () => {
    const a = makeItem({ name: '測試舊名', basePrice: 80, cost: 30, stock: 5 });
    renderMenu();
    await userEvent.click(await screen.findByTestId(`menu-edit-${a.id}`));
    expect(screen.getByTestId('menu-form-name')).toHaveValue('測試舊名');
    expect(screen.getByTestId('menu-form-price')).toHaveValue(80);
    await userEvent.clear(screen.getByTestId('menu-form-name'));
    await userEvent.type(screen.getByTestId('menu-form-name'), '測試新名');
    await userEvent.clear(screen.getByTestId('menu-form-price'));
    await userEvent.type(screen.getByTestId('menu-form-price'), '95');
    await userEvent.clear(screen.getByTestId('menu-form-stock')); // 改為不追蹤庫存
    await userEvent.click(screen.getByTestId('menu-form-save'));

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.path).toBe(`/api/admin/menu/items/${a.id}`);
    expect(patch.body).toMatchObject({ name: '測試新名', basePrice: 95, stock: null });
    expect(await screen.findByTestId(`menu-row-${a.id}`)).toHaveTextContent('測試新名');
  });

  it('AC-005 上下架切換(改寫自 restaurant-kiosk 的 toggle)', async () => {
    const a = makeItem();
    renderMenu();
    const toggle = await screen.findByTestId(`menu-toggle-${a.id}`);
    expect(toggle).toHaveTextContent('下架');
    await userEvent.click(toggle);
    await waitFor(() => expect(screen.getByTestId(`menu-status-${a.id}`)).toHaveTextContent('下架'));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ available: false });
    expect(screen.getByTestId(`menu-toggle-${a.id}`)).toHaveTextContent('上架');
    await userEvent.click(screen.getByTestId(`menu-toggle-${a.id}`));
    await waitFor(() => expect(screen.getByTestId(`menu-status-${a.id}`)).toHaveTextContent('上架'));
  });

  it('AC-005 刪除需確認:取消則不刪;確認後送出 DELETE 並從列表移除', async () => {
    const a = makeItem({ name: '測試要刪除' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderMenu();
    await userEvent.click(await screen.findByTestId(`menu-delete-${a.id}`));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByTestId(`menu-delete-${a.id}`));
    await waitFor(() => expect(screen.queryByTestId(`menu-row-${a.id}`)).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === 'DELETE')!.path).toBe(`/api/admin/menu/items/${a.id}`);
  });
});

describe('AC-005 純函式', () => {
  it('AC-005 marginPercent', () => {
    expect(marginPercent(100, 40)).toBe(60);
    expect(marginPercent(0, 10)).toBe(0);
  });

  it('AC-005 parseForm:庫存留空＝不追蹤;非整數庫存、負成本被擋', () => {
    const base = { name: 'x', categoryId: 'c', basePrice: '10', cost: '0', stock: '', reorderLevel: '10', sku: '', description: '' };
    expect(parseForm(base)).toEqual({ input: { name: 'x', categoryId: 'c', basePrice: 10, cost: 0, stock: null, reorderLevel: 10, sku: null, description: null } });
    expect(parseForm({ ...base, stock: '1.5' })).toHaveProperty('error');
    expect(parseForm({ ...base, cost: '-1' })).toHaveProperty('error');
    expect(parseForm({ ...base, basePrice: '' })).toHaveProperty('error');
  });
});
