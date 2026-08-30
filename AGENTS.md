# 餐飲點餐快手 — Smart Dining Self-Ordering & Tracking System

## 目標

提供餐飲門市「從自助點餐 → 即時取餐追蹤 → 會員回訪」的完整閉環：

- **KIOSK 平板自助點餐**（1024×768 直式）：顧客 2 分鐘內自助完成瀏覽菜單、客製化、結帳；產生取餐號 / QR Code。
- **手機 PWA 即時追蹤**：顧客掃 KIOSK 上的 QR 後，由 Socket.IO 即時推送製作進度（10% → 100% 與階段 chip），READY 時震動 / 閃橘光。
- **門市後台 + 會員回訪**：VIP 等級、點數（NT$1 = 1 點）、優惠券（百分比 / 折抵），目標自助點餐完成率 > 90%、平均點餐時間 < 2 分、客製化加購率 ≥ 15%、會員回購率 ≥ 20%。
- 最終交付：可一鍵啟動（`./scripts/start-all.sh`）、可部署到 Vercel（前端）+ Railway（Backend + Postgres）的 MVP / 提案級 Demo。

## 避免

- **不要把 backend 部署到 Vercel serverless**：Socket.IO 需長連線、SQLite/Prisma 需檔案系統，serverless 不適合；backend 走 Railway 等長跑環境。
- **不要混用 SQLite 於正式上線**：原型 / MVP / Demo 用 SQLite OK，但**多門市或高併發**必須改 PostgreSQL（Prisma schema 不變，僅改 `DATABASE_URL` 並重跑 `prisma migrate`）。
- **不要把驗證碼 `1234` 帶到生產**：那是 Demo 簡化，正式版必須接 SMS gateway（Twilio / Every8d / 三竹資訊），邏輯集中在 `backend/src/lib/verifyCode.ts`，替換 OTP provider 即可。
- **不要破壞單一資料來源**：DB schema 只允許在 `shared-contracts/prisma/schema.prisma` 一處定義；三端（backend / kiosk / mobile）都透過 `@smart-dining/contracts` 拿型別，**禁止**前端各自刻 Prisma client 或寫死型別。
- **不要在 mobile 端省略 `track:order` 加入房間**：沒加入 `order:${orderNo}` room 就收不到 `order:statusChanged` / `order:progress` / `order:ready`；同時跨網域部署要打開 Nginx 的 WebSocket `Upgrade` / `Connection` 標頭。
- **不要把後台 admin 狀態推進廣播漏掉**：P1 bug 已修補（見 `docs/QA-REPORT.md`），新增 status transition 時必須確認 backend 同時廣播到 KIOSK 與 mobile 的 order room。
- **不要 commit 真實 secret**：`.env.local` / `.jwt-secret.txt` 已在 `.gitignore`；CI / 部署一律用環境變數注入。
- **避免在 workspaces 內直接裝套件**：用根目錄 `npm install -w <workspace>`，不要在子資料夾獨立跑 install，會破壞 lockfile 一致性。
- **避免覆寫既有 AGENTS.md / README**：本檔僅追加有意義新內容；真正的覆寫必須在 commit 標註 `docs: revise ... (overrides ...)`。
- **不要把 `node_modules`、`*.db`、`.logs/`、`.pids/`、`.env*` 提交進版本庫**（已由 `.gitignore` 保護）。
- **待觀察**：CI 尚未配置（README 提到「若已配置」），多門市 v1.1 / 外送接單 v1.2 仍在 Roadmap。

## 技術棧與指令

### 技術棧

| 層 | 技術 |
|----|------|
| 後端 | Node.js 18+ / TypeScript / Fastify / Prisma ORM / SQLite（dev）/ Socket.IO / JWT（HS256）+ bcrypt |
| KIOSK 前端 | React 18 / Vite / TypeScript / Tailwind CSS（1024×768 直式） |
| Mobile APP | React 18 / Vite / TypeScript / Tailwind CSS + PWA（375×812）+ zustand |
| 跨端共享 | npm workspaces + `@smart-dining/contracts`（`shared-contracts/`，單一 Prisma schema + API / WS / 型別） |
| 即時通訊 | Socket.IO，`/tracking` namespace、`order:${orderNo}` room |
| 部署 | Vercel（KIOSK + Mobile）+ Railway（Backend + Postgres）；root-level `vercel.kiosk.json` / `vercel.mobile.json` |

### 目錄結構（要點）

```
smart-dining/
├── shared-contracts/   # 跨端共用 TS 契約 + Prisma schema（單一來源）
├── backend/            # Fastify API + Socket.IO + Prisma
├── kiosk-frontend/     # React 18 KIOSK UI（平板）
├── mobile-app/         # React 18 PWA（手機）
├── scripts/            # start-all.sh / stop-all.sh
├── docs/               # design-spec / QA-REPORT / USER-FLOWS / API / DEMO-SCRIPT
├── ARCHITECTURE.md     # 系統架構、資料流、Roadmap
├── DEPLOYMENT.md       # Vercel + Railway 部署
└── README.md
```

### 常用指令

| 指令 | 作用 |
|------|------|
| `npm install`（根目錄） | 安裝所有 workspace 依賴 |
| `./scripts/start-all.sh` | 一鍵啟動 Backend (4000) + KIOSK (5173) + Mobile (5174) |
| `./scripts/stop-all.sh` | 讀 `.pids/` 送 SIGTERM 並 `pkill` 殘留 |
| `npm run dev --workspaces --if-present` | 同時啟動三個子系統 |
| `npm run build --workspaces --if-present` | 建置所有子專案（CI 前置） |
| `npm run test --workspaces --if-present` | 跑所有子專案測試 |
| `cd backend && npm run db:reset` | 首次 / 重灌 SQLite + 種子（2 會員 + 10 菜單 + 2 優惠券） |
| `cd backend && npm run db:seed` | 只重跑種子（保留既有資料） |
| `cd backend && npx prisma migrate dev --name <change>` | 改 schema 後產生 migration |
| `backend/scripts/test-api.sh` 與 `backend/scripts/ws-test.mjs` | 整合測試（REST + WS） |

### Demo 帳號（種子）

- VIP `0912345678` / 驗證碼 `1234`（500 點、`VIP10` 9 折）
- 一般 `0987654321` / 驗證碼 `1234`（50 點、`WELCOME` NT$20 折抵）

### 修改流程（給新進工程師）

1. 改 contract → `shared-contracts/src/**` → 改 `backend/src/modules/**` → 改前端 `api/**`（三端型別同步）。
2. 改 DB → `shared-contracts/prisma/schema.prisma` → `npx prisma migrate dev --name <change>`。
3. 改 menu → `backend/src/seed.ts` → `npm run db:reset`。
4. commit 前 → 三個子系統都需 `npm run build` 通過；TS 型別錯誤會擋下。