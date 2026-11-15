# 餐飲自助點餐 KIOSK＋POS — 產品需求規格（PRD）

> 版本：v4.0（PRD 重建，2026-11-16）
> 取代：v3.0.2 fleet-upgrade（2026-09-06）。舊版把多項功能標為「✅ shipped」，但與程式實況不符（見 §11.1），本版一律以程式碼為準。
> 商業依據：Notion 資料庫「可產品化商品」中的「餐飲自助點餐 KIOSK＋POS」條目（P2，開發順位第 6）。
> 本次只重建文件，尚未進行任何功能開發。

---

## 0. 文件資訊

| 欄位 | 值 |
|---|---|
| 產品名稱 | 餐飲自助點餐 KIOSK＋POS（repo 內舊名：餐飲點餐快手 / Smart Dining） |
| 主 repo | `openclawsean024-create/smart-dining`（預設分支 `main`） |
| 要併入的 repo | `pos-multitrade`、`pos-system`、`restaurant-kiosk`（只讀，合併清單見 §12） |
| 優先順序 | P2；開發順位第 6 |
| 現況完成度（Notion） | 55% |
| 獲利潛力 | 中 |
| 獲利模式 | SaaS 訂閱、專案建置 |
| 目標客群 | 台灣中小型餐飲門市 |
| 上市前要補（Notion） | 合併四個 repo、補測試、電子發票與金流串接、硬體相容 |
| 主要風險（Notion） | iCHEF 等競品成熟；電子發票與金流法規門檻 |

---

## 1. 問題

台灣中小型餐飲門市在尖峰時段常同時遇到：

1. **櫃台排隊**：點餐與結帳集中在一個收銀台，人力不足時出餐跟著卡住。
2. **取餐資訊不透明**：顧客不知道餐點做到哪，只能在櫃台前等叫號。
3. **工具分散**：KIOSK 自助點餐、櫃台 POS、廚房出單、會員點數常是不同系統，資料不互通。
4. **上線門檻**：要合法營業必須開立電子發票，並串接信用卡或行動支付；小店缺乏工程能力自行串接。

本產品要把「KIOSK 自助點餐＋櫃台 POS 收銀＋廚房出餐（KDS）＋手機取餐追蹤＋會員回訪」放在同一套後端與資料模型上。

> 上述痛點來自既有 repo 文件的產品假設，**尚未經過客戶訪談驗證（待確認）**。

## 2. 目標客群

| Persona | 情境 | 主要任務 |
|---|---|---|
| 店長／老闆（付費者） | 單店或少數分店的中小型餐飲門市 | 降低櫃台人力、看當日營收、管理菜單與會員 |
| 櫃台店員 | 尖峰時段收銀 | 快速代客點餐、收現金找零、處理退款 |
| 內場出餐人員 | 廚房／吧台 | 依先後順序看單、一鍵推進製作狀態 |
| 顧客 | 到店用 KIOSK 點餐、手機看進度 | 2 分鐘內完成點餐、READY 時收到通知 |

不在目標內：大型連鎖總部 ERP、外送平台整合商、非餐飲業（零售、服務業）。

## 3. 獲利模式

| 模式 | 說明 | 狀態 |
|---|---|---|
| SaaS 訂閱 | 每店月費，含 KIOSK／POS／KDS／會員模組 | 定價**待 Sean 決定** |
| 專案建置 | 導入費：菜單建檔、硬體安裝與設定、電子發票／金流申辦協助 | 報價方式**待 Sean 決定** |

> 併入的 `pos-multitrade` 舊規格曾提出「連鎖加盟版一次性 NT$1,499」（其 ADR-007），與 Notion 的 SaaS 訂閱模式不一致，本版不沿用，**待 Sean 確認**。

## 4. 競品與差異

| 競品 | 類型 | 備註 |
|---|---|---|
| iCHEF | 台灣餐飲 POS | Notion 列為主要競品，產品成熟。功能範圍、價格、市佔**待確認** |
| 肚肚（Dudoo）等台灣餐飲 POS | 餐飲 POS／點餐 | 是否為直接競品、價格**待確認** |
| Ocard 等會員 CRM | 會員／點數 | 與本產品會員模組重疊程度**待確認** |

> 本文件不列任何競品價格、市佔或市場規模數字。`pos-multitrade/PRD/COMPETITOR-BENCHMARK.md` 與 `DISCOVERY/market-research.md` 附有部分官網、部落格與論壇連結，但本次未逐一查證，其中的數字一律視為**待確認**，不引用；`DISCOVERY/` 也屬零售／服務業多行業定位，與本產品客群不同。

**預期差異（假設，待驗證）**

1. KIOSK、POS、KDS、手機追蹤共用同一個後端與訂單模型，不需多套系統對帳。
2. 顧客手機即時追蹤（Socket.IO 推播）＋會員點數／優惠券，對小店是加值功能。
3. 「專案建置」協助電子發票與金流申辦，降低小店上線門檻。

---

## 5. 現況總覽（以程式碼為準，2026-11-16 盤點）

### 5.1 主 repo `smart-dining`

| 區塊 | 技術 | 已實作 |
|---|---|---|
| `backend/` | Node.js + TypeScript、Fastify 4、Prisma 5（SQLite dev）、Socket.IO 4、@fastify/jwt、zod | `GET /api/menu`、`POST /api/orders`、`GET /api/orders/:orderNo`、`GET /api/orders/member/:memberId`、`PATCH /api/orders/:orderNo/status`、`POST /api/admin/orders/:orderNo/advance`、`POST /api/auth/login`、`POST /api/auth/verify`、`GET /api/members/:id`、`GET /api/members/:id/coupons`、`POST /api/members/:id/points/add`、`GET /healthz`；Socket.IO `/tracking` namespace；OTPProvider 抽象（Dev 固定碼／Mock 一次性碼）；每日取餐號與訂單號產生 |
| `kiosk-frontend/` | React 18 + Vite 6 + Tailwind 3 + zustand + SWR | 三欄式菜單、分類、客製化面板、購物車、結帳 modal（電話＋驗證碼會員登入、優惠券）、完成頁（取餐號、QR Code、`window.print()` 列印取餐單）、`/admin` 訂單推進頁 |
| `mobile-app/` | React 18 + Vite 5 + PWA + jsQR | 掃 QR／輸入單號追蹤、WebSocket 即時進度（失敗時 10 秒輪詢）、READY 震動開關、會員登入、會員頁、優惠券、歷史訂單 |
| `shared-contracts/` | TypeScript | API 路徑、Socket 事件、製作階段（QUEUED→PREPARING→COOKING→PLATING→READY→COMPLETED／CANCELLED）、型別 |
| 資料模型 | Prisma | Member、Coupon、Category、MenuItem、CustomizationGroup、CustomizationChoice、Order、OrderItem、OrderStatusLog、PointsTransaction |
| 測試 | Vitest | 僅 `backend/src/lib/__tests__/verifyCode.test.ts`（11 個 case）；前端無任何測試 |

### 5.2 程式實況中的缺陷（M1 須處理）

1. **伺服器端計價忽略客製化加價**：`POST /api/orders` 以 `basePrice` 計價，未加總 `CustomizationChoice.priceDelta`；品項名稱直接採用前端傳入值。
2. **後台訂單清單 API 不存在**：`kiosk-frontend/src/api/admin.ts` 呼叫 `GET /api/admin/orders`，後端沒有此路由，失敗時回空陣列，所以 `/admin` 頁永遠沒有訂單。
3. **KIOSK 優惠券與資料庫不一致**：結帳頁寫死 `WELCOME10`、`SAVE50`，seed 只有 `VIP10`、`WELCOME`，後端會回 `invalid coupon`。
4. **缺乏授權**：`/api/admin/*`、`PATCH /api/orders/:orderNo/status`、`/api/members/:id*`（含加點數）都沒有驗證 JWT，任何人可推進訂單、讀會員資料、加點數。
5. **日期邊界錯誤**：`orderNo.ts`、`pickupNumber.ts` 的「今天 0 點」在模組載入時計算一次，服務跨日不重啟會延續前一天的流水號；訂單號日期用 `toISOString()`（UTC），台灣時間 00:00～08:00 建立的訂單會帶前一天日期（2026-11-16 本機實測：台灣時間凌晨建立的訂單號為 `SD-20261115-xxxx`）。
6. **沒有付款流程**：KIOSK 結帳直接建立訂單，沒有付款方式、付款狀態，也沒有發票。
7. **測試腳本失效**：`backend` 的 `test:e2e` 指向不存在的 `scripts/e2e.mjs`（實際檔案在根目錄 `scripts/e2e-test.mjs`，本機實測可通過）；`backend/scripts/test-api.sh` 可執行但多數請求打到錯誤路徑或 ID，回傳 404／500，且腳本不檢查結果、永遠以 0 結束。
8. **Prisma schema 重複**：`backend/prisma/schema.prisma` 與 `shared-contracts/prisma/schema.prisma` 內容相同但為兩份檔案，而 build 使用 backend 那份；舊 AGENTS.md 宣稱「單一來源在 shared-contracts」與實況不符。
9. **隱性依賴**：backend 匯入 `fastify-plugin`，但未列在 `backend/package.json`，依賴其他套件間接安裝。
10. **CI 的 lint／typecheck 設為 `continue-on-error: true`**，型別錯誤不會擋下合併。

---

## 6. 功能需求（FR）

標記說明：**優先**＝P0（上市必備）／P1（上市後短期）／P2（加值）；**狀態**＝已實作／部分／未實作；**所在**＝目前程式所在 repo（`SD`＝smart-dining、`PS`＝pos-system、`PM`＝pos-multitrade、`RK`＝restaurant-kiosk）。

### 6.1 顧客端（KIOSK／手機）

| FR | 名稱 | 優先 | 狀態 | 所在 | 備註 |
|---|---|---|---|---|---|
| FR-001 | KIOSK 菜單瀏覽（分類、推薦標籤、品項卡） | P0 | 已實作 | SD | |
| FR-002 | 品項客製化（必選／選填群組、加價選項） | P0 | 部分 | SD、RK | 前端可選；後端未計入加價（§5.2-1）。RK 有正確的加價計算函式 |
| FR-003 | 購物車與金額小計 | P0 | 已實作 | SD | |
| FR-004 | KIOSK 結帳並取得取餐號＋QR Code | P0 | 已實作 | SD | |
| FR-005 | 列印取餐單 | P0 | 部分 | SD | 僅瀏覽器 `window.print()`；無熱感印表機支援 |
| FR-006 | 手機掃 QR／輸入單號追蹤進度 | P0 | 已實作 | SD | |
| FR-007 | 即時推播製作進度（Socket.IO）與輪詢備援 | P0 | 已實作 | SD | |
| FR-008 | READY 震動通知 | P1 | 已實作 | SD | 依瀏覽器支援 |
| FR-009 | PWA 安裝 | P1 | 已實作 | SD | |
| FR-010 | 多語系（繁中／英文） | P2 | 部分 | PM | 僅 PM 工作台有 locale 切換；SD 無 |

### 6.2 會員

| FR | 名稱 | 優先 | 狀態 | 所在 | 備註 |
|---|---|---|---|---|---|
| FR-020 | 電話＋一次性驗證碼登入（OTPProvider 抽象） | P0 | 部分 | SD | 只有 Dev／Mock provider，無真實簡訊 |
| FR-021 | 消費累積點數 | P0 | 部分 | SD、PS | SD 依小計 1 元 1 點；結帳時未寫 PointsTransaction；退款不回沖 |
| FR-022 | 優惠券（百分比／金額折抵、單次使用、到期） | P0 | 部分 | SD | KIOSK 寫死券碼與 DB 不一致（§5.2-3） |
| FR-023 | 會員中心（點數、優惠券、歷史訂單） | P1 | 已實作 | SD | |
| FR-024 | 會員等級（依累計消費自動升等） | P1 | 部分 | PS、SD | PS 有 `calcTier`；SD 只有 `tier` 欄位、無升等邏輯 |
| FR-025 | 後台會員列表／查詢／消費排行 | P1 | 部分 | PS | PS 為 localStorage 版 |
| FR-026 | 儲值卡餘額 | P2 | 部分 | PS | 涉及預收款法規，**待確認**後才可上線 |
| FR-027 | 會員個資查詢、匯出與刪除（當事人權利） | P0 | 未實作 | — | 見 §8 |

### 6.3 櫃台 POS

| FR | 名稱 | 優先 | 狀態 | 所在 | 備註 |
|---|---|---|---|---|---|
| FR-040 | 店員收銀畫面（品項選擇、購物車、數量調整） | P0 | 部分 | PS、PM | 兩者皆為純前端本機儲存，未接後端 |
| FR-041 | 條碼／SKU 輸入加入購物車（鍵盤式掃碼槍） | P1 | 部分 | PS | |
| FR-042 | 整單折扣 | P1 | 部分 | PS | |
| FR-043 | 付款方式選擇與現金找零 | P0 | 部分 | PS、PM | 僅記錄付款方式，無真實金流 |
| FR-044 | 交易作廢／退款（原因、庫存還原） | P0 | 部分 | PS | PS 退款不回沖點數 |
| FR-045 | 交易紀錄查詢與篩選 | P0 | 部分 | PS、PM | |
| FR-046 | 營業稅設定（內含／外加、稅率） | P0 | 部分 | PS | 電子發票前置條件 |
| FR-047 | 交班／開關帳（開班現金、結班對帳） | P1 | 未實作 | — | PS 只有 `Shift` 型別，無功能 |
| FR-048 | 離線收銀與恢復後同步 | P1 | 未實作 | — | PM 僅偵測 `navigator.onLine`，全部資料本來就只存在本機，不是離線同步 |

### 6.4 內場與後台

| FR | 名稱 | 優先 | 狀態 | 所在 | 備註 |
|---|---|---|---|---|---|
| FR-060 | 訂單狀態推進並廣播（admin advance） | P0 | 已實作 | SD | 無授權（§5.2-4） |
| FR-061 | 後台進行中訂單清單 | P0 | 部分 | SD | 前端已寫，後端 API 缺（§5.2-2） |
| FR-062 | 廚房顯示系統 KDS（依等待時間排序、等待時間、一鍵推進） | P0 | 部分 | RK | RK 為 localStorage 版，每 2 秒輪詢 |
| FR-063 | 菜單管理：新增／編輯／刪除品項、上下架 | P0 | 部分 | RK、PS | RK：新增＋上下架；PS：完整 CRUD；SD 後端只有 GET |
| FR-064 | 分類與客製化群組管理 | P1 | 未實作 | — | 目前只能改 seed |
| FR-065 | 品項成本、庫存、低庫存警示 | P1 | 部分 | PS | |
| FR-066 | 營收報表（日／週／月、熱銷排行、付款方式分佈、毛利） | P0 | 部分 | PS、PM | PS 為 UI 內計算；PM `report.ts` 為可測純函式 |
| FR-067 | 員工帳號、角色（店長／收銀／內場）與登入 | P0 | 部分 | PS | PS 密碼以明碼存在 localStorage，不可沿用 |
| FR-068 | 員工打卡 | P2 | 部分 | PS | |
| FR-069 | 店家設定（店名、地址、收據頁尾、點數規則） | P1 | 部分 | PS | |
| FR-070 | 規則式經營提醒（低毛利、缺貨、銷售下滑） | P2 | 部分 | PS | README 稱「AI 助理」，程式為固定規則，無 AI |
| FR-071 | 多門市彙總 | P2 | 未實作 | — | PM 的 `multiStore.test.ts` 只測試檔內自定義函式，無產品程式 |
| FR-072 | 資料備份匯出／匯入（JSON） | P2 | 部分 | PM | 為本機 Dexie 快照 |

### 6.5 法規與外部整合

| FR | 名稱 | 優先 | 狀態 | 所在 | 備註 |
|---|---|---|---|---|---|
| FR-080 | 付款抽象層（PaymentProvider）＋Mock／測試模式 | P0 | 未實作 | — | M1 只做 mock |
| FR-081 | 真實金流串接（信用卡、行動支付） | P0 | 未實作 | — | M2；廠商選擇**待 Sean 決定** |
| FR-082 | 電子發票抽象層（InvoiceProvider）＋Mock：開立、作廢、折讓、載具／統編／捐贈碼 | P0 | 未實作 | — | M1 只做 mock |
| FR-083 | 真實電子發票開立與上傳 | P0 | 未實作 | — | M2；串接方式**待 Sean 決定** |
| FR-084 | 印表機抽象層（瀏覽器列印＋ESC/POS mock） | P0 | 未實作 | — | M1 mock，M2 實機 |
| FR-085 | 真實簡訊 OTP | P1 | 未實作 | — | 介面已預留 |
| FR-086 | 外送平台串接 | P2 | 未實作 | — | |

---

## 7. 非功能需求

| 類別 | 需求 | 驗證方式 |
|---|---|---|
| 正確性 | 所有金額（小計、加價、折扣、稅、點數）只在後端計算，前端傳入的價格與名稱不可信 | 後端單元＋API 測試 |
| 安全 | 後台、KDS、POS、會員 API 皆需 JWT；員工密碼以 bcrypt 雜湊；JWT_SECRET 只從環境變數注入 | API 測試驗證無 token 回 401 |
| 效能 | KIOSK 單店尖峰下單 API p95 < 500ms（目標值，待實測） | M2 壓測 |
| 即時性 | 狀態推進後手機端 2 秒內收到事件（目標值，待實測） | E2E |
| 可用性 | WebSocket 斷線時自動退回輪詢；後端無法連線時 KIOSK 顯示維護訊息 | E2E |
| 裝置 | KIOSK 1024×768、手機 375×812、櫃台 POS 1280×800 以上 | Playwright viewport 測試 |
| 資料庫 | dev 用 SQLite；正式環境用 PostgreSQL（目前 schema provider 寫死 `sqlite`，切換需改 schema） | M2 |
| 可測性 | 新功能需附單元或整合測試；測試不得為通過而刪改斷言 | CI |
| 可部署 | 後端需長連線環境（Socket.IO），不可部署到 serverless | 部署文件 |

## 8. 資料與個資處理（會員資料）

**蒐集的個資**：會員手機號碼（帳號）、選填姓名、點數、等級、消費紀錄；員工帳號與姓名。依《個人資料保護法》，手機號碼可識別特定個人，屬個資。

| 原則 | 要求 |
|---|---|
| 告知與同意 | 首次登入時顯示蒐集目的、類別、利用期間與方式，並取得同意；同意紀錄需留存（法遵細節**待確認**） |
| 最小蒐集 | 只要求手機號碼；姓名、生日等為選填 |
| 顯示遮罩 | KIOSK、KDS、POS 畫面上的手機號碼一律遮罩（例：`09XX-XXX-123` 格式，只顯示末 3 碼） |
| 存取控制 | 會員 API 只允許本人（會員 JWT）或具權限的員工存取 |
| 當事人權利 | 提供查詢、匯出、刪除（或匿名化）會員資料的功能（FR-027）；訂單財務紀錄依稅法保存，與會員身分脫鉤 |
| 保存期限 | 會員停用後的保存期間**待確認**（需法務意見） |
| 開發資料 | repo 內只能使用明顯虛構的資料；不得放真實顧客、員工或店家資料 |
| 外部傳輸 | 簡訊、金流、發票供應商只傳必要欄位；與供應商的資料處理約定**待確認** |

**目前 repo 內的資料狀況**（盤點結果，未複製內容）：
- `smart-dining/backend/src/seed.ts`、`README.md`、`AGENTS.md`（舊版）、`backend/scripts/test-api.sh`、測試檔使用常見的示範手機號碼；格式與真實號碼相同，M1 應改為更明顯的假資料並集中在 seed。
- 併入 repo `pos-system/src/lib/demo-data.ts` 含多筆姓名＋真實格式手機號碼，以及明碼員工密碼；看起來是示範資料，但**需 Sean 確認非真實個資**，且不得搬入主 repo。

## 9. 法規與風險

### 9.1 電子發票

- 台灣營業人銷售時須依規定開立統一發票，多數情況採電子發票，需透過財政部電子發票整合服務平台上傳（自行串接或透過加值服務中心）。具體適用條件、上傳時限與格式**以財政部最新規定為準（待確認）**。
- 產品需支援：B2C（含手機條碼載具、捐贈碼）、B2B（買方統一編號）、作廢、折讓、字軌與號碼管理、離線補開。
- 本專案**自行實作上傳**或**透過加值服務中心**，**待 Sean 決定**；這也決定專案建置的報價與合約責任。
- M1 只建立 InvoiceProvider 介面與 Mock，產生明顯標示「測試」的假號碼，不連線任何正式或測試平台。

### 9.2 金流

- 信用卡與行動支付需與收單機構或第三方支付簽約，商家資格審核與手續費**待確認**。
- 系統不可儲存卡號等敏感支付資料；卡片資料只由支付供應商處理，以降低 PCI DSS 範圍（適用細節**待確認**）。
- 儲值卡（FR-026）可能涉及預收款或電子票證相關規範，上線前須法務確認，M1 不做。
- M1 只建立 PaymentProvider 介面與 Mock（現金、模擬刷卡成功／失敗、模擬行動支付），不放任何金鑰。

### 9.3 風險表

| 風險 | 影響 | 對策 |
|---|---|---|
| iCHEF 等競品成熟 | 新客獲取困難、價格壓力 | 先鎖定特定區域或業態做訪談驗證；差異化**待驗證** |
| 電子發票／金流法規門檻 | 無法正式營業使用 | M1 先做抽象層與 mock；M2 選定供應商與申辦流程 |
| 硬體相容（印表機、錢櫃、掃碼槍、平板） | 現場導入失敗 | M1 定義 adapter 與相容性清單；M2 實機驗證 |
| 四個 repo 技術棧不同（Next.js 16/React 19 vs Vite/React 18） | 合併工時高 | 只搬邏輯與畫面行為，統一改寫進主 repo 架構，不整包搬 |
| 授權缺口（§5.2-4） | 資料外洩、點數被濫用 | M1 補 JWT 與角色 |
| 個資外洩 | 法律責任、信任受損 | §8 措施；正式上線前做安全檢查 |
| 測試薄弱（主 repo 僅 11 個 case） | 合併後退化 | M1 建立 API 整合測試與 E2E |

---

## 10. 里程碑

### M1 — 合併與可驗證骨架（mock 模式）

把三個要併入的 repo 的必要功能搬進主 repo，修正 §5.2 缺陷，補齊測試；金流、電子發票、硬體一律以 mock 介面完成。詳細驗收見 `GOAL.md`。

### M2 — 正式串接與實機（上市候選）

- 選定並串接一家金流供應商（測試環境→正式）、電子發票（自建或加值中心）。
- 熱感印表機、錢櫃、掃碼槍、KIOSK 平板實機相容性驗證。
- PostgreSQL 正式環境、備份、監控；真實簡訊 OTP。
- 個資告知同意流程與當事人權利功能（FR-027）上線。
- 1～3 家試點門市（招募方式**待 Sean 決定**）。

### M3 — 商業化

- SaaS 訂閱計費與方案、專案建置流程與報價。
- 多門市彙總（FR-071）、交班（若未於 M2 完成）、離線收銀（FR-048）。
- 依試點回饋調整定價與功能；外送串接（FR-086）視需求評估。

## 11. 成功指標

| 指標 | 目標 | 來源／狀態 |
|---|---|---|
| M1：主 repo P0 FR 狀態 | 所有 P0 FR 為「已實作（mock 模式）」或明確列為 M2 | 本文件 |
| M1：自動化測試 | 後端 API 整合測試＋E2E 主流程皆在 CI 綠燈 | `GOAL.md` |
| KIOSK 自助點餐完成率 | > 90% | 沿用舊版文件目標，**未驗證** |
| 平均點餐時間 | < 2 分鐘 | 沿用舊版文件目標，**未驗證** |
| 客製化加購率 | ≥ 15% | 沿用舊版文件目標，**未驗證** |
| 會員回購率 | ≥ 20% | 沿用舊版文件目標，**未驗證** |
| 試點門市數、付費門市數、MRR | — | **待 Sean 決定** |

### 11.1 附註：舊版文件與程式不一致處

| 舊文件說法 | 程式實況 |
|---|---|
| v3.0.2 SPEC：FR-001～FR-006 全部「✅ shipped」 | 計價、優惠券、後台清單、授權皆有缺陷（§5.2） |
| v3.0.2 SPEC：E2E 腳本含 `e2e.mjs` | 該檔不存在；backend `test:e2e` 會失敗 |
| README：「JWT + bcrypt」 | bcrypt 有安裝但沒有任何程式使用 |
| 舊 AGENTS.md：「DB schema 單一來源在 shared-contracts」 | 實際由 `backend/prisma/schema.prisma` 驅動，兩份重複 |
| 舊 AGENTS.md：「CI 尚未配置」 | 已有 `.github/workflows/ci.yml`（lint 步驟不擋錯） |
| pos-system README：「AI 助理」 | 固定規則計算，無 AI 模型 |
| pos-system README：「收據格式」 | 只有收據頁尾設定欄位，沒有收據列印 |
| restaurant-kiosk GOAL：品項編輯／刪除、類別管理、店家設定 | 只有新增與上下架；無類別管理與設定頁 |
| restaurant-kiosk：「滿 NT$1000 升級 VIP 享 9 折」 | 購物車頁只要電話長度 ≥ 8 就打 9 折 |
| pos-multitrade STATUS：測試通過 | 23 個 DB 測試以 `describe.skip` 跳過；`offline.test.ts`、`multiStore.test.ts` 未測試產品程式 |

---

## 12. 合併清單

原則：主 repo 架構（Fastify＋Prisma 後端、Vite React 前端、shared-contracts）不變；併入 repo 只搬「邏輯與畫面行為」，改寫為主 repo 的 API＋前端，不整包複製、不搬其本機儲存層（localStorage／Dexie）。主 repo 已有的功能不重複列。

### 12.1 要搬進主 repo

| # | 功能／模組 | 來源檔案 | 搬到主 repo 的形式 | 對應 FR |
|---|---|---|---|---|
| 1 | 客製化加價計算 | `restaurant-kiosk/web/src/lib/helpers.ts`（`computeLinePrice`、`computeCartTotal`） | 改寫為 backend 純函式，`POST /api/orders` 改用伺服器端計價 | FR-002 |
| 2 | KDS 廚房顯示 | `restaurant-kiosk/web/src/pages/KdsPage.tsx`、`web/tests/e2e.test.tsx`（KDS 測試案例） | kiosk-frontend 新增 KDS 畫面，接後端 `GET /api/admin/orders`＋Socket 事件；測試案例改寫 | FR-061、FR-062 |
| 3 | 品項新增與上下架 | `restaurant-kiosk/web/src/pages/AdminItemsPage.tsx` | 後台菜單管理 UI＋後端 menu 寫入 API | FR-063 |
| 4 | 品項 CRUD、成本、庫存、低庫存 | `pos-system/src/components/views/InventoryView.tsx`、`src/lib/store.ts`（product actions） | 併入同一個菜單管理模組；Prisma MenuItem 增加成本／庫存欄位 | FR-063、FR-065 |
| 5 | 櫃台收銀畫面 | `pos-system/src/components/views/RegisterView.tsx`、`store.ts`（`checkout`） | 新增 POS 收銀畫面，訂單寫入同一個 Order 模型（標記來源 channel） | FR-040、FR-041、FR-042、FR-043 |
| 6 | 作廢／退款 | `pos-system/src/lib/store.ts`（`voidTransaction`、`refundTransaction`）、`TransactionsView.tsx` | 後端退款／作廢 API（含原因、狀態紀錄、點數回沖、發票作廢 mock） | FR-044、FR-045 |
| 7 | 營業稅設定與店家設定 | `pos-system/src/lib/types.ts`（`AppSettings`）、`SettingsView.tsx` | Prisma 新增店家設定；稅額由後端計算 | FR-046、FR-069 |
| 8 | 營收報表 | `pos-multitrade/src/lib/report.ts`＋`report.test.ts`；`pos-system/src/components/views/AnalyticsView.tsx` | 後端報表 API（日／週／月營收、熱銷、付款方式分佈），沿用 PM 測試案例 | FR-066 |
| 9 | 金額驗證規則 | `pos-multitrade/src/lib/pricing.ts`＋`pricing.test.ts` | 價格與數量驗證（負價、非整數數量）納入後端計價測試 | FR-002、FR-040 |
| 10 | 員工角色與登入 | `pos-system/src/lib/types.ts`（`Staff`、`StaffRole`）、`StaffView.tsx`、`LoginScreen.tsx` | Prisma 新增 Staff；bcrypt 雜湊密碼＋JWT 角色；**不搬明碼密碼與示範資料** | FR-067 |
| 11 | 會員等級規則與後台會員列表 | `pos-system/src/lib/utils.ts`（`calcTier`）、`MembersView.tsx` | 後端升等邏輯＋後台會員列表（手機號碼遮罩） | FR-024、FR-025 |
| 12 | 付款方式列舉 | `pos-system/src/lib/types.ts`、`pos-multitrade/src/types/index.ts`（`PaymentMethod`） | 統一放入 shared-contracts，作為 PaymentProvider mock 的選項 | FR-043、FR-080 |
| 13 | Playwright E2E 設定模式 | `pos-multitrade/playwright.config.ts`、`e2e/*.spec.ts` | 參考其設定在主 repo 建立 E2E（不搬測試內容） | 測試 |

### 12.2 不搬及原因

| 來源 | 功能 | 不搬原因 |
|---|---|---|
| pos-multitrade | 行業切換（零售／服務業模板）、`templates.ts` | 目標客群只有餐飲 |
| pos-multitrade | 技師抽成 `commission.ts`、`technicianRepo.ts` | 服務業功能，餐飲不需要 |
| pos-multitrade | Dexie／IndexedDB 資料層、JSON 快照 | 主 repo 用伺服器資料庫；離線同步（FR-048）另行設計 |
| pos-multitrade | 繁中／英文切換 | 目標客群為台灣，列 P2 |
| pos-multitrade | `offline.test.ts`、`multiStore.test.ts` | 未測試產品程式，搬過來沒有驗證價值 |
| pos-multitrade | `@supabase/supabase-js` 依賴、`prototype/`、`DISCOVERY/` | 程式未使用 Supabase；原型與探索文件不屬產品程式；DISCOVERY 數字未經查證 |
| pos-system | zustand＋localStorage 資料層 | 主 repo 已有後端與資料庫 |
| pos-system | 示範資料 `demo-data.ts`（姓名、手機、明碼密碼） | 個資疑慮與安全問題 |
| pos-system | 儲值卡餘額 `topUpMember` | 預收款法規待確認（FR-026） |
| pos-system | 「AI 助理」規則提醒 | P2，M1 不做 |
| pos-system | 打卡 | P2，M1 不做 |
| pos-system | `Shift` 型別 | 只有型別沒有功能，交班於 M3 重新設計 |
| restaurant-kiosk | 顧客菜單／購物車／訂單狀態頁 | 主 repo 已有更完整版本 |
| restaurant-kiosk | 只輸入電話即登入、依電話長度給 VIP 9 折 | 主 repo 已有 OTP 登入；VIP 判斷是錯誤邏輯 |
| restaurant-kiosk | 中文 4 段狀態機（已接單→製作中→可取餐→已取餐） | 主 repo 已有 7 段狀態機 |
| 全部 | 各 repo 的 `dashboard.html`、Vercel／GitHub Pages 部署設定 | 與主 repo 部署方式不同 |

### 12.3 合併後的併入 repo 處置

合併完成並經 Sean 驗收後，三個併入 repo 是否封存，**由 Sean 決定**；本專案流程不會封存、刪除或改名任何 repo。
