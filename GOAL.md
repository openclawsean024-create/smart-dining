# Goal — 餐飲自助點餐 KIOSK＋POS M1

## Objective

把 `pos-system`、`pos-multitrade`、`restaurant-kiosk` 中需要的功能搬進 `smart-dining`，讓 KIOSK 自助點餐、櫃台 POS 收銀、廚房 KDS、手機取餐追蹤與會員共用同一個後端與訂單模型；修正現有計價、授權與測試缺陷。金流、電子發票、印表機一律以 mock／測試模式完成，並以可重跑的自動化測試證明。範圍依據 `PRD/SPEC.md` §10 M1 與 §12 合併清單。

## Acceptance criteria

- AC-001：基線可重跑。`npm ci`、`npm run build`、`npm test` 在根目錄 exit 0；CI 的 backend `tsc --noEmit`、kiosk `lint`、mobile `typecheck` 移除 `continue-on-error`，且在 PR 上全綠。`backend` 的 `test:e2e` 指到存在的腳本，`fastify-plugin` 列入 `backend/package.json`。
  驗證：`npm ci && npm run build && npm test`；`cd backend && npx tsc --noEmit`；GitHub Actions 該 PR 的 lint／test／build job 皆成功。

- AC-002：伺服器端計價（合併清單 #1、#9）。`POST /api/orders` 只採用前端傳入的品項 ID、數量、選項 ID；單價＝`basePrice`＋所選 `priceDelta` 加總，品項名稱取自資料庫；負價、非正整數數量、不存在或已下架的品項／選項、缺少必選群組皆回 400。KIOSK 結帳頁不再寫死券碼，改用後端可用券。
  驗證：`cd backend && npx vitest run src/**/pricing*.test.ts src/**/orders*.test.ts`（用 Fastify `inject` 對測試用 SQLite），至少涵蓋「帶加價選項的總額」「竄改前端 unitPrice 無效」「缺必選群組 400」「下架品項 400」。

- AC-003：訂單號與取餐號依台灣時區每日重置。日期以 `Asia/Taipei` 計算，跨日不需重啟服務即從 1 開始。
  驗證：vitest 以 fake timers 模擬台灣時間 23:59→00:01 與 07:59（UTC 前一天）建立訂單，斷言訂單號日期與流水號。

- AC-004：後台訂單清單與 KDS（合併清單 #2）。新增 `GET /api/admin/orders` 回傳進行中訂單（依建立時間由舊到新）；kiosk-frontend 新增 KDS 畫面，顯示取餐號、品項與客製化、等待時間，可一鍵推進；推進後 Socket 事件送達手機端。`restaurant-kiosk` 的 6 個 KDS 測試情境改寫後全數保留。
  驗證：backend API 測試（排序、只含進行中狀態）；前端元件測試（空狀態、排序、推進按鈕）；Playwright E2E「KIOSK 下單 → KDS 推進到 READY → 手機追蹤頁顯示可取餐」。

- AC-005：菜單管理（合併清單 #3、#4）。後台可新增、編輯、刪除（軟刪除）、上下架品項，並維護成本與庫存；下架或庫存為 0 的品項不出現在 KIOSK 菜單，下單回 400。
  驗證：backend API 測試（CRUD、上下架後 `GET /api/menu` 結果、下架品項下單 400）；Playwright E2E「後台下架 → KIOSK 菜單不顯示」。

- AC-006：櫃台 POS 收銀（合併清單 #5、#12）。店員收銀畫面可選品項、輸入條碼／SKU（模擬鍵盤式掃碼槍：輸入後按 Enter）、調整數量、整單折扣、選付款方式並計算現金找零；訂單寫入同一個 Order 模型並標記來源（KIOSK／POS），同樣出現在 KDS。
  驗證：前端元件測試（條碼 Enter 加入購物車、找零計算）；backend API 測試（POS 訂單 channel、折扣上限）；Playwright E2E「POS 結帳 → KDS 出現該單」。

- AC-007：作廢與退款（合併清單 #6）。已完成付款的訂單可作廢或退款，必填原因；寫入狀態紀錄、還原庫存、回沖該單贈送的點數（寫 PointsTransaction），並呼叫發票 mock 的作廢／折讓。
  驗證：backend API 測試斷言訂單狀態、庫存、會員點數、PointsTransaction 筆數、mock 發票狀態；重複退款回 409。

- AC-008：金流 mock（FR-080）。建立 `PaymentProvider` 介面與 `MockPaymentProvider`（現金、模擬刷卡成功／失敗、模擬行動支付）；訂單有付款方式與付款狀態，付款失敗時訂單不送 KDS。repo 內不得有任何真實商店代號、金鑰或支付端點。
  驗證：vitest 涵蓋成功、失敗、重試；`git grep -n -i -E "merchant|hash_?key|hash_?iv|sk_live|api[_-]?key" -- backend kiosk-frontend mobile-app shared-contracts` 只出現介面名稱或 mock 常數。

- AC-009：電子發票 mock（FR-082）。建立 `InvoiceProvider` 介面與 `MockInvoiceProvider`：開立、作廢、折讓；支援手機條碼載具、捐贈碼、買方統一編號三種輸入，前後端皆做格式驗證（統一編號含檢查碼）；mock 號碼必須明顯標示為測試（例如字軌固定為 `TT`），不連線任何財政部或加值中心環境；稅額依店家設定（內含／外加）由後端計算（合併清單 #7）。
  驗證：vitest 涵蓋三種載具格式的合法／不合法案例、統一編號檢查碼、作廢與折讓狀態轉換、內含／外加稅額計算。

- AC-010：硬體相容（mock）。建立 `PrinterAdapter` 介面：瀏覽器列印實作＋ESC/POS mock（輸出位元組序列，不連實體印表機），用於取餐單與收據；新增 `docs/HARDWARE-COMPAT.md` 列出目標硬體類別（熱感印表機、錢櫃、掃碼槍、KIOSK 平板）與各自狀態（M1 一律為「mock／待實機驗證」）。
  驗證：vitest 以 snapshot 比對 ESC/POS mock 輸出；Playwright 在 1024×768（KIOSK）、375×812（手機）、1280×800（POS）三種 viewport 完成主流程，無水平捲動。

- AC-011：員工角色與 API 授權（合併清單 #10）。新增 Staff 模型（店長／收銀／內場），密碼以 bcrypt 雜湊；`/api/admin/*`、KDS、POS、退款、報表、`PATCH /api/orders/:orderNo/status` 需員工 JWT 並依角色限制；`/api/members/:id*` 只允許本人會員 JWT 或店長；刪除或關閉 `POST /api/members/:id/points/add` 的未授權寫入。
  驗證：backend API 測試逐一斷言「無 token 401」「角色不符 403」「本人 200」；`git grep -n "password: '"` 在 seed 以外沒有明碼密碼。

- AC-012：營收報表（合併清單 #8）。`GET /api/admin/reports` 提供指定期間的營收、訂單數、熱銷 Top N、付款方式分佈、退款金額；排除作廢與退款訂單；後台有報表畫面。
  驗證：backend 測試移植並通過 `pos-multitrade/src/lib/report.test.ts` 的案例（改寫為後端資料形態），另加「退款不計入營收」案例。

- AC-013：會員等級與個資保護（合併清單 #11、SPEC §8）。依累計消費自動升等；後台會員列表、KDS、POS、KIOSK 畫面上的手機號碼一律遮罩只顯示末 3 碼；seed、測試與文件只使用明顯虛構的資料並集中定義。
  驗證：vitest 測升等門檻；元件測試斷言遮罩格式；`git grep -n -E "09[0-9]{2}-?[0-9]{3}-?[0-9]{3}"` 結果只出現在 seed／fixture 檔。

- AC-014：合併可追溯。`PRD/SPEC.md` §12.1 每一列對應到主 repo 的檔案路徑與測試；`STATUS.md` 的 FR 對照更新為實作後狀態；三個併入 repo 維持只讀、不封存。
  驗證：人工核對 §12.1 每列皆有「主 repo 路徑＋測試檔」；`gh repo view openclawsean024-create/<repo> --json isArchived` 三者皆為 `false`。

## Out of scope

- 真實電子發票開立與上傳（財政部平台或加值服務中心的正式／測試環境）、字軌申請。
- 真實金流：任何收單機構、第三方支付、行動支付的正式或測試商店帳號與金鑰。
- 真實硬體驅動：實體熱感印表機、錢櫃、刷卡機、掃碼槍、KIOSK 平板的驅動與實機測試。
- 真實個資：真實顧客、員工、店家資料；真實簡訊 OTP。
- PostgreSQL 正式環境、正式部署與上線、監控。
- 儲值卡、多門市彙總、離線收銀同步、交班、打卡、規則式經營提醒、多語系、外送串接。
- `pos-multitrade` 的行業切換與技師抽成。
- 訂閱計費、定價與試點招募。

## Exit gate

M1 完成前需由 Sean 覆審 scope 與合併清單，並通過 `SOP.md` 所列的檢查（build、unit、API、E2E）且 CI 全綠；所有金流、發票、印表機仍為 mock。未通過不得進入 M2 的真實金流、電子發票或硬體串接，也不得封存任何併入 repo。
