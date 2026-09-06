# 餐飲點餐快手 (Smart Dining) · CHANGELOG

> 版本歷史。最新條目在最上方。

---

## v3.0.2 — 2026-09-06（fleet-upgrade patch）

**背景**：Sean 10-repo-fleet 批次 5A 升級。對齊 SPEC v3.0 契約（§1–§19），不改 production code。

**新增**：
- `PRD/SPEC.md`（9 章 + 附錄 + §A 增量）— 規格書等級 v3.0.2
- `PRD/CHANGELOG.md`（本檔）

**修改**：
- 無（patch 等級，只新增文件，不動既有 8 份文件 + 1 份 AGENTS + 1 份 DEPLOYMENT + production code）

**保留**：
- 既有 `.github/workflows/ci.yml`（1 job verify：install + prisma generate + vitest + workspace build）
- 既有 11 個 vitest case（`backend/src/lib/__tests__/verifyCode.test.ts`）
- 既有 2 份 `vercel.*.json` 部署設定（kiosk + mobile）
- 既有 OTPProvider 抽象（Dev / Mock / 未來 Twilio）

**Deploy target**：Vercel（KIOSK + Mobile）+ Railway（Backend + DB）

**完成者**：Sean 10-repo-fleet（自動駕駛 worker agent）

---

## v0.1.0 — 2026-09-05（v3.0.2 之前的初始版）

**功能**：
- ✅ KIOSK 自助點餐（React 18 + Vite + Tailwind，1024×768 直式）
- ✅ 手機取餐追蹤（React 18 PWA，375×812）
- ✅ Backend（Fastify + Prisma + Socket.IO + JWT + bcrypt）
- ✅ 跨端 TypeScript contracts package
- ✅ 會員點數 + 優惠券雙引擎
- ✅ Admin 後台訂單推進
- ✅ WebSocket 即時廣播（`order:statusChanged` / `order:progress` / `order:ready`）
- ✅ OTPProvider 抽象（DevOTPProvider demo `1234` + MockOTPProvider in-memory）
- ✅ npm workspaces monorepo（contracts / backend / kiosk / mobile）
- ✅ 一鍵啟動 `scripts/start-all.sh`
- ✅ 8 份完整文件：README + ARCHITECTURE + USER-FLOWS + API + DEMO-SCRIPT + QA-REPORT + design-spec + AGENTS

**驗證**：
- 5 分鐘 Demo 腳本（含 VIP 9 折、點數累積、WebSocket 同步推進）
- 整合測試報告（12 個 checkpoints）
- 2 個種子會員 + 10 個菜單 + 4 個分類

**部署拓樸**：
- KIOSK / Mobile → Vercel
- Backend + DB → Railway
