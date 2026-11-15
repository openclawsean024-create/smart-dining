/**
 * AC-004:KDS 廚房顯示系統。
 *
 * 前 6 個測試改寫自 restaurant-kiosk `web/tests/e2e.test.tsx` 的
 * 「Sprint 2 - KDS 廚房顯示系統」6 個情境(SPEC §12.1 #2,全數保留):
 *   原版用 localStorage 的 createOrder()/listOrders();這裡改成後端 API(以 fetch mock 模擬)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AdminOrder, KdsOrderChangedEvent, OrderStatus, Staff, StaffRole } from '@smart-dining/contracts';
import { AppRoutes } from '../../../App';
import { useStaffStore } from '../../../store/staffStore';
import { elapsedLabel, kdsAction, sortByWaiting } from '../../../lib/kds';

// --- Socket:不連線,只記下 KDS 註冊的 callback,讓測試可以模擬後端通知 ---
const kdsSocket = vi.hoisted(() => ({
  onChange: null as null | ((e: KdsOrderChangedEvent) => void),
  tokens: [] as string[],
  closed: 0,
}));
vi.mock('../../../realtime/kdsSocket', () => ({
  subscribeKds: (token: string, handlers: { onChange: (e: KdsOrderChangedEvent) => void }) => {
    kdsSocket.tokens.push(token);
    kdsSocket.onChange = handlers.onChange;
    return { close: () => { kdsSocket.closed += 1; } };
  },
}));

// --- 假後端:記憶體內的訂單清單 ---
const SERVER_NOW = new Date('2026-04-01T04:00:00.000Z').getTime();
let db: AdminOrder[] = [];
let seq = 0;
const calls: Array<{ method: string; path: string; auth: string | undefined; body: unknown }> = [];
let failList = false;

const NEXT: Record<string, OrderStatus> = { QUEUED: 'PREPARING', PREPARING: 'COOKING', COOKING: 'PLATING', PLATING: 'READY' };

/** 對應原版測試的 createOrder():在假後端建立一筆訂單。 */
function createOrder(opts: { minutesAgo?: number; status?: OrderStatus; items?: AdminOrder['items'] } = {}): AdminOrder {
  seq += 1;
  const orderNo = 'SD-20260401-' + String(seq).padStart(4, '0');
  const order: AdminOrder = {
    id: 'order-' + seq,
    orderNo,
    memberId: null,
    totalAmount: 100,
    subtotal: 100,
    discount: 0,
    status: opts.status ?? 'QUEUED',
    pickupNumber: seq,
    estimatedReadyAt: new Date(SERVER_NOW + 180_000).toISOString(),
    createdAt: new Date(SERVER_NOW - (opts.minutesAgo ?? 0) * 60_000).toISOString(),
    items: opts.items ?? [
      { id: 'item-' + seq, orderId: 'order-' + seq, menuItemId: 'm1', name: '測試餐點', quantity: 1, unitPrice: 100, subtotal: 100, customizations: [] },
    ],
    itemSummary: '測試餐點 x 1',
  };
  db.push(order);
  return order;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
  const path = String(input);
  const method = init?.method ?? 'GET';
  const headers = (init?.headers ?? {}) as Record<string, string>;
  calls.push({ method, path, auth: headers.Authorization, body: init?.body ? JSON.parse(String(init.body)) : undefined });

  if (method === 'GET' && path === '/api/admin/orders') {
    if (failList) return jsonResponse(500, { error: 'boom' });
    const active = db.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    return jsonResponse(200, { orders: active, serverTime: new Date(SERVER_NOW).toISOString() });
  }
  const advance = path.match(/^\/api\/admin\/orders\/(.+)\/advance$/);
  if (method === 'POST' && advance) {
    const order = db.find((o) => o.orderNo === advance[1]);
    if (!order) return jsonResponse(404, { error: 'order not found' });
    order.status = NEXT[order.status] ?? order.status;
    return jsonResponse(200, { order, advanced: true });
  }
  const status = path.match(/^\/api\/orders\/(.+)\/status$/);
  if (method === 'PATCH' && status) {
    const order = db.find((o) => o.orderNo === status[1]);
    if (!order) return jsonResponse(404, { error: 'not found' });
    order.status = (JSON.parse(String(init!.body)) as { status: OrderStatus }).status;
    return jsonResponse(200, { order });
  }
  // 其他(例如 KIOSK 菜單)一律回空資料
  return jsonResponse(200, { categories: [] });
});

function loginAs(role: StaffRole) {
  const staff: Staff = { id: 'staff-' + role, username: role.toLowerCase() + '-test', name: '測試' + role, role };
  useStaffStore.getState().setSession('jwt-' + role, staff);
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const statusOf = (orderNo: string) => db.find((o) => o.orderNo === orderNo)?.status;

beforeEach(() => {
  db = [];
  seq = 0;
  calls.length = 0;
  failList = false;
  kdsSocket.onChange = null;
  kdsSocket.tokens = [];
  kdsSocket.closed = 0;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  useStaffStore.getState().clear();
  loginAs('KITCHEN');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AC-004 KDS 廚房顯示系統(改寫自 restaurant-kiosk 的 6 個情境)', () => {
  it('AC-004 KDS 路由存在於 nav', async () => {
    renderAt('/admin/kds');
    expect(await screen.findByTestId('nav-kds')).toBeInTheDocument();
    expect(screen.getByTestId('nav-kds')).toHaveAttribute('href', '/admin/kds');
  });

  it('AC-004 KDS 空狀態顯示', async () => {
    renderAt('/admin/kds');
    expect(await screen.findByTestId('kds-empty')).toBeInTheDocument();
  });

  it('AC-004 有新訂單時 KDS 不顯示空狀態', async () => {
    const order = createOrder({
      items: [{
        id: 'i1', orderId: 'o1', menuItemId: 'm1', name: '測試餐點', quantity: 2, unitPrice: 100, subtotal: 200,
        customizations: [{ groupId: 'g1', groupName: '份量', choiceIds: ['c1'], choiceNames: ['大'] }],
      }],
    });
    renderAt('/admin/kds');
    expect(await screen.findByTestId(`kds-order-${order.orderNo}`)).toBeInTheDocument();
    expect(screen.queryByTestId('kds-empty')).not.toBeInTheDocument();
  });

  it('AC-004 KDS 顯示訂單編號(大字)', async () => {
    const order = createOrder();
    renderAt('/admin/kds');
    const card = await screen.findByTestId(`kds-order-${order.orderNo}`);
    expect(card).toBeInTheDocument();
    // 大字是取餐號(顧客與內場對單用),訂單編號以小字顯示在同一張卡上
    expect(within(card).getByTestId(`kds-pickup-${order.orderNo}`)).toHaveTextContent('A001');
    expect(card).toHaveTextContent(order.orderNo);
  });

  it('AC-004 KDS 訂單按等待時間排序(最舊在最上面)', async () => {
    // 後端回傳順序故意與等待時間相反,確認畫面依等待時間排序
    const newer = createOrder({ minutesAgo: 1 });
    const oldest = createOrder({ minutesAgo: 9 });
    const middle = createOrder({ minutesAgo: 4 });
    renderAt('/admin/kds');
    const grid = await screen.findByTestId('kds-grid');
    await within(grid).findByTestId(`kds-order-${oldest.orderNo}`);
    const orderIds = within(grid).queryAllByTestId(/^kds-order-/).map((el) => el.getAttribute('data-testid'));
    expect(orderIds).toEqual([
      `kds-order-${oldest.orderNo}`,
      `kds-order-${middle.orderNo}`,
      `kds-order-${newer.orderNo}`,
    ]);
  });

  it('AC-004 KDS 進階按鈕可推進狀態', async () => {
    const order = createOrder();
    renderAt('/admin/kds');
    const btn = await screen.findByTestId(`kds-advance-${order.orderNo}`);
    expect(btn).toHaveTextContent('推進 → 準備中');
    await userEvent.click(btn);
    // 狀態變 PREPARING,KDS 仍顯示(製作中仍在看板上)
    await waitFor(() => expect(statusOf(order.orderNo)).toBe('PREPARING'));
    expect(await screen.findByTestId(`kds-status-${order.orderNo}`)).toHaveTextContent('準備中');
    expect(screen.getByTestId(`kds-order-${order.orderNo}`)).toBeInTheDocument();
    expect(screen.getByTestId(`kds-advance-${order.orderNo}`)).toHaveTextContent('推進 → 製作中');
  });
});

describe('AC-004 KDS 顯示內容', () => {
  it('AC-004 顯示取餐號、品項數量與客製化', async () => {
    const order = createOrder({
      items: [
        {
          id: 'i1', orderId: 'o1', menuItemId: 'm1', name: '測試主餐', quantity: 2, unitPrice: 179, subtotal: 358,
          customizations: [
            { groupId: 'g1', groupName: '熟度', choiceIds: ['c1'], choiceNames: ['全熟'] },
            { groupId: 'g2', groupName: '加購', choiceIds: ['c2', 'c3'], choiceNames: ['起司片', '培根'] },
          ],
        },
        { id: 'i2', orderId: 'o1', menuItemId: 'm2', name: '測試飲料', quantity: 1, unitPrice: 30, subtotal: 30, customizations: [] },
      ],
    });
    renderAt('/admin/kds');
    const first = await screen.findByTestId(`kds-item-${order.orderNo}-0`);
    expect(first).toHaveTextContent('測試主餐');
    expect(first).toHaveTextContent('x2');
    expect(first).toHaveTextContent('全熟 / 起司片 / 培根');
    const second = screen.getByTestId(`kds-item-${order.orderNo}-1`);
    expect(second).toHaveTextContent('測試飲料');
    expect(second).toHaveTextContent('x1');
    expect(screen.getByTestId('kds-stats')).toHaveTextContent('進行中 1 單');
  });

  it('AC-004 顯示等待時間(以伺服器時間計算)', async () => {
    const fresh = createOrder({ minutesAgo: 0 });
    const waiting = createOrder({ minutesAgo: 7 });
    const long = createOrder({ minutesAgo: 75 });
    renderAt('/admin/kds');
    expect(await screen.findByTestId(`kds-elapsed-${fresh.orderNo}`)).toHaveTextContent('剛剛');
    expect(screen.getByTestId(`kds-elapsed-${waiting.orderNo}`)).toHaveTextContent('7 分鐘前');
    expect(screen.getByTestId(`kds-elapsed-${long.orderNo}`)).toHaveTextContent('1 小時 15 分前');
  });

  it('AC-004 以員工 JWT 呼叫 GET /api/admin/orders', async () => {
    renderAt('/admin/kds');
    await screen.findByTestId('kds-empty');
    const listCall = calls.find((c) => c.path === '/api/admin/orders');
    expect(listCall).toMatchObject({ method: 'GET', auth: 'Bearer jwt-KITCHEN' });
  });

  it('AC-004 未登入時看不到 KDS,也不會呼叫訂單 API', () => {
    useStaffStore.getState().clear();
    createOrder();
    renderAt('/admin/kds');
    expect(screen.getByTestId('staff-login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('kds-grid')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/admin/orders')).toBe(false);
  });

  it('AC-004 /admin 會導向 KDS', async () => {
    renderAt('/admin');
    expect(await screen.findByTestId('kds-grid')).toBeInTheDocument();
  });
});

describe('AC-004 KDS 推進與即時更新', () => {
  it('AC-004 連按四次從待製作推進到可取餐,每次都呼叫 advance API', async () => {
    const order = createOrder();
    renderAt('/admin/kds');
    for (const label of ['推進 → 準備中', '推進 → 製作中', '推進 → 盛盤中', '推進 → 可取餐']) {
      const btn = await screen.findByTestId(`kds-advance-${order.orderNo}`);
      await waitFor(() => expect(btn).toHaveTextContent(label));
      await userEvent.click(btn);
    }
    await waitFor(() => expect(statusOf(order.orderNo)).toBe('READY'));
    const advances = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/advance'));
    expect(advances).toHaveLength(4);
    expect(advances.every((c) => c.auth === 'Bearer jwt-KITCHEN')).toBe(true);
    // 內場在「可取餐」只能看,不能再按(與原版相同:可取餐時按鈕停用)
    const btn = await screen.findByTestId(`kds-advance-${order.orderNo}`);
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveTextContent('已可取餐');
  });

  it('AC-004 收銀看得到訂單但不能推進製作階段', async () => {
    useStaffStore.getState().clear();
    loginAs('CASHIER');
    const order = createOrder();
    renderAt('/admin/kds');
    const btn = await screen.findByTestId(`kds-advance-${order.orderNo}`);
    expect(btn).toBeDisabled();
    expect(calls.some((c) => c.path.endsWith('/advance'))).toBe(false);
  });

  it('AC-004 收銀可在「可取餐」按完成取餐,訂單離開看板', async () => {
    useStaffStore.getState().clear();
    loginAs('CASHIER');
    const order = createOrder({ status: 'READY' });
    renderAt('/admin/kds');
    const btn = await screen.findByTestId(`kds-advance-${order.orderNo}`);
    expect(btn).toHaveTextContent('完成取餐');
    await userEvent.click(btn);
    await waitFor(() => expect(statusOf(order.orderNo)).toBe('COMPLETED'));
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: `/api/orders/${order.orderNo}/status`,
      body: { status: 'COMPLETED' },
      auth: 'Bearer jwt-CASHIER',
    });
    expect(await screen.findByTestId('kds-empty')).toBeInTheDocument();
  });

  it('AC-004 收到 kds:orderChanged 通知後自動顯示新訂單(不需手動重新整理)', async () => {
    renderAt('/admin/kds');
    await screen.findByTestId('kds-empty');
    expect(kdsSocket.tokens).toEqual(['jwt-KITCHEN']);

    const order = createOrder();
    act(() => {
      kdsSocket.onChange?.({ orderNo: order.orderNo, status: 'QUEUED', reason: 'created' });
    });
    expect(await screen.findByTestId(`kds-order-${order.orderNo}`)).toBeInTheDocument();
    expect(screen.queryByTestId('kds-empty')).not.toBeInTheDocument();
  });

  it('AC-004 沒有通知時也會定時輪詢更新', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/admin/kds');
    await screen.findByTestId('kds-empty');
    const order = createOrder();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(await screen.findByTestId(`kds-order-${order.orderNo}`)).toBeInTheDocument();
  });

  it('AC-004 取得訂單失敗時顯示錯誤,不顯示假資料;恢復後自動更新', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    failList = true;
    const order = createOrder();
    renderAt('/admin/kds');
    expect(await screen.findByRole('alert')).toHaveTextContent('無法取得訂單');
    expect(screen.queryByTestId(`kds-order-${order.orderNo}`)).not.toBeInTheDocument();

    failList = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(await screen.findByTestId(`kds-order-${order.orderNo}`)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-004 離開 KDS 時關閉即時連線', async () => {
    const view = renderAt('/admin/kds');
    await screen.findByTestId('kds-empty');
    view.unmount();
    expect(kdsSocket.closed).toBe(1);
  });
});

describe('AC-004 KDS 純函式', () => {
  it('AC-004 elapsedLabel 的級距與原版相同', () => {
    const base = 1_000_000_000_000;
    expect(elapsedLabel(base, base + 59_000)).toBe('剛剛');
    expect(elapsedLabel(base, base + 60_000)).toBe('1 分鐘前');
    expect(elapsedLabel(base, base + 59 * 60_000)).toBe('59 分鐘前');
    expect(elapsedLabel(base, base + 61 * 60_000)).toBe('1 小時 1 分前');
    expect(elapsedLabel(base, base - 5_000)).toBe('剛剛'); // 時鐘誤差不顯示負數
  });

  it('AC-004 sortByWaiting 最舊在前,且不改動原陣列', () => {
    const input = [
      { orderNo: 'B', createdAt: '2026-04-01T03:00:00.000Z' },
      { orderNo: 'A', createdAt: '2026-04-01T01:00:00.000Z' },
      { orderNo: 'C', createdAt: '2026-04-01T01:00:00.000Z' },
    ];
    expect(sortByWaiting(input).map((o) => o.orderNo)).toEqual(['A', 'C', 'B']);
    expect(input.map((o) => o.orderNo)).toEqual(['B', 'A', 'C']);
  });

  it('AC-004 kdsAction 依角色決定按鈕', () => {
    expect(kdsAction('QUEUED', 'KITCHEN')).toEqual({ kind: 'advance', enabled: true, label: '推進 → 準備中' });
    expect(kdsAction('PLATING', 'MANAGER')).toEqual({ kind: 'advance', enabled: true, label: '推進 → 可取餐' });
    expect(kdsAction('COOKING', 'CASHIER').enabled).toBe(false);
    expect(kdsAction('READY', 'KITCHEN')).toMatchObject({ kind: 'complete', enabled: false });
    expect(kdsAction('READY', 'CASHIER')).toEqual({ kind: 'complete', enabled: true, label: '完成取餐' });
    expect(kdsAction('READY', 'MANAGER').enabled).toBe(true);
  });
});
