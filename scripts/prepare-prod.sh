#!/bin/bash
# prepare-prod.sh — 把 Prisma provider 從 sqlite 切到 postgresql(給 Railway 部署用)
# 
# 為什麼:Prisma 的 datasource provider 是編譯期決定,不能在 runtime 切換。
# Dev 用 SQLite(零設定),Prod 用 Postgres(Railway 內建)。
#
# 用法:
#   ./scripts/prepare-prod.sh
#   DATABASE_URL="postgresql://..." npx prisma db push
#   部署到 Railway(會自動跑這個)

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "$PROJECT_ROOT/backend/prisma/schema.prisma" ]; then
  echo "ERROR: 找不到 schema.prisma"
  exit 1
fi

if grep -q 'provider = "postgresql"' "$PROJECT_ROOT/backend/prisma/schema.prisma"; then
  echo "OK 已經是 postgresql,不用切"
  exit 0
fi

for f in "$PROJECT_ROOT/backend/prisma/schema.prisma" "$PROJECT_ROOT/shared-contracts/prisma/schema.prisma"; do
  sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/g' "$f"
  rm -f "$f.bak"
  echo "OK $f 已切換為 postgresql"
done

echo ""
echo "Regenerating Prisma Client..."
cd "$PROJECT_ROOT/backend" && npx prisma generate
echo ""
echo "DONE Prod schema 準備完成。記得設 DATABASE_URL=postgresql://..."
