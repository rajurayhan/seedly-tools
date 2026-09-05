#!/bin/sh
# Generate a Convex admin key once and persist it on the shared keys volume.
set -eu

key_ok() {
  [ -s /keys/admin_key ] || return 1
  [ "$(tr -d '[:space:]' < /keys/admin_key | wc -c)" -gt 16 ]
}

if key_ok; then
  echo "[convex-init] admin key already present"
  exit 0
fi

SCRIPT=""
for candidate in \
  ./generate_admin_key.sh \
  /convex/generate_admin_key.sh \
  /usr/local/bin/generate_admin_key.sh
do
  if [ -f "$candidate" ]; then
    SCRIPT="$candidate"
    break
  fi
done

if [ -z "$SCRIPT" ]; then
  echo "[convex-init] generate_admin_key.sh not found in the backend image" >&2
  ls -la / /convex 2>/dev/null || true
  exit 1
fi

echo "[convex-init] generating admin key via $SCRIPT"
# The official script is bash (`source ./read_credentials.sh`).
bash "$SCRIPT" | tr -d '\r' | awk 'NF { line=$0 } END { print line }' > /keys/admin_key

if ! key_ok; then
  echo "[convex-init] generate_admin_key.sh produced an empty key" >&2
  cat /keys/admin_key >&2 || true
  exit 1
fi

echo "[convex-init] admin key written"
