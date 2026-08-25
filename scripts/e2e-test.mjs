// e2e-test.mjs — 用 fetch + socket.io-client 做完整 e2e 測試
const BASE = 'http://localhost:4000';
const TRACKING = BASE + '/tracking';

// Step 1: 取得菜單
const menu = await fetch(BASE + '/api/menu').then(r => r.json());
console.log('Categories:', menu.categories.length);
const items = menu.categories.flatMap(c => c.menuItems);
console.log('Total items:', items.length);
console.assert(items.length >= 10, '應該有 10 個菜單');

// Step 2: VIP 會員登入
const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0912345678' })
}).then(r => r.json());
console.log('Login:', login.code, login.message);

const verify = await fetch(BASE + '/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0912345678', code: '1234' })
}).then(r => r.json());
console.log('Verify:', verify.member.name, verify.member.tier);

// Step 3: 取 VIP10 coupon
const coupons = await fetch(BASE + '/api/members/' + verify.member.id + '/coupons').then(r => r.json());
console.log('Coupons:', coupons.coupons.length);
const vip10 = coupons.coupons.find(c => c.code === 'VIP10');
console.assert(vip10, 'VIP 會員應該有 VIP10 coupon');

// Step 4: 建立 VIP 訂單(套 coupon)
const mainItem = items.find(i => i.name === '經典脆雞');
const order = await fetch(BASE + '/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cart: {
      items: [{
        menuItemId: mainItem.id,
        name: mainItem.name,
        quantity: 1,
        unitPrice: mainItem.basePrice,
        customizations: [{groupId: mainItem.customizationGroups[0].id, groupName: '主食選擇', choiceNames: ['白飯']}]
      }]
    },
    memberId: verify.member.id,
    couponCode: 'VIP10'
  })
}).then(r => r.json());
console.log('Order created:', order.order.orderNo, 'pickup=A' + String(order.order.pickupNumber).padStart(3, '0'));
console.log('  subtotal:', order.order.subtotal, 'discount:', order.order.discount, 'total:', order.order.totalAmount);
console.assert(order.order.discount > 0, 'VIP10 應該有折扣');

// Step 5: WebSocket 訂閱 + 推進狀態
const { io } = await import('socket.io-client');
const socket = io(TRACKING);
await new Promise(resolve => socket.on('connect', resolve));
console.log('WS connected');

const events = [];
socket.on('order:statusChanged', (d) => events.push({type: 'statusChanged', ...d}));
socket.on('order:progress', (d) => events.push({type: 'progress', ...d}));
socket.on('order:ready', (d) => events.push({type: 'ready', ...d}));

socket.emit('track:order', { orderNo: order.order.orderNo });
await new Promise(r => setTimeout(r, 500));

// 推進 QUEUED → PREPARING → COOKING → PLATING → READY
for (let i = 0; i < 4; i++) {
  const r = await fetch(BASE + '/api/admin/orders/' + order.order.orderNo + '/advance', { method: 'POST' });
  const data = await r.json();
  console.log('Advanced to:', data.order.status);
  await new Promise(r => setTimeout(r, 1000));
}

socket.disconnect();
console.log('Total WS events received:', events.length);
console.assert(events.some(e => e.type === 'statusChanged'), '應有 statusChanged 事件');
console.assert(events.some(e => e.type === 'ready'), '應有 ready 事件');

// Step 6: 一般會員建立訂單(無 coupon)
const guestLogin = await fetch(BASE + '/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0987654321', code: '1234' })
}).then(r => r.json());
const guestOrder = await fetch(BASE + '/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cart: { items: [{ menuItemId: 'item-cola', name: '可樂(中)', quantity: 2, unitPrice: 30, customizations: [] }] },
    memberId: guestLogin.member.id
  })
}).then(r => r.json());
console.log('Guest order:', guestOrder.order.orderNo, 'pickup=A' + String(guestOrder.order.pickupNumber).padStart(3, '0'));

// Step 7: 預建訂單推進測試(QUEUED → READY)
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const preOrderNo = 'SD-' + today + '-0001';
for (let i = 0; i < 4; i++) {
  await fetch(BASE + '/api/admin/orders/' + preOrderNo + '/advance', { method: 'POST' });
  await new Promise(r => setTimeout(r, 500));
}
const preOrderFinal = await fetch(BASE + '/api/orders/' + preOrderNo).then(r => r.json());
console.log('Pre-order final status:', preOrderFinal.order.status);
console.assert(preOrderFinal.order.status === 'READY', '預建訂單應推進到 READY');

console.log('\n✅ E2E TEST PASSED');
