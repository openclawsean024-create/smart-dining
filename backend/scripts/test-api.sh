#!/usr/bin/env bash
# API 冒煙測試（AC-001）。
#
# 每個請求都比對 HTTP 狀態碼；只要有一個不符預期（包含 404／500／連不上），
# 腳本最後就以非 0 結束。需要一個已 seed 的 backend：
#   npm run test:api            # 自動啟動一次性的測試 backend（建議）
#   API_BASE=http://localhost:4000 bash scripts/test-api.sh   # 打既有的 backend
set -uo pipefail

BASE="${API_BASE:-http://localhost:4000}"
PHONE="${SD_DEMO_PHONE:-0900000001}"   # seed 的示範會員（明顯假號）
FAILED=0
BODY="$(mktemp)"
trap 'rm -f "$BODY"' EXIT

# request <名稱> <預期狀態碼> <METHOD> <路徑> [JSON body] [Bearer token]
request() {
  local name="$1" expected="$2" method="$3" path="$4" data="${5:-}" token="${6:-}"
  local args=(-s -o "$BODY" -w '%{http_code}' -X "$method" "$BASE$path")
  if [ -n "$data" ]; then args+=(-H 'content-type: application/json' -d "$data"); fi
  if [ -n "$token" ]; then args+=(-H "authorization: Bearer $token"); fi
  local status
  status="$(curl "${args[@]}" 2>/dev/null || true)"
  if [ "$status" = "$expected" ]; then
    echo "ok    $name ($status)"
  else
    echo "FAIL  $name: expected $expected, got ${status:-no response}"
    head -c 300 "$BODY" 2>/dev/null; echo
    FAILED=1
  fi
}

# 從上一個回應的 JSON 取值：json <a.b.c>
json() {
  node -e '
    const fs = require("fs");
    try {
      const v = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const r = process.argv[2].split(".").reduce((a, k) => (a == null ? a : a[k]), v);
      process.stdout.write(r == null ? "" : String(r));
    } catch { /* 非 JSON：回傳空字串 */ }
  ' "$BODY" "$1"
}

# 由菜單回應組出一筆合法的下單 payload（第一個品項＋每個必選群組的第一個選項）
order_payload() {
  node -e '
    const fs = require("fs");
    try {
      const menu = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const item = menu.categories.flatMap((c) => c.items ?? c.menuItems ?? [])[0];
      const customizations = (item.customizationGroups ?? [])
        .filter((g) => g.required)
        .map((g) => ({ groupId: g.id, choiceIds: [g.choices[0].id] }));
      process.stdout.write(JSON.stringify({ cart: { items: [{ menuItemId: item.id, name: item.name, quantity: 1, customizations }] } }));
    } catch { /* 菜單無效：回傳空字串，後續請求會失敗 */ }
  ' "$BODY"
}

request 'healthz' 200 GET /healthz
request 'menu' 200 GET /api/menu
ORDER_PAYLOAD="$(order_payload)"

request 'auth login' 200 POST /api/auth/login "{\"phone\":\"$PHONE\"}"
CODE="$(json code)"
request 'auth verify' 200 POST /api/auth/verify "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}"
MEMBER_ID="$(json member.id)"

request 'member' 200 GET "/api/members/$MEMBER_ID"
request 'member coupons' 200 GET "/api/members/$MEMBER_ID/coupons"

request 'create order' 201 POST /api/orders "${ORDER_PAYLOAD:-{\}}"
ORDER_NO="$(json order.orderNo)"
request 'get order' 200 GET "/api/orders/$ORDER_NO"
request 'advance order' 200 POST "/api/admin/orders/$ORDER_NO/advance"
request 'update status' 200 PATCH "/api/orders/$ORDER_NO/status" '{"status":"COOKING","changedBy":"api-smoke"}'
request 'unknown order is 404' 404 GET /api/orders/SD-00000000-0000

if [ "$FAILED" -ne 0 ]; then
  echo 'API SMOKE TEST FAILED'
  exit 1
fi
echo 'API SMOKE TEST PASSED'
