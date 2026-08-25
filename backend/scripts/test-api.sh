#!/usr/bin/env bash
set -euo pipefail
base=http://localhost:4000
echo healthz; curl -s "$base/healthz"; echo
echo menu; curl -s "$base/api/menu" | head -c 300; echo
echo login; curl -s -X POST "$base/api/auth/login" -H 'content-type: application/json' -d '{"phone":"0912345678"}'; echo
echo verify; curl -s -X POST "$base/api/auth/verify" -H 'content-type: application/json' -d '{"phone":"0912345678","code":"1234"}'; echo
echo member; curl -s "$base/api/members/member-demo"; echo
echo coupons; curl -s "$base/api/members/member-demo/coupons"; echo
echo order; curl -s "$base/api/orders/SD-$(date +%Y%m%d)-0001"; echo
echo status; curl -s -X PATCH "$base/api/orders/SD-$(date +%Y%m%d)-0001/status" -H 'content-type: application/json' -d '{"status":"PREPARING","changedBy":"api"}'; echo
echo points; curl -s -X POST "$base/api/members/member-demo/points/add" -H 'content-type: application/json' -d '{"delta":10,"reason":"bonus"}'; echo
echo advance; curl -s -X POST "$base/api/orders/SD-$(date +%Y%m%d)-0001/advance"; echo
