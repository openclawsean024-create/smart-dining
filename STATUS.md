# STATUS — 餐飲自助點餐 KIOSK＋POS（smart-dining）

- 狀態：🟡 **M1 第一階段開發中**（AC-001、011、002、003、004、005；其餘 AC 留待下一階段）
- 分支：`feat/m1-a`（自 `chore/prd-rebuild` 開出；未合併、未部署）
- 盤點基準：`main` @ `08b3e6d`（2026-09-06）

## M1 第一階段進度（feat/m1-a）

| AC | 內容 | 狀態 | 測試（名稱皆標 AC 編號） |
|---|---|---|---|
| AC-001 | 基線與 CI 擋錯 | ✅ 完成（2026-11-16） | `backend/src/test/__tests__/baseline.ac001.test.ts`（13 個 case）；`npm run test:api`、`npm run test:e2e` |
| AC-011 | 員工角色與 API 授權 | ✅ 完成（2026-11-16） | `backend/src/modules/__tests__/authz.ac011.test.ts`（59 個 case）；`kiosk-frontend/src/components/staff/__tests__/RequireStaff.ac011.test.tsx`（7 個 case） |
| AC-002 | 伺服器端計價、券碼以 DB 為準 | ⏳ 未開始 | — |
| AC-003 | 訂單號／取餐號依台灣時區 | ⏳ 未開始 | — |
| AC-004 | 後台訂單清單與 KDS | ⏳ 未開始 | — |
| AC-005 | 菜單管理 | ⏳ 未開始 | — |

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
| FR-002 | 品項客製化與加價 | P0 | 部分（後端未計加價） | SD、RK |
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
| FR-022 | 優惠券 | P0 | 部分（KIOSK 券碼與 DB 不一致） | SD |
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
| FR-060 | 訂單推進＋廣播 | P0 | 已實作（無授權） | SD |
| FR-061 | 後台訂單清單 | P0 | 部分（後端 API 缺） | SD |
| FR-062 | KDS | P0 | 部分 | RK |
| FR-063 | 菜單管理 | P0 | 部分 | RK、PS |
| FR-064 | 分類與客製化群組管理 | P1 | 未實作 | — |
| FR-065 | 成本／庫存／低庫存 | P1 | 部分 | PS |
| FR-066 | 營收報表 | P0 | 部分 | PS、PM |
| FR-067 | 員工角色與登入 | P0 | 部分（明碼密碼，不可沿用） | PS |
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
