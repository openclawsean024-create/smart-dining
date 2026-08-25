# QA 整合測試報告 — 餐飲點餐快手

> 角色:QA / 整合測試工程師
> 日期:2026-08-24 (Asia/Taipei) ⌚ 17:48–17:52
> 評估對象:backend (Fastify + Prisma + Socket.IO), kiosk-frontend (Vite), mobile-app (Vite PWA)
> 受測版本:@smart-dining/backend@0.1.0 / @smart-dining/kiosk@0.1.0 / @smart-dining/mobile@0.1.0
> 受測 commit:smart-dining 工作樹(無版控綁定)

## 1. 環境資訊

| 項目 | 值 |
|------|----|
| Node.js | **v22.23.2** |
| 作業系統 | **macOS** (Darwin 25.6.0, arm64 — Apple Silicon, kernel T8132) |
| 主機 | `Mac-mini-2.local` |
| 工作目錄 | `/Users/sean/Documents/Agent space/smart-dining` |
| 測試時間 | 2026-08-24 17:48–17:52 (UTC+8) |
| DB | SQLite(`backend/data/dev.db`),已 `db:reset` 重灌 + seed |
| 預設驗證碼 | `1234`(`shared-contracts` + `backend/src/lib/verifyCode.ts`) |

> Prisma schema / seed 摘要(本次 reset 後):
> - 4 個分類、`10` 個 menu items、3 個 customizationGroups/item 級距
> - 2 個會員:`0912345678` 王小明 (VIP/GOLD)、`0987654321` 林小華 (一般)
> - 2 張 coupons:VIP 用 `VIP10`(10% 折扣)、一般用 `WELCOME`(NT$20)
> - 1 張預建訂單 `SD-20260824-0001`(QUEUED, pickup=A001)

## 2. 啟動紀錄

### 2.1 啟動命令
```bash
cd backend && nohup npm run dev > /tmp/backend.log 2>&1 &
cd kiosk-frontend && nohup npm run dev > /tmp/kiosk.log 2>&1 &
cd mobile-app && nohup npm run dev > /tmp/mobile.log 2>&1 &
sleep 12
```

### 2.2 Backend 日誌(`/tmp/backend.log`)
```
> @smart-dining/backend@0.1.0 dev
> tsx watch src/server.ts

{"level":50,"time":1787593791212,...,"err":{"type":"Error",
"message":"listen EADDRINUSE: address already in use 0.0.0.0:4000",
"code":"EADDRINUSE","errno":-48,"syscall":"listen",
"address":"0.0.0.0","port":4000},"msg":"listen EADDRINUSE ..."}
```

⚠️ 第一支 `npm run dev` 撞到 **4000 port already in use**(前次 dev 還活著,PID 46415)。
`tsx watch` 的 child 直接 exit、healthz 仍可連線,代表真正的 backend 是先前已存在的實例,所以**整合測試繼續在已執行的實例上跑**(請見 §2.5 的清單)。

### 2.3 Kiosk 日誌(`/tmp/kiosk.log`)
```
> @smart-dining/kiosk@0.1.0 dev
> vite --port 5173 --host 0.0.0.0

  VITE v6.4.3  ready in 92 ms
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.8.225:5173/
```

### 2.4 Mobile 日誌(`/tmp/mobile.log`)
```
> @smart-dining/mobile@0.1.0 dev
> vite --port 5174 --host 0.0.0.0

  VITE v5.4.10  ready in 97 ms
  ➜  Local:   http://localhost:5174/
  ➜  Network: http://192.168.8.225:5174/
```

### 2.5 實際服務持有者(以 PID 為準)

| Port | PID | Process |
|------|-----|---------|
| 4000 (backend) | **46415** | `node .../tsx ... src/server.ts`(先前已啟動、並未被本次 launcher 取代) |
| 5173 (kiosk)   | **46532** | `vite --port 5173 --host 0.0.0.0`(本次啟動) |
| 5174 (mobile)  | **46533** | `vite --port 5174 --host 0.0.0.0`(本次啟動) |

### 2.6 健康檢查結果

| Endpoint | Expected | Actual | Status |
|----------|----------|--------|--------|
| `curl http://localhost:4000/healthz` | 200 + `{"ok":true}` | `{"ok":true}` | ✅ |
| `curl -I http://localhost:5173` | HTTP 200 | `HTTP/1.1 200 OK` | ✅ |
| `curl -I http://localhost:5174` | HTTP 200 | `HTTP/1.1 200 OK` | ✅ |

## 3. 端到端測試 (`scripts/e2e-test.mjs`)

腳本內容與工作計畫指示一致 — `fetch` + `socket.io-client` 跑 7 步。本節為 **完整輸出**:

```
Categories: 4
Total items: 10
Login: 1234 Development verification code
Verify: 王小明 GOLD
Coupons: 1
Order created: SD-20260824-0002 pickup=A002
  subtotal: 149 discount: 14.9 total: 134.1
WS connected
Advanced to: PREPARING
Advanced to: COOKING
Advanced to: PLATING
Advanced to: READY
Total WS events received: 0
Assertion failed: 應有 statusChanged 事件
Assertion failed: 應有 ready 事件
Guest order: SD-20260824-0003 pickup=A003
Pre-order final status: READY

✅ E2E TEST PASSED
```

> 註:`console.assert` 只在斷言失敗時 log、不 throw,所以腳本沒有 abort、仍印出 `✅ E2E TEST PASSED`,但內部兩個斷言已失敗 — 詳見 §6。

### 3.1 全套 checkpoints(10/12 通過)

| # | 檢查點 | 結果 | 證據 |
|---|--------|------|------|
| C1 | `GET /api/menu` 回傳 4 個 category、≥10 個 item | ✅ | `Categories: 4 / Total items: 10` |
| C2 | `POST /api/auth/login` 回傳 code `1234` 訊息 | ✅ | `Login: 1234 Development verification code` |
| C3 | `POST /api/auth/verify` 回傳 member 且 VIP tier | ✅ | `Verify: 王小明 GOLD` |
| C4 | VIP 會員 `/coupons` 含 `VIP10` | ✅ | `Coupons: 1`(VIP10 命中) |
| C5 | VIP 訂單套 `VIP10` 折扣 > 0 | ✅ | `subtotal: 149 / discount: 14.9 / total: 134.1` |
| C6 | 訂單正確生成 `orderNo`、`pickupNumber` | ✅ | `SD-20260824-0002 / A002` |
| C7 | `POST /api/admin/orders/:orderNo/advance` QUEUED→…→READY 狀態正確推進 | ✅ | `PREPARING → COOKING → PLATING → READY` |
| C8 | Socket.IO `/tracking` 連線成功 + `track:order` ack | ✅ | `WS connected`、ack `{ok:true,...}` |
| **C9** | **WS 收到 `order:statusChanged` 事件(advance 時)** | **❌** | **`Total WS events received: 0`** |
| **C10**| **WS 收到 `order:ready` 事件(advance 到 READY 時)** | **❌** | **同 C9** |
| C11 | 一般會員建立訂單(無 coupon)— 純一般流程 | ✅ | `SD-20260824-0003 / A003` |
| C12 | 預建訂單 QUEUED→READY 推進 | ✅ | `Pre-order final status: READY` |

### 3.2 WS 事件清單(本次 `e2e-test.mjs` 觀察到)

| 事件 | 數量 | 來源原因 |
|------|------|---------|
| `order:statusChanged` | **0** | `/api/admin/orders/.../advance` 沒有廣播 |
| `order:progress`      | **0** | 同上 |
| `order:ready`         | **0** | 同上 |

`track:order` 的 ack 確認 socket 確實 `socket.join(orderRoom(orderNo))`,所以房間是空的 — `app.io.of('/tracking').to(orderRoom(orderNo)).emit(...)` 從未被執行。
## 4. 前端頁面煙霧測試

| 測試 | 結果 |
|------|------|
| `curl -s :5173 | grep '<div id="root"'` | ✅ 出現 1 次 |
| `curl -s :5174 | grep '<div id="root"'` | ✅ 出現 1 次 |
| `curl -I :5173/track/SD-20260824-0001` | ✅ `HTTP/1.1 200 OK`(SPA fallback) |
| `curl -I :5174/track/SD-20260824-0001` | ✅ `HTTP/1.1 200 OK`(SPA fallback) |
| `curl :5173/track/SD-20260824-0001 | grep '<div id="root"'` | ✅ 出現 1 次(SPA index.html) |
| `curl :5174/track/SD-20260824-0001 | grep '<div id="root"'` | ✅ 出現 1 次(SPA index.html) |

> 結論:KIOSK 與 Mobile App 的 Vite dev server 都正常 serve SPA,即使是不存在於 SPA router 的深層 `/track/<orderNo>` 路徑,兩個 server 都以 index.html fallback(200 OK)— 完全符合預期。

## 5. 配套腳本驗證(輔助證據)

### 5.1 `backend/scripts/test-api.sh`(已存在)
依該腳本健康檢查多個端點(healthz / menu / login / verify / member / coupons / order / status / points / advance),全部在本次 reset 後的 dev DB 上通過(用於交叉驗證 Step 3 的相同 API)。

### 5.2 `backend/scripts/ws-test.mjs`(已存在)
該腳本呼叫 `/api/admin/orders/:orderNo/advance` 來推進 — 與 §3 一樣會因為同樣的 backend bug 而 **永遠收不到 WS 事件**(只能連上與 ack)。
建議:**同樣的修補應一併讓此腳本驗證 WS 廣播**。

### 5.3 對照實驗(手動驗證 broadcast 路徑)
不在 e2e 腳本中,但已由 QA 在診斷時執行:
1. 建立新訂單 `SD-20260824-0004`(QUEUED)
2. WS `track:order { orderNo: 'SD-20260824-0004' }` → ack OK
3. 呼叫 `POST /api/admin/.../advance` → 0 個事件
4. 改呼叫 `PATCH /api/orders/:orderNo/status {status:'COOKING'}` → **立刻收到 2 個事件**:
```
>> order:statusChanged {orderNo:...,status:'COOKING',pickupNumber:4,...}
>> order:progress     {orderNo:...,stage:'COOKING',percentage:60,...}
```
**證實**:廣播 code 路徑 `app.io.of('/tracking').to(room).emit(...)` 本身的確有效;只是 `admin/advance` route 忘了呼叫。

## 6. 發現的問題

### 🔴 P1(阻擋性)Backend Bug:`/api/admin/orders/:orderNo/advance` 不廣播 WebSocket

**檔案**:`backend/src/modules/admin/routes.ts`(第 6–9 行)
**現況**:
```ts
app.post('/api/admin/orders/:orderNo/advance', async (request, reply) => {
  const { orderNo } = request.params as any;
  const current = await app.prisma.order.findUnique({ where: { orderNo } });
  if (!current) return reply.code(404).send({ error: 'not found' });
  if (current.status === 'READY' || current.status === 'CANCELLED') return { order: current, advanced: false };
  const next = getNextStage(current.status as any);
  if (!next) return { order: current, advanced: false };
  const order = await app.prisma.order.update({ where: { orderNo },
    data: { status: next, statusLogs: { create: { status: next, changedBy: 'admin' } } } });
  return { order, advanced: true };            // ← 缺少 WS emit
});
```

**影響**:
- Backend `/api/orders/:orderNo/status` PATCH 路徑有 emit `order:statusChanged` + `order:progress` + `order:ready`(見 `backend/src/modules/orders/routes.ts:58–63`)。
- **門市人員實際使用的 admin UI 是呼叫 `/advance`**,因此:
  - 顧客用手機 PWA 點 QR 追蹤時,**永遠停在 QUEUED**;門市推進任何階段,手機畫面無任何反應。
  - `navigator.vibrate` / `READY` 閃橘光等效果永遠不會觸發。
  - `shared-contracts` 定義的 WS 事件表(ARCHITECTURE §5)三種事件全部失效於此路徑。

**建議修正(草稿)**:
```ts
import { PROGRESS_STAGE_MAP } from '../../../../shared-contracts/src/realtime/stages.js';
import { orderRoom } from '../../../../shared-contracts/src/realtime/events.js';

// 在 update 之後:
const io = app.io.of('/tracking').to(orderRoom(orderNo));
io.emit('order:statusChanged', {
  orderNo, status: order.status,
  pickupNumber: order.pickupNumber,
  timestamp: new Date().toISOString(),
  stage: order.status,
});
if (['PREPARING','COOKING','PLATING'].includes(order.status)) {
  const meta = PROGRESS_STAGE_MAP[order.status];
  io.emit('order:progress', {
    orderNo, stage: order.status,
    percentage: meta.percentage,
    estimatedReadyAt: order.estimatedReadyAt.toISOString(),
  });
}
if (order.status === 'READY') {
  io.emit('order:ready', {
    orderNo, pickupNumber: order.pickupNumber,
    timestamp: new Date().toISOString(),
  });
}
return { order, advanced: true };
```

> 同時也建議把這段邏輯 extract 成 `lib/broadcastOrderUpdate(app, order)`,讓 PATCH 與 advance 共用,避免重複維護兩份事件廣播。

---

### 🟡 P3(建議性)— 重啟流程欠缺

- 啟動前若 backend 還在跑,新的 `npm run dev` 會 `EADDRINUSE` 但不會被 npm 失敗終止,容易誤導。
- 建議在 `backend/package.json` 加一支 `predev` hook,用 `lsof -ti:4000 | xargs -r kill -9` 清掉舊實例。

### 🟢 P4(觀察)— 預期內的設計選擇

- `POST /api/orders` 建立訂單時**未**廣播 `order:created`,僅 KIOSK 自己知道結果。在 ARCH 圖中亦明示 KIOSK 只需輪詢 / 顯示成功頁;mobile 是「被動追蹤」,因此**目前這個設計是合理的**。

## 7. 結論

| 區塊 | 結論 |
|------|------|
| 環境、healthz、菜單、認證、訂單建立、優惠券、進度推進(backend DB)、前端 SPA serve | **全部通過** |
| **WebSocket 即時廣播(顧客可見)** | **失敗** — admin advance 路徑無 broadcast |
| 總計 checkpoints | **10/12 通過**(C9、C10 兩項 WS 廣播失敗) |

### 🟥 整體結論:**FAIL**(阻擋性 bug)
雖然 e2e script 並未 throw、且資料流是對的,實測證實 **C9/C10 不通過 = 整套「取餐進度通知」的核心功能失效**。
**必須修復 §6 的 P1 bug 後,即可視為 PASS。**

## 8. 重跑驗證建議

修補後請重跑以下命令:
```bash
cd smart-dining/backend && npm run db:reset          # 確保 fresh state
# 並依本報告 §2.1 啟動三個 dev server
node scripts/e2e-test.mjs                            # 期待 Total WS events received ≥ 8(4 statusChanged + 3 progress + 1 ready)
node backend/scripts/ws-test.mjs SD-YYYYMMDD-0001    # 期待 order:statusChanged / order:progress / order:ready 都印出
```

修補後,若 §3.1 表中 C9、C10 兩格變 ✅,即可把本次報告重新發佈為 **PASS**。

## 9. 附件

- 完整 server logs:`docs/qa-logs/{backend,kiosk,mobile}.log`(本次保存於專案內)
- E2E 測試腳本:`scripts/e2e-test.mjs`(本次新增)
- 預設 healthcheck 腳本:`backend/scripts/test-api.sh`(已存在)
- 預設 WS smoke 腳本:`backend/scripts/ws-test.mjs`(已存在 — 也受到 P1 bug 影響,應一併驗證)
