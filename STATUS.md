# STATUS — 餐飲自助點餐 KIOSK＋POS（smart-dining）

- 狀態：🟢 **M1 第一階段完成，待 Sean 審查**（AC-001、011、002、003、004、005 皆有通過的測試；AC-006～AC-010、AC-012～AC-014 留待下一階段）
- 分支：`feat/m1-a`（自 `chore/prd-rebuild` 開出；未合併、未部署）
- 盤點基準：`main` @ `08b3e6d`（2026-09-06）

## M1 第一階段進度（feat/m1-a）

| AC | 內容 | 狀態 | 測試（名稱皆標 AC 編號） |
|---|---|---|---|
| AC-001 | 基線與 CI 擋錯 | ✅ 完成（2026-11-16） | `backend/src/test/__tests__/baseline.ac001.test.ts`（13 個 case）；`npm run test:api`、`npm run test:e2e` |
| AC-011 | 員工角色與 API 授權 | ✅ 完成（2026-11-16） | `backend/src/modules/__tests__/authz.ac011.test.ts`（59 個 case）；`kiosk-frontend/src/components/staff/__tests__/RequireStaff.ac011.test.tsx`（7 個 case） |
| AC-002 | 伺服器端計價、券碼以 DB 為準 | ✅ 完成（2026-11-16） | `backend/src/lib/pricing.ac002.test.ts`（35 個 case）；`backend/src/modules/orders.pricing.ac002.test.ts`（24 個 case）；`kiosk-frontend/src/pages/__tests__/CheckoutPage.ac002.test.tsx`（7 個 case） |
| AC-003 | 訂單號／取餐號依台灣時區 | ✅ 完成（2026-11-16） | `backend/src/lib/taipeiTime.ac003.test.ts`（5 個 case）；`backend/src/modules/orders.taipei.ac003.test.ts`（4 個 case，fake timers） |
| AC-004 | 後台訂單清單與 KDS | ✅ 完成（2026-11-16） | `backend/src/modules/admin.orders.ac004.test.ts`（13 個 case）；`kiosk-frontend/src/pages/admin/__tests__/KdsPage.ac004.test.tsx`（20 個 case，含 restaurant-kiosk 的 6 個 KDS 情境）；Playwright `e2e/kds-flow.ac004.spec.ts`（2 個 case） |
| AC-005 | 菜單管理 | ✅ 完成（2026-11-16） | `backend/src/modules/menu.admin.ac005.test.ts`（29 個 case）；`kiosk-frontend/src/pages/admin/__tests__/MenuAdminPage.ac005.test.tsx`（12 個 case）；Playwright `e2e/menu-admin.ac005.spec.ts`（2 個 case） |

### SOP 檢查結果（2026-11-16，本機 Node v26.13.1／npm 11.20.0，`feat/m1-a`）

| 指令 | 結果 |
|---|---|
| `npm ci` | exit 0（673 個套件） |
| `npm run build` | exit 0（contracts → backend → kiosk → mobile） |
| `npm test` | exit 0：backend 10 檔 188 個 case、kiosk 4 檔 47 個 case 全數通過（Node 26 與 Node 20 皆實跑） |
| `cd backend && npx tsc --noEmit` | exit 0 |
| `npm run lint -w @smart-dining/kiosk` | exit 0 |
| `npm run typecheck -w @smart-dining/mobile` | exit 0 |
| `cd backend && npm run test:api` | exit 0，22 個請求皆符合預期狀態碼（`API SMOKE TEST PASSED`） |
| `cd backend && npm run test:e2e` | exit 0（`E2E TEST PASSED`） |
| `npm run test:e2e`（Playwright） | exit 0，4 個 case 通過 |
| `cd backend && npx vitest run src/**/pricing*.test.ts src/**/orders*.test.ts`（GOAL AC-002） | exit 0，3 檔 63 個 case |
| `git grep -n "password: '"` | 只出現在文件中描述此檢查的文字 |
| `git grep -n -E "09[0-9]{2}-?[0-9]{3}-?[0-9]{3}"`（排除 0900-000-xxx） | 無結果 |

CI 首次執行（PR #3）`test` job 失敗，已修正：
- KIOSK 元件測試在 Node 20 無法啟動：新裝的 jsdom 最新版要求 Node 22 以上 → 改為根目錄 devDependency `jsdom@^26`（支援 Node 18+）。本機以 Node v20.20.2 實跑 kiosk 47、backend 188 個 case 皆通過。
- 並行下單在 CI 回 500（SQLite 寫入交易互搶鎖逾時）：建單交易改在 backend 內依序執行（`backend/src/lib/serialQueue.ts`，前提是單一行程部署），斷言未修改；新增 `serialQueue.ac003.test.ts`。

GitHub Actions（PR #3，Node 20，commit `a5667c0`，run 43758097646）：Lint & Typecheck ✅、Unit & Integration Tests ✅、Build ✅、E2E（API smoke＋WebSocket＋Playwright）✅；Deploy 依設計只在 main push 時執行，PR 上為 skipped。

已知但不在本階段處理：`npm ci` 回報 27 個相依套件弱點（npm audit；多為既有依賴）。

### AC-001 完成內容

- `backend` 的 `test:e2e` 改指到存在的腳本：`scripts/with-test-server.mjs`（建立暫存 SQLite、seed、在空閒埠啟動 backend）＋根目錄 `scripts/e2e-test.mjs`；斷言改用 `node:assert`，失敗即非 0 結束（原本用 `console.assert`，失敗也會印 PASSED）。
- `backend/scripts/test-api.sh` 改寫：每個請求比對 HTTP 狀態碼，404／500／連不上皆以非 0 結束；`test:api` 同樣透過 `with-test-server.mjs` 自帶測試 backend。
- CI：`lint`／`test`／`build` 移除 `continue-on-error` 與 `npm ci ... || npm install` fallback；新增 `e2e` job 跑 `test:api`、`test:e2e`。deploy 步驟未更動。
- `fastify-plugin` 列入 `backend/package.json`；backend 新增 `typecheck` script。
- 建立後端整合測試基礎：vitest `globalSetup` 以 `prisma db push` 建 SQLite 範本，`createTestApp()` 每個測試複製一份（`buildApp({ databaseUrl })`）。
- 示範資料改為明顯假資料：手機 `0900000001`／`0900000002`（0900-000-xxx），姓名「測試會員甲／乙」；seed 抽成 `backend/src/seedData.ts` 供測試共用。

### AC-011 完成內容

- 新增 `Staff` 模型（`MANAGER` 店長／`CASHIER` 收銀／`KITCHEN` 內場），密碼只存 bcrypt 雜湊；`POST /api/staff/login`、`GET /api/staff/me`。連續失敗 5 次暫時鎖定（429）；超過 bcrypt 72 bytes 上限的密碼直接拒絕。
- JWT 分會員／員工兩種（`kind`）；無 token 401、身分或角色不符 403。員工 token 每次請求都會查帳號是否仍啟用，角色以資料庫為準。
- 權限表：

  | API | 允許 |
  |---|---|
  | `GET /api/members/:id`、`/coupons`、`GET /api/orders/member/:memberId` | 本人會員、店長 |
  | `POST /api/members/:id/points/add` | 只有店長（會員本人也不行）；寫 PointsTransaction，點數不可為負 |
  | `POST /api/admin/orders/:orderNo/advance` | 店長、內場 |
  | `PATCH /api/orders/:orderNo/status` | 店長：全部；內場：QUEUED～READY；收銀：COMPLETED／CANCELLED |
  | `POST /api/orders` | 公開；但 `memberId` 只認會員 JWT（body 自填他人 ID → 401／403），綁定會員的優惠券只能本人使用 |
  | `GET /api/orders/:orderNo`、`GET /api/menu`、Socket `/tracking` | 公開（顧客追蹤用） |

- 沒有任何明碼預設密碼：seed 的示範員工（`manager01`／`cashier01`／`kitchen01`）密碼來自環境變數 `SEED_STAFF_PASSWORD`，未設定時每次隨機產生並只在終端機顯示一次；測試與腳本的密碼皆執行時隨機產生。測試會掃描原始碼確認沒有 `password: '...'`、`admin/admin`。
- KIOSK 前端：`/admin` 需員工登入（`RequireStaff`＋`StaffLoginForm`，token 放 sessionStorage），API client 區分會員／員工 token；下單改帶會員 JWT。
- 尚未處理（不在本階段）：`DevOTPProvider` 的固定示範驗證碼仍是 dev 預設（真實簡訊 OTP 為 FR-085／M2）；正式環境上線前必須換掉，否則會員 JWT 可被任意取得。

### AC-002 完成內容

- `backend/src/lib/pricing.ts`（純函式）：單價＝`basePrice`＋所選 `priceDelta` 加總；品名與客製化名稱取自資料庫。改寫自 `restaurant-kiosk` 的 `computeLinePrice`／`computeCartTotal`（合併清單 #1）與 `pos-multitrade` `pricing.ts` 的驗證規則（#9）。
- `POST /api/orders` 只採用品項 ID、數量、選項 ID；前端多送的 `unitPrice`／`name`／金額一律忽略。以下皆回 400（附 `code`）：空購物車、非 1～99 正整數數量、負價、品項不存在或已下架、選項不存在／不屬於該品項／已停用、單選群組多選、缺必選群組。
- 優惠券以資料庫為準：KIOSK 移除寫死的 `WELCOME10`／`SAVE50`，改由 `GET /api/members/:id/coupons` 取得（seed 為 `VIP10`、`WELCOME`）。不存在、已使用、過期或不屬於本人 → 400 `COUPON_INVALID`；計價失敗時不會把券標成已使用；並行下單不會重複使用同一張券。折扣取整數（百分比券四捨五入）。
- KIOSK：結帳只送 ID 與數量，畫面金額標示為試算；客製化面板在必選群組沒選完前不能加入購物車；下單錯誤依 `code` 顯示中文說明。
- GOAL 的驗證指令 `cd backend && npx vitest run src/**/pricing*.test.ts src/**/orders*.test.ts` 在 bash 與 zsh 皆可執行（2 檔 59 個 case）。

### AC-003 完成內容

- `backend/src/lib/taipeiTime.ts`：以 `Asia/Taipei` 計算當日日期與 00:00～隔日 00:00 的範圍；每次下單即時計算，不再於模組載入時固定「今天」。
- 訂單號 `SD-YYYYMMDD-NNNN` 的日期改為台灣日期，流水號取同一台灣日既有訂單號最大值＋1；取餐號取同一台灣日最大值＋1。兩者與 `createdAt` 使用同一個時間點，在同一個交易內產生；訂單號撞號（P2002）時整筆交易重試。
- 測試以 fake timers 驗證：台灣 23:59 → 00:01 不重啟即從 0001／取餐號 1 開始；台灣 07:59（UTC 仍是前一天）使用台灣日期；UTC 換日時不重置；並行 8 筆不重號。
- 實測（2026-11-16 台灣時間凌晨）：`npm run test:e2e` 建立的訂單號為 `SD-20261116-0002`（修正前同一時段為 `SD-20261115-xxxx`）。
- seed 的示範訂單與 `backend/scripts/ws-test.mjs` 的預設訂單號也改用台灣日期。

### AC-004 完成內容

- `GET /api/admin/orders`（任何員工角色）：只回傳進行中訂單（QUEUED～READY），依建立時間由舊到新；每筆含取餐號、品項、客製化（已解析成陣列）、品項摘要，另回 `serverTime`。回應不含會員手機。
- 訂單 API 的 `items[].customizations` 一律輸出為陣列（原本是 JSON 字串，手機明細頁無法顯示），並以契約名稱 `statusLog` 提供狀態紀錄。
- 修正 `GET /api/menu` 回應欄位：依契約改為 `categories[].items`（原本是 Prisma 的 `menuItems`，KIOSK 首頁因此顯示不出任何品項；E2E 測試發現）。
- 新增 Socket.IO `/kds` namespace（握手需員工 JWT，停用帳號連不上）：訂單建立或狀態變更時送 `kds:orderChanged`。手機端 `/tracking` 事件不變。
- KIOSK 新增 `/admin/kds`（改寫自 restaurant-kiosk `KdsPage.tsx`）：取餐號大字、品項與客製化、等待時間（以伺服器時間計算，超過 10 分鐘警示色）、一鍵推進；內場／店長可推進製作階段，收銀／店長可在「可取餐」按完成取餐（與後端角色限制一致）；`/kds` 通知即時更新＋每 10 秒輪詢備援；失敗時顯示錯誤，不再顯示假資料。舊的 `AdminPanel`（含 DEMO 假訂單與失敗時樂觀更新）移除，`/admin` 導向 KDS。
- restaurant-kiosk `web/tests/e2e.test.tsx` 的 6 個 KDS 情境（nav、空狀態、有單不顯示空狀態、顯示單號、依等待時間排序、推進按鈕）改寫為元件測試，全數保留。
- Playwright（設定模式參考 pos-multitrade）：`npm run test:e2e` 自動啟動 backend（暫存 SQLite＋seed，埠 4100）、KIOSK（5273）、手機（5274），員工密碼與 JWT secret 每次隨機產生。主流程「KIOSK 下單 → KDS 推進到 READY → 手機追蹤頁顯示可取餐」：手機頁不重新整理，靠 Socket 事件由 10% 更新到 100%。已加入 CI `e2e` job。Vite 預先打包依賴，避免冷啟動時頁面重新載入造成不穩定（本機連跑 8 次與清快取冷跑皆通過）。

### AC-005 完成內容

- Prisma `MenuItem` 新增 `sku`、`cost`、`stock`（null＝不追蹤）、`reorderLevel`、`deletedAt`（軟刪除）；兩份 schema 同步修改。
- 店長專用 API：`GET／POST /api/admin/menu/items`、`PATCH／DELETE /api/admin/menu/items/:id`（新增、編輯、上下架、軟刪除）；zod 驗證（售價／成本不可負、庫存為非負整數、分類必須存在、未知欄位拒絕），SKU 在未刪除品項間不可重複（409）。其他角色 403、無 token 401。
- `GET /api/menu` 只回傳上架、未刪除、庫存不為 0 的品項，且不輸出成本、庫存、SKU。
- 下單：下架或已刪除 → 400 `ITEM_UNAVAILABLE`；庫存為 0 或不足（同品項多行合計）→ 400 `ITEM_OUT_OF_STOCK`。有追蹤庫存的品項下單時以條件更新扣庫存，並行下單不會扣成負數；賣完即從 KIOSK 菜單消失。
- KIOSK 後台 `/admin/menu`（只有店長；導覽列只對店長顯示）：改寫自 restaurant-kiosk `AdminItemsPage`（新增、上下架）與 pos-system `InventoryView`（編輯、刪除確認、成本、毛利率、庫存、低庫存警示與「只看低庫存」篩選、名稱／SKU 搜尋）；不搬 pos-system 的 localStorage 與示範資料。
- 順帶修正：KIOSK 側欄「飲品」對應的分類 ID 寫成 `cat-drinks`（seed 為 `cat-drink`），導致飲品分類顯示全部品項。
- seed 的示範成本為售價的 40%，庫存預設不追蹤。
- 尚未做（不在本階段）：分類與客製化群組的管理（FR-064，P1）。

## Notion 商品資料庫對應

| Notion「可產品化商品」欄位 | 值 | 本 repo 對應 |
|---|---|---|
| 產品名稱 | 餐飲自助點餐 KIOSK＋POS | 本 repo（舊名「餐飲點餐快手 / Smart Dining」） |
| 優先順序 | P2 | — |
| 開發順位 | 第 6 個 | — |
| 主 repo | openclawsean024-create/smart-dining | 本 repo |
| 要併入的 repo | pos-multitrade、pos-system、restaurant-kiosk | SPEC §12 合併清單 |
| 現況完成度 | 55 | 見下方 FR 對照（本次未重新估算百分比） |
| 獲利模式 | SaaS 訂閱、專案建置 | SPEC §3 |
| 上市前要補 | 合併四個 repo、補測試、電子發票與金流串接、硬體相容 | M1：合併、補測試、金流／發票／印表機 mock（GOAL AC-001～AC-014）；M2：真實串接與實機 |
| 主要風險 | iCHEF 等競品成熟；電子發票與金流法規門檻 | SPEC §9 |

## 驗證現況（PRD 重建時的基準，2026-11-16；最新結果見上方進度表與 SOP.md）

| 指令 | 結果 |
|---|---|
| `npm ci` | exit 0 |
| `npm run build` | exit 0 |
| `npm test` | exit 0（backend 1 檔 11 個 case） |
| `cd backend && npx tsc --noEmit` | exit 0 |
| `npm run lint -w @smart-dining/kiosk` | exit 0（僅 tsc） |
| `npm run typecheck -w @smart-dining/mobile` | exit 0 |
| `node scripts/e2e-test.mjs`（backend 啟動後） | 通過 |
| `cd backend && npm run test:api` | exit 0，但多數回應為 404／500，結果不可信 |
| `cd backend && npm run test:e2e` | 失敗：腳本檔不存在 |

## FR 對照

狀態以程式碼為準。所在：SD＝smart-dining、PS＝pos-system、PM＝pos-multitrade、RK＝restaurant-kiosk。

| FR | 名稱 | 優先 | 狀態 | 所在 |
|---|---|---|---|---|
| FR-001 | KIOSK 菜單瀏覽 | P0 | 已實作 | SD |
| FR-002 | 品項客製化與加價 | P0 | 已實作（AC-002：後端計入加價） | SD |
| FR-003 | 購物車 | P0 | 已實作 | SD |
| FR-004 | KIOSK 結帳取號＋QR | P0 | 已實作 | SD |
| FR-005 | 列印取餐單 | P0 | 部分（僅瀏覽器列印） | SD |
| FR-006 | 手機追蹤 | P0 | 已實作 | SD |
| FR-007 | 即時推播＋輪詢備援 | P0 | 已實作 | SD |
| FR-008 | READY 震動 | P1 | 已實作 | SD |
| FR-009 | PWA | P1 | 已實作 | SD |
| FR-010 | 多語系 | P2 | 部分 | PM |
| FR-020 | OTP 登入 | P0 | 部分（無真實簡訊） | SD |
| FR-021 | 點數累積 | P0 | 部分 | SD、PS |
| FR-022 | 優惠券 | P0 | 已實作（AC-002：KIOSK 改用後端可用券） | SD |
| FR-023 | 會員中心 | P1 | 已實作 | SD |
| FR-024 | 會員等級升等 | P1 | 部分 | PS、SD |
| FR-025 | 後台會員列表 | P1 | 部分 | PS |
| FR-026 | 儲值卡 | P2 | 部分（法規待確認） | PS |
| FR-027 | 會員個資查詢／匯出／刪除 | P0 | 未實作 | — |
| FR-040 | 櫃台收銀畫面 | P0 | 部分（未接後端） | PS、PM |
| FR-041 | 條碼／SKU 輸入 | P1 | 部分 | PS |
| FR-042 | 整單折扣 | P1 | 部分 | PS |
| FR-043 | 付款方式與找零 | P0 | 部分 | PS、PM |
| FR-044 | 作廢／退款 | P0 | 部分 | PS |
| FR-045 | 交易紀錄 | P0 | 部分 | PS、PM |
| FR-046 | 營業稅設定 | P0 | 部分 | PS |
| FR-047 | 交班／開關帳 | P1 | 未實作 | — |
| FR-048 | 離線收銀同步 | P1 | 未實作 | — |
| FR-060 | 訂單推進＋廣播 | P0 | 已實作（AC-011：需員工 JWT） | SD |
| FR-061 | 後台訂單清單 | P0 | 已實作（AC-004） | SD |
| FR-062 | KDS | P0 | 已實作（AC-004） | SD |
| FR-063 | 菜單管理 | P0 | 已實作（AC-005） | SD |
| FR-064 | 分類與客製化群組管理 | P1 | 未實作 | — |
| FR-065 | 成本／庫存／低庫存 | P1 | 已實作（AC-005） | SD |
| FR-066 | 營收報表 | P0 | 部分 | PS、PM |
| FR-067 | 員工角色與登入 | P0 | 已實作（AC-011：bcrypt＋角色 JWT；員工帳號管理 UI 未做） | SD |
| FR-068 | 打卡 | P2 | 部分 | PS |
| FR-069 | 店家設定 | P1 | 部分 | PS |
| FR-070 | 規則式經營提醒 | P2 | 部分 | PS |
| FR-071 | 多門市彙總 | P2 | 未實作 | — |
| FR-072 | 資料備份匯出 | P2 | 部分 | PM |
| FR-080 | 付款抽象層＋mock | P0 | 未實作 | — |
| FR-081 | 真實金流 | P0 | 未實作 | — |
| FR-082 | 電子發票抽象層＋mock | P0 | 未實作 | — |
| FR-083 | 真實電子發票 | P0 | 未實作 | — |
| FR-084 | 印表機抽象層 | P0 | 未實作 | — |
| FR-085 | 真實簡訊 OTP | P1 | 未實作 | — |
| FR-086 | 外送串接 | P2 | 未實作 | — |

小計：已實作 9、部分 26、未實作 12（共 47 條）。

## 已知問題（摘要，詳見 SPEC §5.2）

- 後端計價忽略客製化加價；後台訂單清單 API 不存在；KIOSK 優惠券寫死。
- admin、訂單狀態、會員 API 無授權。
- 訂單號用 UTC 日期，且每日起點在服務啟動時固定。
- 主 repo 只有 11 個單元測試、無前端測試、無 E2E 框架。

## 待 Sean 決定

1. SaaS 月費定價與專案建置報價方式。
2. 電子發票自行串接平台或透過加值服務中心；金流供應商選擇。
3. M2 試點門市招募方式與數量。
4. 合併完成後三個併入 repo 是否封存。
5. 確認 `pos-system/src/lib/demo-data.ts` 的姓名與手機號碼皆為虛構。
6. `pos-multitrade` 舊規格的「一次性 NT$1,499」定價是否作廢。
