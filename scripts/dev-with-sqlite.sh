#!/bin/bash
# dev-with-sqlite.sh — 還原 Prisma provider 為 sqlite(本地 dev 用)

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for f in "$PROJECT_ROOT/backend/prisma/schema.prisma" "$PROJECT_ROOT/shared-contracts/prisma/schema.prisma"; do
  sed -i.bak 's/provider = "postgresql"/provider = "sqlite"/g' "$f"
  rm -f "$f.bak"
  echo "OK $f 已切換為 sqlite"
done

cd "$PROJECT_ROOT/backend" && npx prisma generate
echo ""
echo "DONE Dev schema 準備完成。跑 npm run db:reset 初始化。"
