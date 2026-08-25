#!/bin/bash
# stop-all.sh — 停止所有 Smart Dining 服務
# 用法: ./scripts/stop-all.sh

set +e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_DIR="$PROJECT_ROOT/.pids"

stopped=0
for svc in backend kiosk mobile; do
  pid_file="$PIDS_DIR/$svc.pid"
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      echo "✓ $svc 已停止(PID $pid)"
      stopped=$((stopped + 1))
    fi
    rm -f "$pid_file"
  fi
done

# 額外清掉殘留 process
pkill -f "tsx watch src/server.ts" 2>/dev/null && echo "✓ 清掉殘留 backend process"
pkill -f "vite --port 5173" 2>/dev/null && echo "✓ 清掉殘留 kiosk process"
pkill -f "vite --port 5174" 2>/dev/null && echo "✓ 清掉殘留 mobile process"

if [ "$stopped" -eq 0 ]; then
  echo "ℹ️  沒有運行中的服務"
else
  echo "🎉 總共停止 $stopped 個服務"
fi
