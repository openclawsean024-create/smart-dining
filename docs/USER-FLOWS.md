# 使用者旅程 — User Flows

> 三條關鍵 user flow,涵蓋 **顧客自助點餐**、**門市出餐推進**、**會員回購** 的完整閉環。
> 每條 flow 都附 ASCII 流程圖 + 對應的 API / WS 呼叫 + UI 狀態轉移。

---

## Flow 1: 顧客自助點餐(Self-Ordering on KIOSK)

**目標**:讓顧客在 2 分鐘內完成點餐 + 結帳 + 取得取餐號。

```text
  到店 → KIOSK 首頁(7 個分類入口)
       ↓
  點選「推薦餐點」分類 → 看到 3 張大卡 + 4 張小卡
       ↓
  點選「經典脆雞 $149」→ 跳底部客製化面板
       ↓
  選擇「主食:白飯」「醬料:醬油」「加購:薯條 +$30、雞塊 +$49」
       ↓
  點「完成客製 → 加入購物車」
       ↓
  重複加入其他品項(可樂、塔香脆雞)
       ↓
  點右側 CartSidebar「前往結帳」
       ↓
  CheckoutPage modal:輸入電話 → 取得驗證碼 1234 → 登入
       ↓
  看到 VIP 會員資訊 + 可用 VIP10 coupon
       ↓
  確認結帳 → 訂單建立(取餐號 A002,orderNo SD-20260824-0002)
       ↓
  CompletePage:取餐號 A002(超大橘底白字)
                 + 訂單編號副標
                 + 預計 12:24 可取餐
                 + QR code(80×80,內容「{WEB}/track/{orderNo}」)
                 + 列印取餐單 + 新訂單 雙按鈕
```

### 1.1 對應 API / WS 呼叫

| 步驟 | 呼叫 | 備註 |
|------|------|------|
| 進入 KIOSK 首頁 | `GET /api/menu` | 回傳 4 categories + 10 items + customizationGroups |
| 點選品項展開客製化 | (本地 state) | 讀 menu 已帶回的 customizationGroups |
| 加入購物車 | (本地 state) | 不打 API,僅更新 `useState` |
| 結帳輸入電話 | `POST /api/auth/login { phone }` | Demo 回傳 `{ code: '1234' }` |
| 驗證碼登入 | `POST /api/auth/verify { phone, code }` | 回傳 `{ token, member }`(JWT + Member) |
| 選擇 coupon | `GET /api/members/:id/coupons` | 列出未使用 / 未過期的可用 coupons |
| 確認結帳 | `POST /api/orders { cart, memberId, couponCode }` | 計算 subtotal / discount / totalAmount + 寫 Order + 寫 OrderStatusLog + 標記 coupon.usedAt + 累點 |
| 顯示完成頁 | (本地 state) | 從 `CreateOrderResponseBody.order` 取出 `pickupNumber` / `orderNo` / `estimatedReadyAt` |

### 1.2 狀態機

```text
  [KIOSK 首頁]
        │ 點餐點選
        ▼
  [購物車累積]
        │ 點擊「前往結帳」
        ▼
  [CheckoutPage]
   ├─ 未登入 → [Login Modal]
   │              │ 輸入電話 → POST /api/auth/login
   │              │ 輸入驗證碼 → POST /api/auth/verify → 拿 JWT + Member
   │              ▼
   ├─ 已登入 → 顯示 VIP 資訊 + 優惠券下拉
   │              │ 確認結帳 → POST /api/orders → 201
   │              ▼
  [CompletePage] ← 取餐號 A002 + QR code
        │
        ├─ 「列印取餐單」→ window.print() 或送印 API
        └─ 「新訂單」→ 清空購物車 + 回到 [KIOSK 首頁]
```

### 1.3 關鍵設計決策

- **單頁 Dashboard 不走 routing**:KIOSK 是封閉場景,三欄 + 底部客製化面板為單一頁面,狀態全部用 React state 管理(避免 1024×768 觸控體驗中的 routing 切換延遲)
- **底部客製化面板**:展開時占全寬 25%,展開期間右側購物車維持可見,讓顧客一邊選一邊看購物車總額
- **chips 視覺化**:SINGLE 為 radio 樣式、MULTI 為 checkbox 樣式,已選 = 深底白字 + 加價顯示
- **完成頁超大字**:取餐號 120-160px 橘底白字,圓角 20px,從 0 滾動到實際號碼的 1.5s 動畫(增強記憶點)

---

## Flow 2: 出餐人員推進狀態(Kitchen Stage Advance)

**目標**:讓門市人員在 1 秒內推進訂單到下一階段,並即時同步給顧客手機。

```text
  門市人員開瀏覽器到 http://localhost:5173/admin(或部署後網址)
       ↓
  AdminPanel 顯示所有 QUEUED/PREPARING/COOKING/PLATING 訂單
       ↓
  點擊「下一階段」按鈕(A002 訂單)
       ↓
  系統呼叫 POST /api/admin/orders/SD-20260824-0002/advance
       ↓
  後端更新 DB + 寫 OrderStatusLog + 廣播 WebSocket
       ↓
  顧客手機追蹤頁即時更新(進度從 10% → 30%)
       ↓
  重複 4 次:QUEUED → PREPARING → COOKING → PLATING → READY
       ↓
  到 READY 時:
    - 手機收到 order:ready 事件
    - 若啟用震動通知 → navigator.vibrate([300,100,300,100,300])
    - 頁面背景閃橘光 1 次
    - 取餐號碼卡變綠底
```

### 2.1 對應 API / WS 呼叫

| 步驟 | 呼叫 | 備註 |
|------|------|------|
| 進入 AdminPanel | `GET /api/orders` 列表(或 `GET /api/orders/member/:memberId` 篩選) | 列出 active 訂單 |
| 點擊「下一階段」 | `POST /api/admin/orders/:orderNo/advance` | 後端讀取 `getNextStage()` 計算下一階段 |
| 後端內部 | `prisma.order.update` + `prisma.orderStatusLog.create` + `io.to(orderRoom).emit(...)` | 同一 transaction 內完成 |
| 廣播 1 | `order:statusChanged` | 全狀態變更都發 |
| 廣播 2 | `order:progress` | PREPARING / COOKING / PLATING 時發(帶 percentage) |
| 廣播 3 | `order:ready` | READY 時額外發(觸發手機震動) |
| 手機接收 | Socket.IO client `socket.on('order:statusChanged', ...)` | 更新本地 trackStore |
| 手機視覺回饋 | `order:ready` 時 → `navigator.vibrate([300,100,300,100,300])` + 背景閃橘光 | 詳細設計見 design-spec.md §5 |

### 2.2 狀態機

```text
  QUEUED ──advance──> PREPARING ──advance──> COOKING
                                                  │
                                                  ▼
                                               PLATING
                                                  │
                                                  ▼
                                                READY  ← order:ready 廣播 + 手機震動
                                                  │
                                                  ▼
                                              COMPLETED  (管理員手動或自動超時)
                                                  │
                                                  ▼(可逆向)
                                              CANCELLED
```

> 詳見 `shared-contracts/src/realtime/stages.ts` 的 `PROGRESS_STAGES` 與 `getNextStage()` 函式。

### 2.3 廣播細節(後端 `backend/src/modules/admin/routes.ts`)

```ts
// 1. order:statusChanged — 全狀態變更都發
io.to(room).emit('order:statusChanged', {
  orderNo, status: next, pickupNumber, timestamp, stage: next,
});

// 2. order:progress — 中間階段發(QUEUED 之外)
if (['PREPARING','COOKING','PLATING','READY'].includes(next)) {
  const meta = PROGRESS_STAGE_MAP[next];
  io.to(room).emit('order:progress', {
    orderNo, stage: next, percentage: meta.percentage,
    estimatedReadyAt: order.estimatedReadyAt.toISOString(),
  });
}

// 3. order:ready — READY 時額外發
if (next === 'READY') {
  io.to(room).emit('order:ready', {
    orderNo, pickupNumber, timestamp,
  });
}
```

### 2.4 關鍵設計決策

- **獨立 `/advance` 端點 vs 通用 PATCH `/status`**:門市 UI 只會按「下一階段」,**不應該讓門市人員知道完整狀態列舉**;獨立端點封裝 `getNextStage()` 邏輯,降低誤操作風險。
- **共用廣播程式碼**:未來將廣播區段抽出成 `lib/broadcastOrderUpdate(app, order)`,讓 PATCH 與 advance 共用(詳見 QA-REPORT.md §6 P1 修補建議)。
- **不廣播 COMPLETED**:COMPLETED 是訂單生命週期結束,不再需要即時通知,顧客可在 HistoryPage 看到。
- **手機震動 / 閃光**:為 iOS/Android 通用 PWA 體驗最直接的「READY 了」回饋,比 toast 通知更難錯過。

---

## Flow 3: 會員回購(Member Re-Engagement)

**目標**:完成首購後,點數 + 優惠券雙引擎驅動顧客在 30 天內再次到店。

```text
  上次消費後,系統自動累點(NT$1 = 1 點)
  上次消費的 VIP10 coupon 被標記 used,系統另外發新 coupon(若活動設定)
       ↓
  顧客再次到店 → KIOSK 首頁輸入電話 0912345678
       ↓
  自動帶入 VIP 王小明資料(點數已更新 500 → 513)
       ↓
  CheckoutPage 顯示「可使用優惠券」下拉(若有新 coupon)
       ↓
  套用優惠券 → 確認結帳
       ↓
  訂單完成後:
    - member.points += floor(subtotal / 10) = +14
    - coupon.usedAt = now
    - 寫 PointsTransaction(+14, reason: 'ORDER_REWARD', orderId)
       ↓
  APP MemberPage 顯示更新後點數(513 + 14 = 527)
```

### 3.1 對應 API / WS 呼叫

| 步驟 | 呼叫 | 備註 |
|------|------|------|
| 輸入電話 | `POST /api/auth/login { phone }` | Demo 回傳 `1234` 驗證碼 |
| 驗證碼登入 | `POST /api/auth/verify { phone, code }` | 若 phone 已存在 → 回傳既有 Member(不建立新的) |
| 載入會員資料 | `GET /api/members/:id` | 顯示姓名 / 等級徽章 / 點數 |
| 載入可用優惠券 | `GET /api/members/:id/coupons` | 過濾 `usedAt = null` 且 `expiresAt > now` |
| 建立訂單(已夾帶 couponCode) | `POST /api/orders { cart, memberId, couponCode }` | 後端在 transaction 內:(1) 計算 discount (2) 標記 coupon.usedAt (3) 累點 `Math.floor(subtotal)` |
| 查詢訂單歷史 | `GET /api/orders/member/:memberId?limit=10` | MemberPage / HistoryPage 顯示 |
| 顯示點數歷程(可選) | `GET /api/members/:id/points/history`(未實作) | 規劃中,改由前端從 orders 聚合 |

### 3.2 點數規則(後端 `backend/src/modules/orders/routes.ts`)

```ts
// 在 prisma.$transaction 內,與建立訂單、標記 coupon.usedAt 一起完成
if (memberId) {
  await tx.member.update({
    where: { id: memberId },
    data: { points: { increment: Math.floor(subtotal) } },
  });
}
```

> ⚠️ 註:本專案將累點寫在建立訂單時(以 subtotal = NT$ 為基準)。如果需要「ORDER_REWARD」型的 `PointsTransaction` 紀錄,需另外呼叫 `POST /api/members/:id/points/add { delta, reason: 'ORDER_REWARD', orderId }`(此端點已實作)。

### 3.3 優惠券規則(後端 `backend/src/modules/orders/routes.ts`)

```ts
if (couponCode) {
  coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
  if (!coupon || coupon.usedAt || coupon.expiresAt < new Date()) {
    return reply.code(400).send({ error: 'invalid coupon' });
  }
  discount = coupon.type === 'PERCENTAGE'
    ? subtotal * coupon.value / 100
    : Math.min(subtotal, coupon.value);
}
// ... 之後在 transaction 內標記 coupon.usedAt
```

### 3.4 狀態機

```text
  [首次消費]
      │
      ▼
  Coupon.usedAt = now  (used 一次後永久失效)
      │
      ▼
  Member.points += floor(subtotal / 10)
      │
      ▼
  寫 PointsTransaction(delta, reason, orderId)
      │
      ▼
  [下次到店]
      │
      ▼
  GET /api/members/:id/coupons → 列出其他可用 coupon(若有新發)
      │
      ▼
  重複上述流程
```

### 3.5 關鍵設計決策

- **`upsert` 機制**:`POST /api/auth/verify` 用 Prisma `upsert` — phone 已存在就用既有 Member,phone 不存在就建立新 Member(預設 name = null、tier = BRONZE、points = 0)。這讓「新客首次到店」與「舊客回購」走同一條驗證流程,大幅降低 UX 摩擦。
- **coupon 與 member 解耦**:coupon 表有 `memberId` 欄位(可為 null = 全店通用),種子資料 VIP10 / WELCOME 都綁特定會員。`GET /api/members/:id/coupons` 自動過濾掉 `usedAt` / 過期。
- **點數過期**:目前未實作,規劃在 v1.1 加 `expireAt` 欄位與排程清除。
- **優惠券發放**:目前靠 `db:reset` + seed 預建。規劃在 v1.1 加行銷活動模組(滿額送、回購提醒、生日券)。

---

## 附錄:跨流程的狀態轉換總覽

```text
  ┌─────────────┐   POST /api/orders        ┌──────────────────┐
  │  顧客(KIOSK) ├──────────────────────────►│  Backend / DB    │
  │  + Mobile   │   WS track:order          │  Order = QUEUED  │
  └─────┬───────┘   ◄──────────────────────┐└────────┬─────────┘
        │                                   │         │
        │  Flow 1: 點餐 + 結帳              │         │ Flow 2: 門市 advance
        │  (回傳 orderNo + pickupNumber)    │         │ (廣播 3 個 WS 事件)
        │                                   │         │
        │           ┌───────────────────────┴─────────▼─────────┐
        │           │  Mobile APP TrackPage                     │
        │           │  - 進度條:10% → 30% → 60% → 85% → 100%   │
        │           │  - 階段 chip 同步更新                     │
        │           │  - READY 時震動 + 閃橘光                  │
        └───────────┤                                          │
                    └──────────────────────────────────────────┘
                                      │
                                      │ Flow 3: 下次回購
                                      ▼
                    ┌─────────────────────────────┐
                    │ Member.points += floor(    │
                    │   subtotal / 10)            │
                    │ coupon.usedAt = now         │
                    │ PointsTransaction(+delta)   │
                    └─────────────────────────────┘
```

> 對應的詳細 API 規格見 [API.md](./API.md);系統層級資料流見 [../ARCHITECTURE.md §3](../ARCHITECTURE.md)。
