# 餐飲自助點餐 KIOSK＋POS — 開發與驗證 SOP

> 指令皆查證自各 workspace 的 `package.json` scripts，並於 2026-11-16 在本機（Node v26.13.1、npm 11.20.0）實際執行一次。CI 使用 Node 20。

## 1. 安裝

```bash
npm ci                     # 根目錄安裝四個 workspace；實測 exit 0
```

## 2. 本機環境變數

backend 啟動、`db:*` 指令需要 `DATABASE_URL` 與 `JWT_SECRET`（`backend/src/config/env.ts` 以 zod 驗證，JWT_SECRET 至少 8 字元）。

- repo 只有 `backend/.env.production.example`（正式環境範本），**本機開發用的 `.env` 範本尚未配置**。
- 本機請自行建立 `backend/.env`（已被 `.gitignore` 排除，不可提交），內容只放本機用值，例如 `DATABASE_URL="file:./data/dev.db"`，`JWT_SECRET` 用 `openssl rand -hex 32` 產生。

## 3. 驗證指令

| 類型 | 指令 | 狀態（2026-11-16 實測） |
|---|---|---|
| Build（全部） | `npm run build` | 可用，exit 0（contracts → backend `prisma generate && tsc` → kiosk `tsc --noEmit && vite build` → mobile 同） |
| Unit（全部） | `npm test` | 可用，exit 0；實際只跑 backend vitest：1 檔 11 個 case。contracts 的 `test` 只印訊息；kiosk、mobile 沒有 `test` script |
| Unit（backend） | `cd backend && npm test` | 可用，同上 |
| Typecheck（backend） | `cd backend && npx tsc --noEmit`（或 `npm run typecheck -w @smart-dining/backend`） | 可用，exit 0 |
| Lint（KIOSK） | `npm run lint -w @smart-dining/kiosk` | 可用，exit 0；實際只是 `tsc --noEmit`，**ESLint 尚未配置** |
| Typecheck（Mobile） | `npm run typecheck -w @smart-dining/mobile` | 可用，exit 0 |
| DB 初始化 | `cd backend && npm run db:reset` | 可用（需第 2 節環境變數）；建立 SQLite 並寫入示範資料 |
| 啟動全部服務 | `./scripts/start-all.sh`／`./scripts/stop-all.sh` | 腳本存在；需第 2 節環境變數。backend :4000、KIOSK :5173、Mobile :5174 |
| 啟動 backend | `cd backend && npm run dev` | 可用（`tsx watch`） |
| 端到端 API＋WebSocket 腳本 | `cd backend && npm run test:e2e` | 可用（AC-001）：`scripts/with-test-server.mjs` 自動建立暫存 SQLite、seed、啟動 backend 後執行根目錄 `scripts/e2e-test.mjs`；斷言失敗即非 0 結束；已進 CI `e2e` job。也可用 `API_BASE=... node scripts/e2e-test.mjs` 打既有 backend |
| WebSocket 腳本 | `cd backend && npm run test:ws -- <orderNo>` | 腳本存在；只印事件、不做斷言 |
| API 冒煙腳本 | `cd backend && npm run test:api` | 可用（AC-001）：每個請求比對狀態碼，404／500／連不上即 exit 1；同樣自帶測試 backend；已進 CI `e2e` job |
| 前端單元／元件測試 | — | **尚未配置** |
| API 整合測試（Fastify inject） | `cd backend && npm test` | 可用（AC-001 起）：vitest `globalSetup` 建立 SQLite 範本，每個測試 app 使用獨立複本；不需要 `.env` |
| 瀏覽器 E2E（Playwright） | — | **尚未配置**（M1 AC-004～AC-006、AC-010） |
| Format | — | **尚未配置** |
| Coverage | — | **尚未配置** |

不得把「尚未配置」或「結果不可信」的項目當作通過。

## 4. 提交前最低檢查

```bash
npm ci
npm run build
npm test
(cd backend && npx tsc --noEmit)
```

改到訂單、狀態推進或 Socket 事件時，另外啟動 backend 並跑 `node scripts/e2e-test.mjs`，記錄輸出。

## 5. CI

`.github/workflows/ci.yml`（push／PR 到 `main`）：

- `lint`：backend `tsc --noEmit`、kiosk `lint`、mobile `typecheck`，任一步失敗即失敗（AC-001 已移除 `continue-on-error`）。
- `test`：`prisma generate` 後跑根目錄 `npm test`（全部 workspace）。
- `e2e`：`npm run test:api`、`npm run test:e2e`（各自啟動一次性的測試 backend）。
- `build`：`npm run build`，上傳 kiosk／mobile dist。
- `deploy`：只在 `main` push 時執行 Vercel ×2＋Railway（需 `build`、`e2e` 通過），缺 secrets 時不擋錯。PR 分支不會部署。

## 6. M1 期間故意不做

- 不連任何真實金流、電子發票（含財政部或加值中心測試環境）、簡訊或硬體。
- 不部署正式環境、不改 Vercel／Railway 設定。
- 不在併入的三個 repo 做任何修改。
