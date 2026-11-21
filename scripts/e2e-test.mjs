// e2e-test.mjs — 以 fetch + socket.io-client 對「已啟動並 seed」的 backend 做端到端檢查。
//
// 建議用法（自動啟動一次性的測試 backend）：
//   cd backend && npm run test:e2e
// 或對既有 backend：
//   API_BASE=http://localhost:4000 E2E_STAFF_PASSWORD=<seed 時的員工密碼> node scripts/e2e-test.mjs
//
// 員工帳號：E2E_STAFF_USERNAME（預設 kitchen01）／E2E_STAFF_PASSWORD（必填，腳本內不寫死任何密碼）。
//
// 任何一個斷言失敗即以非 0 結束（AC-001）。
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE ?? 'http://localhost:4000';
const VIP_PHONE = process.env.SD_DEMO_PHONE ?? '0900000001'; // seed 的示範會員（明顯假號）
const GUEST_PHONE = process.env.SD_DEMO_GUEST_PHONE ?? '0900000002';
const STAFF_USERNAME = process.env.E2E_STAFF_USERNAME ?? 'kitchen01';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;
assert.ok(STAFF_PASSWORD, '請以環境變數 E2E_STAFF_PASSWORD 提供員工密碼（npm run test:e2e 會自動產生）');

async function api(method, path, { body, token, expect = 200 } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  assert.equal(res.status, expect, `${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return data;
}

async function memberLogin(phone) {
  const login = await api('POST', '/api/auth/login', { body: { phone } });
  assert.ok(login.code, 'dev OTP provider 應回傳驗證碼提示');
  return api('POST', '/api/auth/verify', { body: { phone, code: login.code } });
}

/** 每個必選群組選第一個選項。 */
function requiredSelections(item) {
  return (item.customizationGroups ?? [])
    .filter((g) => g.required)
    .map((g) => ({ groupId: g.id, choiceIds: [g.choices[0].id] }));
}

// Step 1: 菜單
const menu = await api('GET', '/api/menu');
const items = menu.categories.flatMap((c) => c.items ?? c.menuItems ?? []);
console.log('Categories:', menu.categories.length, 'items:', items.length);
assert.ok(items.length >= 10, '應該有 10 個以上的品項');

// Step 2: VIP 會員登入
const vip = await memberLogin(VIP_PHONE);
console.log('Verify:', vip.member.name, vip.member.tier);

// Step 3: 取 VIP10 coupon
const coupons = await api('GET', `/api/members/${vip.member.id}/coupons`, { token: vip.token });
assert.ok(coupons.coupons.find((c) => c.code === 'VIP10'), 'VIP 會員應該有 VIP10 coupon');

// Step 4: 建立 VIP 訂單（套 coupon）
const mainItem = items.find((i) => i.id === 'item-crispy-chicken');
assert.ok(mainItem, '菜單應包含示範主餐');
const created = await api('POST', '/api/orders', {
  expect: 201,
  token: vip.token,
  body: {
    cart: { items: [{ menuItemId: mainItem.id, quantity: 1, customizations: requiredSelections(mainItem) }] },
    memberId: vip.member.id,
    couponCode: 'VIP10',
  },
});
const order = created.order;
console.log('Order created:', order.orderNo, 'pickup=A' + String(order.pickupNumber).padStart(3, '0'));
console.log('  subtotal:', order.subtotal, 'discount:', order.discount, 'total:', order.totalAmount);
assert.ok(order.discount > 0, 'VIP10 應該有折扣');
assert.equal(order.totalAmount, order.subtotal - order.discount);

// Step 5: 員工登入（內場）→ WebSocket 訂閱 + 推進狀態
const staff = await api('POST', '/api/staff/login', { body: { username: STAFF_USERNAME, password: STAFF_PASSWORD } });
console.log('Staff login:', staff.staff.username, staff.staff.role);
await api('POST', `/api/admin/orders/${order.orderNo}/advance`, { expect: 401 });
await api('POST', `/api/admin/orders/${order.orderNo}/advance`, { expect: 403, token: vip.token });
const { io } = await import('socket.io-client');
const socket = io(BASE + '/tracking', { transports: ['websocket'] });
await new Promise((resolve, reject) => {
  socket.on('connect', resolve);
  socket.on('connect_error', reject);
});
console.log('WS connected');

const events = [];
socket.on('order:statusChanged', (d) => events.push({ type: 'statusChanged', ...d }));
socket.on('order:progress', (d) => events.push({ type: 'progress', ...d }));
socket.on('order:ready', (d) => events.push({ type: 'ready', ...d }));
await new Promise((resolve) => socket.emit('track:order', { orderNo: order.orderNo }, resolve));

// 推進 QUEUED → PREPARING → COOKING → PLATING → READY
for (let i = 0; i < 4; i++) {
  const data = await api('POST', `/api/admin/orders/${order.orderNo}/advance`, { token: staff.token });
  console.log('Advanced to:', data.order.status);
}
await new Promise((r) => setTimeout(r, 500));
socket.disconnect();
console.log('Total WS events received:', events.length);
assert.equal(events.filter((e) => e.type === 'statusChanged').length, 4, '應收到 4 個 statusChanged 事件');
assert.equal(events.filter((e) => e.type === 'ready').length, 1, '應收到 1 個 ready 事件');

const final = await api('GET', `/api/orders/${order.orderNo}`);
assert.equal(final.order.status, 'READY', '訂單應推進到 READY');

// Step 6: 一般會員建立訂單（無 coupon）
const guest = await memberLogin(GUEST_PHONE);
const cola = items.find((i) => i.id === 'item-cola');
const guestOrder = await api('POST', '/api/orders', {
  expect: 201,
  token: guest.token,
  body: {
    cart: { items: [{ menuItemId: cola.id, quantity: 2, customizations: requiredSelections(cola) }] },
    memberId: guest.member.id,
  },
});
console.log('Guest order:', guestOrder.order.orderNo);
assert.equal(guestOrder.order.discount, 0);

console.log('\n✅ E2E TEST PASSED');
process.exit(0);
