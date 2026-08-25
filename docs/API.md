# API 參考 — REST + WebSocket

> 本文件整理自 `shared-contracts/src/api/endpoints.ts` 與 `shared-contracts/src/realtime/events.ts`,並對應到 `backend/src/modules/*/routes.ts` 的實際實作。所有路徑常數與型別均以 `@smart-dining/contracts` 為單一真實來源。

## 目錄

- [REST API](#rest-api)
  - [`GET /healthz`](#get-healthz)
  - [`POST /api/auth/login`](#post-apiauthlogin)
  - [`POST /api/auth/verify`](#post-apiauthverify)
  - [`GET /api/menu`](#get-apimenu)
  - [`POST /api/orders`](#post-apiorders)
  - [`GET /api/orders/:orderNo`](#get-apiordersorderno)
  - [`GET /api/orders/member/:memberId`](#get-apiordersmembermemberid)
  - [`PATCH /api/orders/:orderNo/status`](#patch-apiordersordernostatus)
  - [`POST /api/admin/orders/:orderNo/advance`](#post-apiadminordersordernoadvance)
  - [`GET /api/members/:id`](#get-apimembersid)
  - [`GET /api/members/:id/coupons`](#get-apimembersidcoupons)
  - [`POST /api/members/:id/points/add`](#post-apimembersidpointsadd)
- [WebSocket API](#websocket-api)
  - [Namespace 與房間](#namespace-與房間)
  - [Client → Server: `track:order`](#client--server-trackorder)
  - [Server → Client: `order:statusChanged`](#server--client-orderstatuschanged)
  - [Server → Client: `order:progress`](#server--client-orderprogress)
  - [Server → Client: `order:ready`](#server--client-orderready)
- [通用錯誤碼](#通用錯誤碼)
- [cURL 範例總集](#curl-範例總集)

---

## REST API

**Base URL**:`http://localhost:4000`(開發環境;正式環境由反向代理決定)

**認證**:Demo 階段所有端點**未強制**認證(`Auth` 欄全為 ❌);`POST /api/auth/verify` 回傳的 JWT 預留給 v1.1 強制認證時使用。

**Content-Type**:`application/json`

### `GET /healthz`

健康檢查端點。

- **Auth**:❌
- **Request**:—
- **Response 200**:
```json
{ "ok": true }
```

**cURL**:
```bash
curl -s http://localhost:4000/healthz
```

---

### `POST /api/auth/login`

發送登入驗證碼(Demo 階段固定回傳 `1234`)。

- **Auth**:❌
- **Request Body**(`LoginRequestBody`):
```json
{ "phone": "0912345678" }
```
- **Response 200**(`LoginResponseBody`):
```json
{ "code": "1234", "message": "Development verification code" }
```
- **Response 400**:`{ "error": "phone required" }`

**cURL**:
```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0912345678"}'
```

---

### `POST /api/auth/verify`

用電話 + 驗證碼登入,回傳 JWT 與 Member。若 phone 不存在會自動 `upsert` 新會員(預設 `tier = BRONZE`、`points = 0`、`name = null`)。

- **Auth**:❌
- **Request Body**(`VerifyRequestBody`):
```json
{ "phone": "0912345678", "code": "1234" }
```
- **Response 200**(`VerifyResponseBody`):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "member": {
    "id": "cm123...",
    "phone": "0912345678",
    "name": "王小明",
    "points": 500,
    "tier": "GOLD",
    "createdAt": "2026-08-20T10:00:00.000Z"
  }
}
```
- **Response 401**:`{ "error": "Invalid code" }`(驗證碼錯誤)

**cURL**:
```bash
curl -s -X POST http://localhost:4000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0912345678","code":"1234"}'
```

---

### `GET /api/menu`

取得完整菜單(分類 → 品項 → 客製化群組 → 選項)。供 KIOSK 首頁渲染。

- **Auth**:❌
- **Request**:—
- **Response 200**(`MenuResponseBody`):
```json
{
  "categories": [
    {
      "id": "cat1", "name": "推薦餐點", "displayOrder": 1, "icon": "🍱",
      "items": [
        {
          "id": "item1", "categoryId": "cat1", "name": "經典脆雞",
          "basePrice": 149, "imageUrl": null, "description": null,
          "available": true, "tags": "spicy",
          "customizationGroups": [
            {
              "id": "cg1", "menuItemId": "item1",
              "groupName": "主食選擇", "type": "SINGLE",
              "required": true, "displayOrder": 1,
              "choices": [
                {"id": "c1", "groupId": "cg1", "name": "白飯", "priceDelta": 0, "available": true},
                {"id": "c2", "groupId": "cg1", "name": "冬粉", "priceDelta": 0, "available": true},
                {"id": "c3", "groupId": "cg1", "name": "玉米蛋堡", "priceDelta": 10, "available": true}
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**型別對應**:`Category & { items: Array<MenuItem & { customizationGroups: CustomizationGroup[] }> }`

**cURL**:
```bash
curl -s http://localhost:4000/api/menu | jq '.categories | length, [.[] | .items | length] | add'
```

---

### `POST /api/orders`

建立訂單。在一個 transaction 內完成:
1. 計算 `subtotal`(各品項 `basePrice * quantity`)
2. 計算 `discount`(PERCENTAGE = `subtotal * value / 100`;AMOUNT = `Math.min(subtotal, value)`)
3. 計算 `totalAmount = subtotal - discount`
4. 產生 `orderNo`(格式 `SD-YYYYMMDD-XXXX`)與 `pickupNumber`(格式 `A001` 起跳)
5. 預估 `estimatedReadyAt = now + 195s`(基於 `PROGRESS_STAGE_MAP.estimatedSeconds` 加總)
6. 寫 `Order` + `OrderItem` + `OrderStatusLog(QUEUED, changedBy: 'system')`
7. 若有 `couponCode`:標記 `coupon.usedAt = now`
8. 若有 `memberId`:`member.points += Math.floor(subtotal)`

- **Auth**:❌
- **Request Body**(`CreateOrderRequestBody`):
```json
{
  "cart": {
    "items": [
      {
        "menuItemId": "item1",
        "name": "經典脆雞",
        "quantity": 1,
        "unitPrice": 149,
        "customizations": [
          {
            "groupId": "cg1", "groupName": "主食選擇",
            "choiceIds": ["c1"], "choiceNames": ["白飯"]
          },
          {
            "groupId": "cg3", "groupName": "加購",
            "choiceIds": ["c-fries", "c-nuggets"],
            "choiceNames": ["薯條", "雞塊(6pc)"]
          }
        ]
      }
    ]
  },
  "memberId": "m1",
  "couponCode": "VIP10"
}
```
- **Response 201**(`CreateOrderResponseBody`):
```json
{
  "order": {
    "id": "ord1",
    "orderNo": "SD-20260824-0002",
    "memberId": "m1",
    "subtotal": 149, "discount": 14.9, "totalAmount": 134.1,
    "status": "QUEUED",
    "pickupNumber": 2,
    "estimatedReadyAt": "2026-08-24T12:24:00.000Z",
    "createdAt": "2026-08-24T12:21:45.000Z",
    "items": [],
    "statusLog": []
  }
}
```
- **Response 400**:`{ "error": "cart required" }` / `{ "error": "invalid menu item" }` / `{ "error": "invalid coupon" }`

**cURL**:
```bash
curl -s -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "cart": {"items":[{"menuItemId":"item1","name":"經典脆雞","quantity":1,"unitPrice":149,"customizations":[]}]},
    "memberId":"m1",
    "couponCode":"VIP10"
  }'
```

---

### `GET /api/orders/:orderNo`

查詢單筆訂單(含 items + statusLogs,statusLogs 按 `changedAt` 升冪)。

- **Auth**:❌
- **Path Params**:`orderNo`(e.g. `SD-20260824-0002`)
- **Response 200**(`GetOrderResponseBody`):同 `CreateOrderResponseBody` 結構
- **Response 404**:`{ "error": "not found" }`

**cURL**:
```bash
curl -s http://localhost:4000/api/orders/SD-20260824-0002
```

---

### `GET /api/orders/member/:memberId`

查詢會員訂單歷史(降冪排序)。

- **Auth**:❌
- **Path Params**:`memberId`
- **Query Params**:`limit`(預設 20,上限 100)
- **Response 200**(`GetMemberOrdersResponseBody`):
```json
{
  "orders": []
}
```

**cURL**:
```bash
curl -s 'http://localhost:4000/api/orders/member/m1?limit=10'
```

---

### `PATCH /api/orders/:orderNo/status`

手動更新訂單狀態 + 寫 OrderStatusLog + 廣播 WebSocket(見下方 WS 段落)。**門市人員實際使用的是 `/api/admin/orders/:orderNo/advance`,本端點為 admin / debug 用**。

- **Auth**:❌
- **Request Body**(`UpdateOrderStatusRequestBody`):
```json
{
  "status": "COOKING",
  "changedBy": "admin"
}
```
- **Response 200**(`UpdateOrderStatusResponseBody`):同 Order 結構

**狀態值**:`QUEUED` / `PREPARING` / `COOKING` / `PLATING` / `READY` / `COMPLETED` / `CANCELLED`

**cURL**:
```bash
curl -s -X PATCH http://localhost:4000/api/orders/SD-20260824-0002/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"COOKING","changedBy":"admin"}'
```

---

### `POST /api/admin/orders/:orderNo/advance`

門市出餐人員「下一階段」按鈕使用的端點。後端內部呼叫 `getNextStage(currentStatus)` 決定下一個狀態。**同時廣播 1~3 個 WS 事件**(詳見 §WebSocket)。

- **Auth**:❌
- **Path Params**:`orderNo`
- **Response 200**(`AdvanceOrderResponseBody`):
```json
{
  "order": {},
  "advanced": true,
  "previousStatus": "QUEUED",
  "newStatus": "PREPARING"
}
```
- **Response 404**:`{ "error": "order not found" }`

**特殊情況**:
- 若訂單已是 `READY` / `CANCELLED` → 回傳 `{ advanced: false, reason: 'order already READY' }`
- 若 `getNextStage()` 回傳 `null`(理論上不會,因為 READY 已短路)→ `{ advanced: false, reason: 'no next stage' }`

**cURL**:
```bash
curl -s -X POST http://localhost:4000/api/admin/orders/SD-20260824-0002/advance
```

---

### `GET /api/members/:id`

取得會員資料。

- **Auth**:❌
- **Path Params**:`id`
- **Response 200**(`GetMemberResponseBody`):
```json
{
  "member": {
    "id": "m1", "phone": "0912345678", "name": "王小明",
    "points": 500, "tier": "GOLD",
    "createdAt": "2026-08-20T10:00:00.000Z"
  }
}
```
- **Response 404**:`{ "error": "not found" }`

**cURL**:
```bash
curl -s http://localhost:4000/api/members/m1
```

---

### `GET /api/members/:id/coupons`

取得會員可用優惠券(過濾 `usedAt = null` 且 `expiresAt > now`,按 `expiresAt` 升冪)。

- **Auth**:❌
- **Path Params**:`id`
- **Response 200**(`GetMemberCouponsResponseBody`):
```json
{
  "coupons": [
    {
      "id": "cp1", "code": "VIP10",
      "type": "PERCENTAGE", "value": 10,
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "usedAt": null, "memberId": "m1"
    }
  ]
}
```

**cURL**:
```bash
curl -s http://localhost:4000/api/members/m1/coupons
```

---

### `POST /api/members/:id/points/add`

在 transaction 內:
1. 寫一筆 `PointsTransaction(delta, reason, orderId?)`
2. 更新 `Member.points`(`increment: delta`)

- **Auth**:❌
- **Path Params**:`id`
- **Request Body**(`AddPointsRequestBody`):
```json
{
  "delta": 14,
  "reason": "ORDER_REWARD",
  "orderId": "ord1"
}
```
- **Response 200**(`AddPointsResponseBody`):`{ "member": {} }`

**cURL**:
```bash
curl -s -X POST http://localhost:4000/api/members/m1/points/add \
  -H 'Content-Type: application/json' \
  -d '{"delta":14,"reason":"ORDER_REWARD","orderId":"ord1"}'
```

---

## WebSocket API

### Namespace 與房間

- **Namespace**:`/tracking`(客戶端連線至 `http://localhost:4000/tracking`)
- **房間命名**:`order:${orderNo}`(每張訂單一個獨立房間;由 `orderRoom(orderNo)` helper 產生)
- **Library**:`socket.io-client`(前端)

### Client → Server: `track:order`

客戶端加入特定訂單房間以接收後續廣播。

- **事件名**:`track:order`
- **Payload**(`TrackOrderRequest`):
```ts
interface TrackOrderRequest { orderNo: string }
```
- **Ack**(`TrackOrderResponse`):
```ts
interface TrackOrderResponse { ok: boolean; orderNo: string }
```

**Client 範例**:
```ts
import { io } from 'socket.io-client';
const socket = io('http://localhost:4000', { path: '/socket.io', transports: ['websocket'] });
socket.on('connect', () => {
  socket.emit('track:order', { orderNo: 'SD-20260824-0002' }, (resp) => {
    console.log('joined room', resp);
  });
});
```

### Server → Client: `order:statusChanged`

任何狀態變更都會廣播(含 QUEUED、READY、COMPLETED、CANCELLED)。

- **事件名**:`order:statusChanged`
- **Payload**(`OrderStatusChangedEvent`):
```ts
interface OrderStatusChangedEvent {
  orderNo: string;
  status: 'QUEUED' | 'PREPARING' | 'COOKING' | 'PLATING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  pickupNumber: number;
  timestamp: string;       // ISO 8601
  stage: 'QUEUED' | 'PREPARING' | 'COOKING' | 'PLATING' | 'READY';
}
```

**Client 範例**:
```ts
socket.on('order:statusChanged', (e) => {
  console.log(`${e.orderNo} → ${e.status}`);
});
```

### Server → Client: `order:progress`

中段階段的進度更新,提供百分比與預估完成時間。

- **事件名**:`order:progress`
- **Payload**(`OrderProgressEvent`):
```ts
interface OrderProgressEvent {
  orderNo: string;
  stage: 'QUEUED' | 'PREPARING' | 'COOKING' | 'PLATING' | 'READY';
  percentage: number;          // 10 / 30 / 60 / 85 / 100
  estimatedReadyAt: string;   // ISO 8601
}
```

**觸發時機**:後端在 `status ∈ { PREPARING, COOKING, PLATING, READY }` 時廣播。QUEUED 不發(由 `order:statusChanged` 提供即可)。

### Server → Client: `order:ready`

訂單進入 READY 時的專屬事件,用於觸發手機震動 / 閃光等高優先級 UX 回饋。

- **事件名**:`order:ready`
- **Payload**(`OrderReadyEvent`):
```ts
interface OrderReadyEvent {
  orderNo: string;
  pickupNumber: number;
  timestamp: string;
}
```

**Client 範例**(mobile-app):
```ts
socket.on('order:ready', (e) => {
  // 1. 震動([振動 300ms, 暫停 100ms, 振動 300ms, 暫停 100ms, 振動 300ms])
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 100, 300, 100, 300]);
  }
  // 2. 背景閃橘光 1 次
  document.body.classList.add('flash-ready');
  setTimeout(() => document.body.classList.remove('flash-ready'), 1500);
});
```

**完整事件流(從 QUEUED 推進到 READY)**:
```
Time   Event                  Payload
----   ---------------------  ------------------------------
T+0s   order:statusChanged    { status: 'PREPARING', stage: 'PREPARING' }
T+0s   order:progress         { stage: 'PREPARING', percentage: 30 }
T+45s  order:statusChanged    { status: 'COOKING', stage: 'COOKING' }
T+45s  order:progress         { stage: 'COOKING', percentage: 60 }
T+135s order:statusChanged    { status: 'PLATING', stage: 'PLATING' }
T+135s order:progress         { stage: 'PLATING', percentage: 85 }
T+165s order:statusChanged    { status: 'READY', stage: 'READY' }
T+165s order:progress         { stage: 'READY', percentage: 100 }
T+165s order:ready            { timestamp, pickupNumber }   <-- 觸發手機震動
```

---

## 通用錯誤碼

| HTTP | 場景 | Response Body |
|------|------|---------------|
| 400 | 缺少必填欄位 | `{ "error": "<field> required" }` |
| 400 | 購物車為空 | `{ "error": "cart required" }` |
| 400 | menuItem 不存在 / 停售 | `{ "error": "invalid menu item" }` |
| 400 | 優惠券無效 / 已用 / 過期 | `{ "error": "invalid coupon" }` |
| 401 | 驗證碼錯誤 | `{ "error": "Invalid code" }` |
| 404 | 訂單 / 會員不存在 | `{ "error": "not found" }` 或 `{ "error": "order not found" }` |
| 500 | Prisma / Fastify 內部錯誤 | Fastify 預設錯誤格式 |

> WebSocket 層級錯誤(連線失敗 / 房間不存在)由 socket.io-client 內建機制處理,通常表現為 `socket.on('connect_error', ...)`。

---

## cURL 範例總集

```bash
# 一鍵範例:從建立訂單 -> 推進狀態 -> 查詢
BASE=http://localhost:4000

# 1. 登入 + 驗證
TOKEN=$(curl -s -X POST $BASE/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0912345678","code":"1234"}' | jq -r .token)

# 2. 建立訂單
curl -s -X POST $BASE/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "cart":{"items":[{"menuItemId":"item1","name":"經典脆雞","quantity":1,"unitPrice":149,"customizations":[]}]},
    "memberId":"m1",
    "couponCode":"VIP10"
  }'

# 3. 推進 4 次:QUEUED -> READY
for i in 1 2 3 4; do
  curl -s -X POST $BASE/api/admin/orders/SD-20260824-0002/advance
  sleep 1
done

# 4. 查訂單最終狀態
curl -s $BASE/api/orders/SD-20260824-0002 | jq '.order | {orderNo,status,pickupNumber,totalAmount,statusLog}'
```

---

## 對應原始碼位置

| 端點 / 事件 | 檔案 |
|-------------|------|
| REST contracts | `shared-contracts/src/api/endpoints.ts` |
| WS contracts | `shared-contracts/src/realtime/events.ts` |
| 製作階段常數 | `shared-contracts/src/realtime/stages.ts` |
| `/api/auth/*` | `backend/src/modules/auth/routes.ts` |
| `/api/menu` | `backend/src/modules/menu/routes.ts` |
| `/api/orders/*` | `backend/src/modules/orders/routes.ts` |
| `/api/admin/orders/:orderNo/advance` | `backend/src/modules/admin/routes.ts` |
| `/api/members/*` | `backend/src/modules/members/routes.ts` |
| WebSocket bootstrap | `backend/src/server.ts` |
