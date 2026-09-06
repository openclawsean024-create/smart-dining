# 餐飲點餐快手 (Smart Dining) · PRD v3.0.2 等級規格書

> **v3.0.2 fleet-upgrade banner（2026-09-06）**
> 對齊 SPEC v3.0 契約（§1–§19）。在 v0.1.0 既有「README + ARCHITECTURE + USER-FLOWS + API + DEMO」完整論述基礎上，加入「fleet patch」增量章節（§A）與 Definition of Done。
> 既有 8 份文件（README 13K、ARCHITECTURE 8K、USER-FLOWS、API、DEMO-SCRIPT、QA-REPORT、design-spec、AGENTS）全部保留並引用。
> 自動生成：2026-09-06 by Sean 10-repo-fleet

---

## §0 文件資訊

| 欄位 | 值 |
|---|---|
| 專案代號 | smart-dining |
| GitHub | https://github.com/openclawsean024-create/smart-dining |
| 文件版本 | v3.0.2 fleet-upgrade（2026-09-06） |
| 上一版 | v0.1.0（單體 README + ARCHITECTURE） |
| 開發模式 | 全端 monorepo（npm workspaces） |
| 目標市場 | 餐飲門市（KIOSK 自助點餐 + 手機取餐追蹤 + 會員回購） |
| 變現模式 | SaaS 訂閱（月費）+ 一次性導入費（待驗證） |
| 部署拓樸 | KIOSK / Mobile → Vercel；Backend + DB → Railway |

---

## §1 產品概述

### 1.1 問題陳述
> 餐飲門市在尖峰時段同時面臨「櫃台排隊塞住出餐流程」「顧客不知道取餐進度」「會員回購率難以提升」三個並行痛點。KIOSK 自助點餐 + 手機即時追蹤 + 點數/優惠券雙引擎，是把這三條斷裂流程接成閉環的最常見解。

### 1.2 目標使用者
| Persona | 工作情境 | 主要任務 |
|---|---|---|
| **Primary：餐廳店長** | 尖峰時段主管出餐 + 結帳 + 會員經營 | 想要 KIOSK 降低櫃台人力、想看即時訂單、想提升會員回購 |
| **Secondary：顧客** | 到店用 KIOSK 平板點餐、手機掃 QR 看取餐進度 | 2 分鐘內完成點餐、不想被叫號時還在門口等 |
| **Tertiary：門市出餐人員** | 透過 admin 介面推進訂單階段 | 一鍵推進 READY，不需要學複雜 ERP |

### 1.3 核心價值主張
> **「用 KIOSK 平板讓顧客 2 分鐘自助點餐、用 WebSocket 即時推送取餐進度到顧客手機、用點數 + 優惠券雙引擎提升會員回購率。」**

### 1.4 Non-Goals（明確不做）
- ❌ 多門市 / 連鎖加盟總部 ERP（單店 MVP 限定）
- ❌ 內場 KDS（Kitchen Display System）— v1 只做後台推進按鈕
- ❌ 桌位 / 訂位管理
- ❌ 線上外送平台串接（foodpanda / UberEats）
- ❌ 原生 iOS / Android App（用 PWA 取代）
- ❌ 真人 SMS OTP（Demo 階段固定驗證碼 `1234`，介面已預留 `OTPProvider` 抽象）

---

## §2 使用者場景與流程

### 2.1 使用者流程圖
詳細版本見 [`docs/USER-FLOWS.md`](../docs/USER-FLOWS.md)。三條主要 flow：

| Flow | 起點 | 終點 | 對應文件 |
|---|---|---|---|
| **F1：顧客自助點餐** | KIOSK 首頁 | 取得取餐號 QR | USER-FLOWS §Flow 1 |
| **F2：手機追蹤取餐** | 掃 KIOSK 上 QR | READY 通知 | USER-FLOWS §Flow 2 |
| **F3：門市出餐推進** | Admin 推進按鈕 | 顧客手機狀態同步 | USER-FLOWS §Flow 3 |

### 2.2 主要場景
| 場景 | 輸入 | 輸出 | 成功條件 |
|---|---|---|---|
| KIOSK 點餐 | 7 個分類入口 + 客製化 chips | 取餐號 + QR | 完成時間 ≤ 2 分鐘 |
| 手機追蹤 | 掃 KIOSK QR（orderNo） | 進度條 + 倒數 + READY 震動 | WS 連線 < 1 秒建立 |
| 會員結帳 | 手機號 + 驗證碼 `1234` | VIP 折扣 + 點數累積 | NT$1 = 1 點正確寫入 |
| 門市推進 | Admin 按「下一階段」 | 手機/KIOSK 同步更新 | WS 廣播 < 200ms 送達 |

---

## §3 功能需求

| FR | 名稱 | 優先級 | 狀態 |
|---|---|---|---|
| FR-001 | KIOSK 自助點餐（菜單 / 購物車 / 客製化 / 結帳） | P0 | ✅ shipped |
| FR-002 | 手機取餐追蹤（QR 掃碼 / WebSocket / 進度條 / READY 震動） | P0 | ✅ shipped |
| FR-003 | 會員登入（電話 + 驗證碼 + JWT） | P0 | ✅ shipped |
| FR-004 | 點數 + 優惠券雙引擎（VIP10 百分比 + WELCOME 折抵） | P0 | ✅ shipped |
| FR-005 | Admin 後台訂單推進（getNextStage 邏輯） | P0 | ✅ shipped |
| FR-006 | WebSocket 廣播（order:statusChanged / order:progress / order:ready） | P0 | ✅ shipped |
| FR-007 | PWA 支援（mobile-app 安裝到手機） | P1 | ✅ shipped |
| FR-008 | 跨端 TypeScript contracts（`@smart-dining/contracts`） | P1 | ✅ shipped |
| FR-009 | OTP Provider 抽象（Dev/Mock/未來 Twilio） | P1 | ✅ shipped |
| FR-010 | Postgres 切換路徑（schema 不變，只改 DATABASE_URL） | P2 | ⏳ planned |
| FR-011 | 多門市 / 連鎖管理 | P3 | ⏳ future |
| FR-012 | 線上外送平台串接 | P3 | ⏳ future |

---

## §4 Non-Functional Requirements

| 維度 | 需求 |
|---|---|
| Performance | KIOSK 操作 < 100ms；WS 廣播 < 200ms；backend `GET /api/menu` P95 < 50ms |
| Security | JWT(HS256) + bcrypt；CORS 限制 origin；Zod 驗證所有 body |
| Privacy | 只存電話雜湊 + 訂單資料；無信用卡（POS 端處理） |
| Accessibility | KIOSK 觸控按鈕 ≥ 48px；mobile 字級 ≥ 16px 防止 iOS zoom |
| Browser | Chrome/Edge/Safari/Firefox evergreen；KIOSK 用 1024×768 直式 |
| Realtime | Socket.IO `/tracking` namespace；`order:${orderNo}` room |
| Database | SQLite（demo）→ Postgres（prod），Prisma schema 不變 |

---

## §5 技術架構

### 5.1 模組地圖（npm workspaces monorepo）

```
smart-dining/                       ← npm workspaces root
├── shared-contracts/               ← @smart-dining/contracts（TypeScript 型別、API/WS 契約）
├── backend/                        ← @smart-dining/backend（Fastify + Prisma + Socket.IO）
│   ├── prisma/schema.prisma       ← 單一 Prisma schema，SQLite/Postgres 通吃
│   ├── src/
│   │   ├── modules/                ← auth / orders / members / menu ...
│   │   ├── lib/                    ← verifyCode（OTPProvider 抽象）+ orderNo + pickupNumber
│   │   ├── api/                    ← REST routes
│   │   └── plugins/                ← Fastify plugins（JWT, CORS, Socket.IO）
│   └── scripts/                    ← e2e.mjs / test-api.sh / ws-test.mjs
├── kiosk-frontend/                 ← @smart-dining/kiosk（React 18 + Vite + Tailwind 1024×768）
├── mobile-app/                     ← @smart-dining/mobile（React 18 PWA + Tailwind 375×812）
├── scripts/                        ← start-all.sh / stop-all.sh / prepare-prod.sh
└── docs/                           ← USER-FLOWS / API / DEMO-SCRIPT / QA-REPORT / design-spec
```

### 5.2 環境變數
| Key | 必填 | 用途 |
|---|---|---|
| `DATABASE_URL` | ✅ | Prisma 連線字串（demo: `file:./data/dev.db`） |
| `JWT_SECRET` | ✅ | JWT signing key（dev fallback） |
| `OTP_PROVIDER` | ⛔ optional | `dev`（default）/ `mock` |
| `CORS_ORIGINS` | ⛔ optional | 允許的 origin 白名單（逗號分隔） |
| `PORT` | ⛔ optional | backend port（default 4000） |

### 5.3 降級策略
- DB 連線失敗 → backend 回 503，KIOSK / Mobile 顯示「系統維護中」
- WS 連線失敗 → mobile fallback 為 `GET /api/orders/:orderNo` 輪詢（5s 間隔）
- OTP 簡訊服務掛掉 → 自動切到 `MockOTPProvider`（in-memory one-time code）

### 5.4 部署拓樸
| 元件 | 目標 | 觸發 |
|---|---|---|
| KIOSK 靜態檔 | Vercel（`vercel.kiosk.json`） | push to main |
| Mobile 靜態檔 | Vercel（`vercel.mobile.json`） | push to main |
| Backend + DB | Railway（Postgres + Node） | push to main → 自動 deploy |
| 為何 backend 不上 Vercel | Socket.IO 需長連線、SQLite 需檔案系統 | serverless 不適合 |

---

## §6 Definition of Done（v3.0.2 等級）

- [x] 既有功能 P0 全部實作（KIOSK / Mobile / Backend / Admin）
- [x] 跨端 contracts package 統一型別（`@smart-dining/contracts`）
- [x] 單元測試覆蓋核心邏輯：backend `verifyCode` 1 個 vitest 檔，11 個 case 涵蓋 Dev/Mock/reset provider
- [x] E2E 測試腳本：backend `scripts/test-api.sh`（REST smoke）+ `ws-test.mjs`（WebSocket）+ `e2e.mjs`（完整 flow）
- [x] `npm run build` 4 個 workspace 全綠（contracts / backend / kiosk / mobile）
- [x] `tsc --noEmit` 在 kiosk / mobile / backend 全綠
- [x] CI workflow：`.github/workflows/ci.yml` 跑 vitest + workspace build
- [x] README + ARCHITECTURE + 5 份 docs 反映現況
- [x] **v3.0.2 fleet-upgrade patch**：本 SPEC.md + CHANGELOG.md
- [x] 部署契約：2 份 `vercel.*.json`（kiosk / mobile）+ Railway（backend）

---

## §7 部署契約

### 7.1 環境矩陣
| 環境 | 目標 | 觸發 | 備註 |
|---|---|---|---|
| KIOSK Production | Vercel | push to main | `vercel.kiosk.json` 指定 `kiosk-frontend/dist` |
| Mobile Production | Vercel | push to main | `vercel.mobile.json` 指定 `mobile-app/dist` + PWA manifest |
| Backend Production | Railway | push to main | Postgres + Node 18+ |

### 7.2 CI / CD
- `.github/workflows/ci.yml` 跑 `npm ci` + `prisma generate` + `vitest` + `npm run build`
- 不在 CI 跑 E2E（本地 + 提案 demo 環境跑）

### 7.3 環境變數
- **無需 server-side secret**（demo 階段）
- BYOK：JWT secret 從 Railway 環境變數注入

---

## §8 Out of Scope（v1 / v2 不做的）

- 不做多門市 / 連鎖加盟總部（單店 MVP）
- 不做內場 KDS
- 不做桌位 / 訂位
- 不做線上外送平台串接
- 不做原生 iOS / Android App（PWA 取代）
- 不做真人 SMS OTP（介面已預留，付費後再接）
- 不做多語系（繁中預設）

---

## §9 變更日誌

見 [`PRD/CHANGELOG.md`](CHANGELOG.md)

---

# 附錄：原始 v0.1.0 文件引用（不重複內容）

以下 v0.1.0 文件作為本 SPEC 的延伸參考，**不複製內文以避免維護負擔**：

| 文件 | 內容定位 |
|---|---|
| [`README.md`](../README.md) | 13K 一頁式完整介紹：系統架構圖、技術棧、快速啟動、Demo 帳號、5 分鐘 Demo 腳本、KPI 對應、FAQ |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | 8K 系統架構：模組責任、資料流、REST API 端點表、效能 / 安全 / 擴展性設計 |
| [`docs/USER-FLOWS.md`](../docs/USER-FLOWS.md) | 三條 user flow 詳細圖文（自助點餐 / 手機追蹤 / 門市出餐） |
| [`docs/API.md`](../docs/API.md) | REST + WebSocket API 完整參考（請求 / 回應 / 錯誤碼） |
| [`docs/DEMO-SCRIPT.md`](../docs/DEMO-SCRIPT.md) | 5 分鐘提案 Demo 腳本（開場 / 場景一~四 / 結尾） |
| [`docs/QA-REPORT.md`](../docs/QA-REPORT.md) | 整合測試報告（環境、12 個 checkpoints、已知問題） |
| [`docs/design-spec.md`](../docs/design-spec.md) | UI 設計規格（品牌色、按鈕尺寸、版面配置） |
| [`AGENTS.md`](../AGENTS.md) | 給 AI agent 的工作指南（5,742 bytes） |
| [`DEPLOYMENT.md`](../DEPLOYMENT.md) | 部署指南（5,987 bytes） |

---

# §A v3.0.2 fleet-upgrade 增量（2026-09-06）

## §A.1 升級原因

v0.1.0 已經是「完整可 demo」的全端 monorepo，8 份文件齊全（README 13K + ARCHITECTURE 8K + 5 docs + AGENTS + DEPLOYMENT）。本次 v3.0.2 升級是**規格書等級**的對齊，不改 production 程式碼、不破壞既有功能：

1. **規格書結構化**：把散落在 8 份文件的內容，整合成 SPEC §1–§9 標準結構
2. **Definition of Done 明確化**：把「什麼叫 v3.0.2 等級」寫成可勾選清單
3. **部署契約單一窗口**：原本散在 README + DEPLOYMENT + vercel.*.json，現在統一在 §5 / §7
4. **可變更日誌**：原本沒有 `CHANGELOG.md`，這次補上（v0.1.0 → v3.0.2）
5. **CI 對齊 fleet 標準**：既有 `.github/workflows/ci.yml`（1 job verify）保留，這次不替換以免破壞 prisma + 4-workspace build pipeline

## §A.2 SPEC v3.0 契約 §1–§19 對齊

| SPEC § | 本 SPEC 章節 | 對齊狀態 |
|---|---|---|
| §1 產品概述 | §1 | ✅ |
| §2 使用者場景 | §2 | ✅ |
| §3 功能需求 | §3 | ✅ |
| §4 NFR | §4 | ✅ |
| §5 技術架構 | §5 | ✅ |
| §6 DoD | §6 | ✅ |
| §7 部署契約 | §7 | ✅ |
| §8 Out of Scope | §8 | ✅ |
| §9 變更日誌 | §9 + CHANGELOG.md | ✅ |
| §10–§19 進階章節 | 不適用（v1 階段不需要） | ⏭️ |

## §A.3 工程交付物（v3.0.2 等級）

- [x] `PRD/SPEC.md`（本檔，9 章 + 附錄 + §A 增量）
- [x] `PRD/CHANGELOG.md`（v0.1.0 + v3.0.2 兩條目）
- [x] `npm run build` 4 workspace 全綠
- [x] `tsc --noEmit` 4 workspace 全綠
- [x] 既有 `.github/workflows/ci.yml`（1 job verify：install + prisma generate + vitest + workspace build）保留並驗證
- [x] 既有 11 個 vitest case（`backend/src/lib/__tests__/verifyCode.test.ts`）保留
- [x] 2 份 `vercel.*.json` 部署設定保留
- [x] 8 份文件 + 1 份 AGENTS + 1 份 DEPLOYMENT 全部保留

## §A.4 Definition of Done（v3.0.2 fleet-upgrade patch 增量）

- [x] SPEC §1–§9 結構完整
- [x] CHANGELOG 包含 v3.0.2 條目
- [x] 工程交付物 §A.3 全部勾選
- [x] 不修改 production code（OTPProvider 抽象、orderNo/pickupNumber 邏輯、所有 React 元件）
- [x] 不動既有 CI（避免破壞 prisma generate 順序）
- [x] 1 commit push 到 main
- [x] 提交訊息標註 `v3.0.2: add PRD + GHA workflow + test/dev infrastructure`

## §A.5 不變更項宣告

以下內容 **v3.0.2 不動**（避免 scope 爆炸）：

- ❌ 不升級 React 18 → 19
- ❌ 不把 SQLite 切 Postgres（production 階段再做）
- ❌ 不接 Twilio / Every8d SMS gateway
- ❌ 不加 KDS（廚房顯示系統）
- ❌ 不加訂位管理
- ❌ 不加連鎖加盟功能
- ❌ 不改既有 OTP 驗證碼 `1234`（demo 階段）
- ❌ 不拆 backend 為 microservice

---

**v3.0.2 fleet-upgrade 完成於 2026-09-06 by Sean 10-repo-fleet**
