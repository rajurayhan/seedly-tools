#!/usr/bin/env bash
# Push convex/ functions into the self-hosted backend and keep them in sync.
set -euo pipefail

cd /app

echo "[convex-sync] waiting for backend at ${CONVEX_SELF_HOSTED_URL:-http://convex-backend:3210} ..."
for _ in $(seq 1 90); do
  if curl -sf "${CONVEX_SELF_HOSTED_URL:-http://convex-backend:3210}/version" >/dev/null; then
    echo "[convex-sync] backend is up"
    break
  fi
  sleep 2
done

if ! curl -sf "${CONVEX_SELF_HOSTED_URL:-http://convex-backend:3210}/version" >/dev/null; then
  echo "[convex-sync] backend never became healthy" >&2
  exit 1
fi

echo "[convex-sync] waiting for admin key ..."
for _ in $(seq 1 45); do
  if [ -s /keys/admin_key ]; then
    break
  fi
  sleep 2
done

if [ ! -s /keys/admin_key ] || [ "$(tr -d '[:space:]' < /keys/admin_key | wc -c)" -le 16 ]; then
  echo "[convex-sync] /keys/admin_key is missing or empty — convex-init failed?" >&2
  exit 1
fi

# Host .env.local may still point at Convex Cloud. Do not let that win in Docker.
unset CONVEX_DEPLOYMENT || true
export CONVEX_SELF_HOSTED_URL="${CONVEX_SELF_HOSTED_URL:-http://convex-backend:3210}"
export CONVEX_SELF_HOSTED_ADMIN_KEY
CONVEX_SELF_HOSTED_ADMIN_KEY="$(tr -d '[:space:]' < /keys/admin_key)"

mkdir -p /app/node_modules
# Lockfile is bind-mounted from the Mac (often :ro). Never rewrite it in the container.
flock /app/node_modules/.install.lock pnpm install --frozen-lockfile

CONVEX_CLI=(--url "$CONVEX_SELF_HOSTED_URL" --admin-key "$CONVEX_SELF_HOSTED_ADMIN_KEY")

set_env() {
  local key="$1"
  local value="${2:-}"
  if [ -z "$value" ]; then
    echo "[convex-sync] skip empty $key"
    return 0
  fi
  echo "[convex-sync] convex env set $key"
  pnpm exec convex env set "${CONVEX_CLI[@]}" "$key" "$value" >/dev/null
}

set_env BETTER_AUTH_SECRET "${BETTER_AUTH_SECRET:-}"
set_env UNSUBSCRIBE_SECRET "${UNSUBSCRIBE_SECRET:-}"
set_env PREFERENCES_SECRET "${PREFERENCES_SECRET:-}"
set_env ENCRYPTION_KEY "${ENCRYPTION_KEY:-}"
set_env INTERNAL_API_SECRET "${INTERNAL_API_SECRET:-}"
set_env SITE_URL "${SITE_URL:-http://localhost:3000}"
set_env FRONTEND_URL "${FRONTEND_URL:-http://localhost:3000}"
set_env NEXT_PUBLIC_APP_URL "${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
set_env INTERNAL_APP_URL "${INTERNAL_APP_URL:-http://web:3000}"

if [ "${CONVEX_SYNC_ONCE:-}" = "1" ]; then
  echo "[convex-sync] one-shot push to self-hosted backend"
  pnpm exec convex dev --once --typecheck disable "${CONVEX_CLI[@]}"
  exit 0
fi

echo "[convex-sync] initial function push"
pnpm exec convex dev --once --typecheck disable "${CONVEX_CLI[@]}"

echo "[convex-sync] watching convex/ for further changes"
exec pnpm exec convex dev --typecheck disable --tail-logs "${CONVEX_CLI[@]}"
