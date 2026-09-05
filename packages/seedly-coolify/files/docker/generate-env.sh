#!/usr/bin/env bash
# Create .env.docker from the example and fill empty secrets once.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.env.docker.example"
DEST="$ROOT/.env.docker"

if [ ! -f "$SRC" ]; then
  echo "missing $SRC" >&2
  exit 1
fi

if [ ! -f "$DEST" ]; then
  cp "$SRC" "$DEST"
  echo "created $DEST"
else
  echo "using existing $DEST"
fi

hex32() { openssl rand -hex 32; }
b64() { openssl rand -base64 32 | tr -d '\n'; }

replace_if_empty() {
  local key="$1"
  local value="$2"
  local current
  current="$(grep -E "^${key}=" "$DEST" | head -n 1 | cut -d= -f2- || true)"
  if [ -z "$current" ] || [ "$current" = "CHANGE_ME" ]; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$DEST"
    else
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$DEST"
    fi
    echo "  generated $key"
  fi
}

replace_if_empty INSTANCE_SECRET "$(hex32)"
replace_if_empty ENCRYPTION_KEY "$(hex32)"
replace_if_empty INTERNAL_API_SECRET "$(hex32)"
replace_if_empty BETTER_AUTH_SECRET "$(b64)"
replace_if_empty UNSUBSCRIBE_SECRET "$(b64)"
replace_if_empty PREFERENCES_SECRET "$(b64)"

echo "Docker env ready: $DEST"
