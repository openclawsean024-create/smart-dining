# AGENTS.md — 餐飲自助點餐 KIOSK＋POS（smart-dining）

## 1. 權威規格與範圍

- 單一規格來源：[`PRD/SPEC.md`](./PRD/SPEC.md) v4.0；目前里程碑：[`GOAL.md`](./GOAL.md)（M1）。
- 所有實作必須對應到 SPEC 的 FR 編號與 GOAL 的 AC 編號。
- 本 repo 是主 repo；`pos-system`、`pos-multitrade`、`restaurant-kiosk` 是要併入的來源 repo，**只讀**。搬功能時依 SPEC §12 合併清單改寫進本 repo 架構，不整包複製、不在來源 repo commit。
- 金流、電子發票、印表機與其他硬體在 M1 只能是 mock／測試模式。未經 Sean 人審，不得加入任何真實供應商端點、商店代號或金鑰。
- 舊文件（`README.md`、`ARCHITECTURE.md`、`DEPLOYMENT.md`、`docs/*`）有部分內容與程式不符（見 SPEC §11.1），以程式與 SPEC 為準。

## 2. 專案結構

```
smart-dining/                     npm workspaces monorepo
├── shared-contracts/             @smart-dining/contracts：API 路徑、Socket 事件、製作階段、共用型別
│   └── prisma/schema.prisma      與 backend 那份內容相同的副本（目前 build 不使用）
├── backend/                      @smart-dining/backend：Fastify API＋Socket.IO＋Prisma
│   ├── prisma/schema.prisma      實際被 prisma generate／db push 使用的 schema
│   ├── src/app.ts、server.ts     組裝與啟動
│   ├── src/modules/              auth、menu、orders、members、admin 路由
│   ├── src/plugins/              prisma、jwt（authenticate）、socket（/tracking）
│   ├── src/lib/                  orderNo、pickupNumber、verifyCode（OTPProvider）
│   ├── src/seed.ts               示範資料（4 分類、10 品項、2 會員、2 優惠券、1 筆訂單）
│   └── scripts/                  test-api.sh（目前結果不可信）、ws-test.mjs
├── kiosk-frontend/               @smart-dining/kiosk：KIOSK 點餐＋/admin 訂單推進（port 5173）
├── mobile-app/                   @smart-dining/mobile：取餐追蹤＋會員 PWA（port 5174）
├── scripts/                      start-all.sh、stop-all.sh、e2e-test.mjs、dev-with-sqlite.sh、prepare-prod.sh
├── docs/                         API、USER-FLOWS、DEMO-SCRIPT、QA-REPORT、design-spec（舊）
├── PRD/SPEC.md、PRD/CHANGELOG.md
└── GOAL.md、SOP.md、STATUS.md、AGENTS.md
```

## 3. 技術棧（依 package.json）

| 層 | 技術 |
|---|---|
| 後端 | Node.js（engines ≥ 18；CI 用 20）、TypeScript、Fastify 4、Prisma 5（dev 用 SQLite）、Socket.IO 4、@fastify/jwt、zod、Vitest 4 |
| KIOSK | React 18、Vite 6、Tailwind 3、zustand 5、SWR、react-router 6、qrcode |
| Mobile | React 18、Vite 5、vite-plugin-pwa、Tailwind 3、zustand 4、jsQR |
| 共用 | npm workspaces、`@smart-dining/contracts` |
| CI | `.github/workflows/ci.yml`：lint（不擋錯）、test（backend vitest）、build、deploy（main push 時，需 secrets） |

已安裝但未使用：`bcryptjs`（M1 用於員工密碼雜湊）。`fastify-plugin` 被使用但未列入 backend 依賴。

## 4. 開發規則

1. 修改前先讀本檔、`GOAL.md`、`SOP.md`、`STATUS.md` 與 SPEC 對應章節。
2. **只用假資料**：seed、測試、文件、截圖只能使用明顯虛構的姓名、電話、統一編號、地址。不得放入真實顧客、員工、店家或交易資料。示範手機號碼集中定義在 `backend/src/seed.ts` 與測試 fixture，其他檔案引用、不重複寫死。
3. **不得提交憑證**：`.env*`、JWT secret、資料庫連線字串、Vercel／Railway token、金流或發票金鑰一律不進版本庫；範本檔只能放 `REPLACE_ME` 類佔位值。發現疑似憑證時停止並回報，不要複製內容。
4. **測試不可為了通過而刪改斷言**：測試失敗時修正程式或回報；若規格變更需要改斷言，必須在 commit 訊息說明對應的 FR／AC 與原因。不得用 `.skip`、`continue-on-error` 或空測試冒充通過。
5. 金額、折扣、稅額、點數只在後端計算；前端傳入的價格與品名不可信任。
6. 新增或修改 API 時同步更新 `shared-contracts` 型別與 `API_PATHS`，三端型別一致。
7. 改 DB schema 時，`backend/prisma/schema.prisma` 是實際生效的檔案；在合併為單一檔案之前，兩份 schema 必須同步修改。
8. 套件一律在根目錄以 `npm install -w <workspace> <pkg>` 安裝，保持單一 lockfile。
9. 個資相關畫面（KIOSK、KDS、POS、後台會員列表）的手機號碼必須遮罩。
10. 不在 agent session 內 push 到 `main`、合併 PR、部署、改 repo 設定或旋轉 secrets；auth、授權、個資、DB migration、金流、發票相關變更需 Sean 人審。

## 5. 驗證

所有可用與尚未配置的指令見 [`SOP.md`](./SOP.md)。提交前至少跑：

```bash
npm ci
npm run build
npm test
```

## 6. Commit 規則

使用 `<type>(scope): <說明>`，並在內文標註對應的 FR／AC，例如 `feat(orders): server-side pricing (FR-002, AC-002)`。
