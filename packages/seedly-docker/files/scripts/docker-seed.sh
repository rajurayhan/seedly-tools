#!/usr/bin/env bash
# Load demo CRM data + Better Auth login accounts into the self-hosted Docker backend.
set -euo pipefail

URL="${CONVEX_SELF_HOSTED_URL:-http://convex-backend:3210}"
KEY="$(tr -d '[:space:]' < /keys/admin_key)"
# Flags after the subcommand — `convex --url … env set` is rejected by current CLI.
CLI=(pnpm exec convex)
FLAGS=(--url "$URL" --admin-key "$KEY")

# seedAll / seedDevBaUser refuse to run unless this starts with "dev:".
# Self-hosted Docker has no Convex Cloud "dev:…" name, so we set one.
"${CLI[@]}" env set "${FLAGS[@]}" CONVEX_DEPLOYMENT "dev:docker-local"

"${CLI[@]}" run "${FLAGS[@]}" seed:seedAll

seed_login() {
  local email="$1"
  local password="$2"
  "${CLI[@]}" run "${FLAGS[@]}" actions/seedDevUser:seedDevBaUser \
    "{\"email\":\"${email}\",\"password\":\"${password}\"}"
}

# Demo Acme accounts (CRM rows come from seedAll).
seed_login "owner@acme.dev" "test-password-owner"
seed_login "admin@acme.dev" "test-password-admin"
seed_login "user@acme.dev" "test-password-user"

echo "Demo logins ready: owner@acme.dev / admin@acme.dev / user@acme.dev"
