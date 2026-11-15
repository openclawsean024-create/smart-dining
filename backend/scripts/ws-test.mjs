// ws-test.mjs — 訂閱一筆訂單的 WebSocket 事件並推進狀態（只印事件、不做斷言）。
//
// 用法：E2E_STAFF_PASSWORD=<seed 時的員工密碼> npm run test:ws -- <orderNo>
// 員工帳號：E2E_STAFF_USERNAME（預設 kitchen01）；腳本內不寫死任何密碼。
// 未指定訂單號時使用今天（台灣時區）的第一筆：SD-YYYYMMDD-0001。
import { io } from 'socket.io-client';

const BASE = process.env.API_BASE ?? 'http://localhost:4000';
const username = process.env.E2E_STAFF_USERNAME ?? 'kitchen01';
const password = process.env.E2E_STAFF_PASSWORD;
if (!password) {
  console.error('請以環境變數 E2E_STAFF_PASSWORD 提供員工密碼');
  process.exit(1);
}

const taipeiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(new Date())
  .replaceAll('-', '');
const orderNo = process.argv[2] ?? `SD-${taipeiDate}-0001`;

const login = await fetch(BASE + '/api/staff/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
if (!login.ok) {
  console.error('員工登入失敗：HTTP ' + login.status);
  process.exit(1);
}
const { token } = await login.json();

const socket = io(BASE + '/tracking', { transports: ['websocket'] });
for (const e of ['order:statusChanged', 'order:progress', 'order:ready']) socket.on(e, (p) => console.log(e, p));
socket.on('connect', () => {
  console.log('connected', orderNo);
  socket.emit('track:order', { orderNo }, (r) => console.log('tracked', r));
  let n = 0;
  const t = setInterval(async () => {
    if (n++ >= 4) {
      clearInterval(t);
      socket.close();
      return;
    }
    const res = await fetch(`${BASE}/api/admin/orders/${orderNo}/advance`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
    });
    if (!res.ok) console.error('advance failed: HTTP ' + res.status);
  }, 2000);
});
