# Deployment Guide

> 把「餐飲點餐快手」推到正式環境的完整步驟。

## 架構總覽

| 元件 | 平台 | 原因 |
|------|------|------|
| **KIOSK 前端** | Vercel | 純靜態 SPA,免費 |
| **Mobile PWA** | Vercel | 純靜態 PWA,免費 |
| **Backend API** | Railway | 需 WebSocket + 持久 DB,Vercel serverless 不支援 |
| **Database** | Railway Postgres | $5/月免費額度,內建 |

> 為什麼 backend 不上 Vercel?Vercel serverless function 是短暫容器,
> SQLite 檔案系統是唯讀的、WebSocket 連線無法維持長連線。
> Railway 提供真正的 long-running process,支援 Socket.IO 與 Postgres。

---

## 📋 前置準備

1. GitHub 帳號
2. Vercel 帳號(免費,可用 GitHub 登入)
3. Railway 帳號(免費,$5/月額度,可用 GitHub 登入)
4. 本機已安裝 GitHub CLI(brew install gh)

---

## Step 1 — 推到 GitHub

### 1.1 建立新 repo(若還沒有)

```bash
cd "/Users/sean/Documents/Agent space/smart-dining"
gh repo create smart-dining --private --source=. --remote=origin --push
# 或公開:
# gh repo create smart-dining --public --source=. --remote=origin --push
```

### 1.2(若 repo 已存在)手動連結

```bash
cd "/Users/sean/Documents/Agent space/smart-dining"
git remote add origin https://github.com/YOUR_USERNAME/smart-dining.git
git branch -M main
git push -u origin main
```

---

## Step 2 — 部署 Backend 到 Railway

### 2.1 建立 Railway 專案

1. 到 https://railway.app → New Project
2. 選 Deploy from GitHub repo → 選 smart-dining
3. Railway 會自動偵測為 Node.js

### 2.2 加入 Postgres

1. 在 Railway 專案按 + New → Database → PostgreSQL
2. 建立完成後,點 Postgres 服務 → Variables → 複製 DATABASE_URL

### 2.3 設定 Backend 服務的環境變數

點 backend 服務 → Variables → 加入:

| 變數 | 值 |
|------|-----|
| DATABASE_URL | 貼上 Postgres 的連線字串 |
| JWT_SECRET | 跑 openssl rand -hex 32 產生 |
| CORS_ORIGIN | https://YOUR-KIOSK.vercel.app,https://YOUR-MOBILE.vercel.app |
| NODE_ENV | production |
| PORT | 4000(Railway 會自動注入,但寫著備用) |

### 2.4 切換 Prisma 到 Postgres 並部署

```bash
cd "/Users/sean/Documents/Agent space/smart-dining"
./scripts/prepare-prod.sh
git add -A
git commit -m "chore: switch prisma to postgresql for prod"
git push
```

Railway 會自動偵測 push 重新部署,跑 npm run db:push && npm run db:seed && npm start。

### 2.5 取得 Backend 網址

Railway 服務 → Settings → Networking → Generate Domain
例: https://smart-dining-api.up.railway.app

### 2.6 健康檢查

```bash
curl https://smart-dining-api.up.railway.app/healthz
# 預期: {"ok":true}
```

---

## Step 3 — 部署 KIOSK 到 Vercel

### 3.1 建立 Vercel 專案

1. 到 https://vercel.com → Add New Project
2. Import smart-dining repo
3. Root Directory 改成 kiosk-frontend
4. Framework 自動偵測為 Vite

### 3.2 設定環境變數

Vercel 專案 → Settings → Environment Variables:

| 變數 | Value | Environment |
|------|-------|-------------|
| VITE_API_BASE | https://smart-dining-api.up.railway.app | Production |

### 3.3 部署

按 Deploy。完成後會拿到 https://smart-dining-kiosk.vercel.app。

---

## Step 4 — 部署 Mobile PWA 到 Vercel

同上,但:

- Root Directory 改成 mobile-app
- 環境變數同樣設 VITE_API_BASE 指向 Railway
- 部署後拿到 https://smart-dining-mobile.vercel.app

---

## Step 5 — 把 CORS_ORIGIN 更新成正式網址

回到 Railway → backend 服務 → Variables,把 CORS_ORIGIN 改成實際的 Vercel 網址:

CORS_ORIGIN=https://smart-dining-kiosk.vercel.app,https://smart-dining-mobile.vercel.app

---

## Step 6 — 驗證

1. KIOSK → 開瀏覽器到 Vercel KIOSK 網址,應該看到 Dashboard
2. Mobile → 開到手機瀏覽器(或 DevTools 模擬手機),應該看到 TrackingPage
3. Backend → curl https://YOUR-BACKEND/healthz 應回 {"ok":true}
4. 端到端:
   - 在 KIOSK 建立訂單,取得取餐號 A001(或更高)
   - 從 Mobile 輸入該取餐號進入追蹤
   - 開另一個分頁到 https://YOUR-KIOSK/admin 推進狀態
   - Mobile 應即時更新進度條

---

## 🔧 常見問題

### Railway 部署後 prisma db push 失敗

檢查 DATABASE_URL 是否正確貼上(Postgres 連線字串),
並確認 Railway 的 Postgres 服務在同一個 project。

### CORS 錯誤

CORS_ORIGIN 必須包含前端實際網址(含 https://,逗號分隔,不能有空格)。

### KIOSK / Mobile 看不到資料

VITE_API_BASE 必須在 Vercel 環境變數設定,並用 Production 環境。
設定後要 Redeploy 才會生效。

### WebSocket 連不上

Railway 預設支援 WebSocket,但若用 Cloudflare 之類的 proxy 可能會擋。
確認直接訪問 https://YOUR-BACKEND/ 應該回 Fastify 預設頁。

---

## 💰 費用估算

| 服務 | 免費額度 | 預估月費 |
|------|----------|----------|
| Vercel Hobby | 100GB 頻寬/月 | $0 |
| Railway | $5/月額度 | $0(用量低) |
| GitHub | 私有 repo 无限 | $0 |
| 總計 | | $0/月(開發階段)|

進入正式營運後(Railway 超過 $5/月),預估 $5-20/月。

---

## 🔄 之後更新

```bash
git add -A
git commit -m "feat: ..."
git push
# Vercel + Railway 都會自動偵測並重新部署
```

Vercel preview deploys 會自動給每個 PR 一個獨立網址,方便測試。

---

## 🧹 本地 dev 還原

若要在本地改完後要繼續 dev(不要部署),把 Prisma 切回 SQLite:

```bash
./scripts/dev-with-sqlite.sh
npm run db:reset
./scripts/start-all.sh
```
