#!/usr/bin/env bash
set -euo pipefail

cd /app

mkdir -p /app/node_modules
# Lockfile is bind-mounted from the Mac (often :ro). Never rewrite it in the container.
flock /app/node_modules/.install.lock pnpm install --frozen-lockfile

exec pnpm --filter @seedly-crm/web exec next dev --hostname 0.0.0.0 --port 3000
