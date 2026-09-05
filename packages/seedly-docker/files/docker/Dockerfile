# seedly-crm — Node workspace image (Next.js + Convex CLI)
# Targets: deps (install), dev (compose bind-mount), sync (Coolify one-shot
# convex push, no Next build), prod (next start)

FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssl \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    util-linux \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY scripts/prepare.mjs scripts/prepare.mjs
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/shared/package.json packages/shared/
COPY packages/email/package.json packages/email/
COPY packages/api-client/package.json packages/api-client/
COPY convex/package.json convex/
COPY patches/ patches/

RUN pnpm install --frozen-lockfile

FROM deps AS dev

COPY docker/web-entrypoint.sh /usr/local/bin/web-entrypoint.sh
COPY docker/convex-sync-entrypoint.sh /usr/local/bin/convex-sync-entrypoint.sh
RUN chmod +x /usr/local/bin/web-entrypoint.sh /usr/local/bin/convex-sync-entrypoint.sh

ENV NODE_ENV=development \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true

EXPOSE 3000

# Full workspace copy so `convex dev --once` can push without bind-mounts.
# Used by compose.coolify.yaml. Do not run `next build` here — that is `prod`.
FROM deps AS sync

COPY . .
COPY docker/convex-sync-entrypoint.sh /usr/local/bin/convex-sync-entrypoint.sh
RUN chmod +x /usr/local/bin/convex-sync-entrypoint.sh

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

ENTRYPOINT ["/usr/local/bin/convex-sync-entrypoint.sh"]

FROM deps AS prod

COPY . .

ARG NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
ARG NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000

# NEXT_PUBLIC_* is loopback so the browser can reach published ports.
# CONVEX_* is the compose service name so the Node server does not call
# 127.0.0.1 inside this container (that is itself, not Convex).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL \
    NEXT_PUBLIC_CONVEX_SITE_URL=$NEXT_PUBLIC_CONVEX_SITE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    CONVEX_URL=http://convex-backend:3210 \
    CONVEX_SITE_URL=http://convex-backend:3211

RUN pnpm --filter @seedly-crm/web build

EXPOSE 3000

CMD ["pnpm", "--filter", "@seedly-crm/web", "start"]
