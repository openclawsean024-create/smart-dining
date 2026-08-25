#!/bin/bash
# start-all.sh — 同時啟動 backend / kiosk / mobile 三個服務
# 用法: ./scripts/start-all.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_DIR="$PROJECT_ROOT/.pids"
LOGS_DIR="$PROJECT_ROOT/.logs"

mkdir -p "$PIDS_DIR" "$LOGS_DIR"

echo "🚀 啟動 Smart Dining 三個服務..."

# ============================================================
# 0. 環境檢查
# ============================================================
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 找不到 node,請先安裝 Node.js 18+"
  exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node 版本過舊($(node -v)),需要 18+"
  exit 1
fi
echo "✓ Node $(node -v)"

# ============================================================
# 1. 初始化 backend 資料庫(若需要)
# ============================================================
DB_FILE="$PROJECT_ROOT/backend/data/dev.db"
if [ ! -f "$DB_FILE" ]; then
  echo "📦 首次啟動,初始化資料庫..."
  cd "$PROJECT_ROOT/backend"
  npm run db:reset >"$LOGS_DIR/seed.log" 2>&1 || {
    echo "❌ 資料庫初始化失敗,請看 $LOGS_DIR/seed.log"
    exit 1
  }
  echo "✓ 資料庫就緒"
fi

# ============================================================
# 2. 啟動 backend (port 4000)
# ============================================================
if [ -f "$PIDS_DIR/backend.pid" ] && kill -0 "$(cat "$PIDS_DIR/backend.pid")" 2>/dev/null; then
  echo "⚠️  backend 已在運行(PID $(cat "$PIDS_DIR/backend.pid")),跳過"
else
  echo "▶ 啟動 backend..."
  cd "$PROJECT_ROOT/backend"
  nohup npm run dev >"$LOGS_DIR/backend.log" 2>&1 &
  echo $! >"$PIDS_DIR/backend.pid"
fi

# ============================================================
# 3. 啟動 kiosk (port 5173)
# ============================================================
if [ -f "$PIDS_DIR/kiosk.pid" ] && kill -0 "$(cat "$PIDS_DIR/kiosk.pid")" 2>/dev/null; then
  echo "⚠️  kiosk 已在運行(PID $(cat "$PIDS_DIR/kiosk.pid")),跳過"
else
  echo "▶ 啟動 kiosk-frontend..."
  cd "$PROJECT_ROOT/kiosk-frontend"
  nohup npm run dev >"$LOGS_DIR/kiosk.log" 2>&1 &
  echo $! >"$PIDS_DIR/kiosk.pid"
fi

# ============================================================
# 4. 啟動 mobile (port 5174)
# ============================================================
if [ -f "$PIDS_DIR/mobile.pid" ] && kill -0 "$(cat "$PIDS_DIR/mobile.pid")" 2>/dev/null; then
  echo "⚠️  mobile 已在運行(PID $(cat "$PIDS_DIR/mobile.pid")),跳過"
else
  echo "▶ 啟動 mobile-app..."
  cd "$PROJECT_ROOT/mobile-app"
  nohup npm run dev >"$LOGS_DIR/mobile.log" 2>&1 &
  echo $! >"$PIDS_DIR/mobile.pid"
fi

# ============================================================
# 5. 健康檢查
# ============================================================
echo "⏳ 等待服務啟動..."
sleep 10

check_url() {
  local name="$1" url="$2"
  if curl -sf -m 3 "$url" >/dev/null 2>&1; then
    echo "  ✓ $name ($url)"
  else
    echo "  ⚠️  $name ($url) — 尚未就緒,可看 $LOGS_DIR/*.log"
  fi
}

echo ""
echo "🔍 健康檢查:"
check_url "Backend API" "http://localhost:4000/healthz"
check_url "KIOSK 平板"    "http://localhost:5173"
check_url "Mobile APP"   "http://localhost:5174"

echo ""
echo "🎉 所有服務已啟動!"
echo "   ┌─ KIOSK 平板: http://localhost:5173"
echo "   ├─ Mobile APP: http://localhost:5174"
echo "   └─ Backend API: http://localhost:4000"
echo ""
echo "📋 Demo 帳號:"
echo "   VIP  會員: 0912345678 / 驗證碼 1234"
echo "   一般會員: 0987654321 / 驗證碼 1234"
echo ""
echo "📊 日誌位置: $LOGS_DIR/"
echo "🛑 停止服務: ./scripts/stop-all.sh"
