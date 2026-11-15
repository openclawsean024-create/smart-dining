/**
 * AC-002:KIOSK 結帳頁不再寫死券碼(改用後端可用券),下單只送 ID 與數量,前端價格只作顯示。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CustomizationGroup, Member, MenuItem } from '@smart-dining/contracts';
import { CheckoutPage } from '../CheckoutPage';
import { CustomizePanel } from '../../components/layout/CustomizePanel';
import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';

const member: Member = {
  id: 'member-test',
  phone: '0900000101', // 明顯假號
  name: '測試會員',
  points: 10,
  tier: 'BRONZE',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const groups: CustomizationGroup[] = [
  {
    id: 'g-size', menuItemId: 'item-test', groupName: '份量', type: 'SINGLE', required: true, displayOrder: 1,
    choices: [
      { id: 'c-small', groupId: 'g-size', name: '小', priceDelta: 0, available: true },
      { id: 'c-large', groupId: 'g-size', name: '大', priceDelta: 20, available: true },
    ],
  },
  {
    id: 'g-addon', menuItemId: 'item-test', groupName: '加購', type: 'MULTI', required: false, displayOrder: 2,
    choices: [{ id: 'c-egg', groupId: 'g-addon', name: '加蛋', priceDelta: 15, available: true }],
  },
];

const menuItem: MenuItem & { customizationGroups: CustomizationGroup[] } = {
  id: 'item-test', categoryId: 'cat-test', name: '測試餐點', basePrice: 100, available: true, customizationGroups: groups,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

function loginAsMember() {
  localStorage.setItem('kiosk_session', JSON.stringify({ token: 'member-jwt', member }));
  localStorage.setItem('kiosk_token', 'member-jwt');
}

function renderCheckout() {
  useUIStore.setState({ checkoutModalOpen: true });
  return render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  useCartStore.getState().clear();
  useCartStore.getState().addLine({
    menuItem,
    quantity: 2,
    customizations: { 'g-size': ['c-large'], 'g-addon': ['c-egg'] },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useUIStore.setState({ checkoutModalOpen: false });
});

describe('AC-002 結帳頁優惠券以後端為準', () => {
  it('AC-002 未登入:沒有任何券可選,也不會呼叫優惠券 API', () => {
    renderCheckout();
    expect(screen.getByTestId('coupon-login-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('coupon-select')).not.toBeInTheDocument();
    expect(screen.queryByText(/WELCOME10|SAVE50/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AC-002 已登入:選項就是 GET /api/members/:id/coupons 回傳的券(帶會員 JWT)', async () => {
    loginAsMember();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        coupons: [
          { id: 'cp-a', code: 'DB-COUPON-A', type: 'PERCENTAGE', value: 10, expiresAt: '2099-01-01T00:00:00.000Z', memberId: member.id },
          { id: 'cp-b', code: 'DB-COUPON-B', type: 'AMOUNT', value: 20, expiresAt: '2099-01-01T00:00:00.000Z', memberId: member.id },
        ],
      }),
    );
    renderCheckout();

    const select = await screen.findByTestId('coupon-select');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.getAttribute('value'));
    expect(options).toEqual(['', 'DB-COUPON-A', 'DB-COUPON-B']);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain(`/api/members/${member.id}/coupons`);
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer member-jwt');
  });

  it('AC-002 已登入但後端沒有可用券:顯示沒有可用的優惠券', async () => {
    loginAsMember();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { coupons: [] }));
    renderCheckout();
    expect(await screen.findByTestId('coupon-empty')).toBeInTheDocument();
  });

  it('AC-002 先前殘留、但後端已沒有的券會被清掉(不會送出無效券碼)', async () => {
    loginAsMember();
    useCartStore.getState().setCoupon({ code: 'STALE-CODE', type: 'AMOUNT', value: 50, label: '折抵 NT$ 50' });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { coupons: [] }));
    renderCheckout();
    await screen.findByTestId('coupon-empty');
    await waitFor(() => expect(useCartStore.getState().appliedCoupon).toBeNull());
  });
});

describe('AC-002 下單只送品項 ID、數量、選項 ID', () => {
  it('AC-002 送出的 payload 不含 unitPrice／name／金額;畫面金額只是試算', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        order: { id: 'o1', orderNo: 'SD-20260101-0001', totalAmount: 270, subtotal: 270, discount: 0, status: 'QUEUED', pickupNumber: 1, estimatedReadyAt: '2026-01-01T00:05:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', items: [] },
      }),
    );
    renderCheckout();
    // 顯示用的試算:(100 + 20 + 15) × 2 = 270
    const submit = screen.getByRole('button', { name: /確認結帳/ });
    expect(submit).toHaveTextContent('270');
    await userEvent.click(submit);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/orders');
    const body = JSON.parse(String(init!.body));
    expect(body).toEqual({
      cart: {
        items: [
          {
            menuItemId: 'item-test',
            quantity: 2,
            customizations: [
              { groupId: 'g-size', choiceIds: ['c-large'] },
              { groupId: 'g-addon', choiceIds: ['c-egg'] },
            ],
          },
        ],
      },
    });
    expect(String(init!.body)).not.toMatch(/unitPrice|basePrice|subtotal|totalAmount|測試餐點/);
  });

  it('AC-002 後端回 400(例如品項已下架)時顯示中文說明,不清空購物車', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'ITEM_UNAVAILABLE: menu item item-test is not available', code: 'ITEM_UNAVAILABLE' }));
    renderCheckout();
    await userEvent.click(screen.getByRole('button', { name: /確認結帳/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('已下架或售完');
    expect(useCartStore.getState().lines).toHaveLength(1);
  });
});

describe('AC-002 客製化面板:必選群組沒選不能加入購物車', () => {
  it('AC-002 缺必選時按鈕停用並提示;選了之後才能加入', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        categories: [{ id: 'cat-test', name: '測試分類', displayOrder: 1, items: [menuItem] }],
      }),
    );
    useCartStore.getState().clear();
    render(<CustomizePanel />);
    // 等菜單載入後開始編輯(SWR 會以 fetch 取得菜單)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    useCartStore.getState().startEditing('item-test');

    const confirm = await screen.findByTestId('customize-confirm');
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent('請先選擇:份量');

    await userEvent.click(screen.getByRole('button', { name: /大/ }));
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(confirm).toHaveTextContent('120');
    await userEvent.click(confirm);
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0]!.customizations).toEqual({ 'g-size': ['c-large'] });
  });
});
