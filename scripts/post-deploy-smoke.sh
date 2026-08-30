#!/usr/bin/env bash
# post-deploy-smoke.sh — verify a deployed smart-dining URL is responding.
#
# Adapted from the repo-builder v2.1 automation template for smart-dining's
# backend: the only verified endpoint is /healthz (defined in
# backend/railway.json's healthcheckPath).
#
# Usage:
#   ./scripts/post-deploy-smoke.sh <base-url>
#   ./scripts/post-deploy-smoke.sh https://smart-dining-backend-staging.up.railway.app
#
# For the KIOSK / mobile frontends (Vercel), you usually can't smoke beyond
# GET / (200 = HTML loaded). Add extra paths via SMOKE_PATHS env var.

set -euo pipefail

BASE_URL="${1:-${DEPLOYED_URL:-}}"
if [ -z "$BASE_URL" ]; then
  echo "ERROR: usage: $0 <base-url>" >&2
  exit 1
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

# smart-dining's backend exposes /healthz (from backend/railway.json).
# Override with SMOKE_PATHS for the frontend case (e.g. SMOKE_PATHS='/').
DEFAULT_PATHS="/healthz"
PATHS="${SMOKE_PATHS:-$DEFAULT_PATHS}"

# Per-request timeout in seconds (Railway cold starts can be slow)
TIMEOUT="${SMOKE_TIMEOUT:-15}"

# Allowed status codes (200-299 + 401/403 for protected routes)
ACCEPT_PATTERN='^(2[0-9]{2}|3[0-9]{2})$'

pass=0
fail=0
results=()

check() {
  local path="$1"
  local url="${BASE_URL}${path}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' \
                --max-time "$TIMEOUT" \
                --connect-timeout 5 \
                "$url" 2>/dev/null || echo "000")

  if [[ "$code" =~ $ACCEPT_PATTERN ]]; then
    echo "  ✓ $path → $code"
    pass=$((pass + 1))
    results+=("PASS $path ($code)")
  else
    echo "  ✗ $path → $code"
    fail=$((fail + 1))
    results+=("FAIL $path ($code)")
  fi
}

echo "▶ Smoke-testing smart-dining backend at $BASE_URL"
echo "  paths: $PATHS"
echo "  timeout: ${TIMEOUT}s per request"
echo

IFS=',' read -ra PATH_ARR <<< "$PATHS"
for p in "${PATH_ARR[@]}"; do
  p="${p#"${p%%[![:space:]]*}"}"
  check "$p"
done

echo
echo "────────────────────"
echo "Results: $pass passed, $fail failed"
for r in "${results[@]}"; do
  echo "  $r"
done
echo "────────────────────"

if [ "$fail" -gt 0 ]; then
  echo "✗ Smoke test FAILED" >&2
  exit 1
fi

echo "✓ Smoke test passed"
