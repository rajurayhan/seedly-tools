# Docker — local Seedly (including Convex)

This stack runs a **self-hosted Convex backend** in Docker. You do not log in to Convex Cloud.

## Editing the UI (hybrid — default)

Next.js on the host. Convex in Docker.

```bash
make -f docker.mk docker-up-backend
cp apps/web/.env.docker-hybrid.example apps/web/.env.local   # once
npx pnpm --filter @seedly-crm/web dev
```

Then open http://localhost:3000.

Do **not** set `CONVEX_DEPLOYMENT` in `apps/web/.env.local`.

## Full Docker

```bash
make -f docker.mk docker-up
```

| Service | Host URL | Role |
| --- | --- | --- |
| `web` | http://localhost:3000 | Next.js |
| `convex-backend` | http://127.0.0.1:3210 | Convex DB + functions |
| HTTP actions | http://127.0.0.1:3211 | Auth + webhooks |
| `convex-dashboard` | http://localhost:6791 | Convex dashboard |

## Production-like local

```bash
make -f docker.mk docker-up-prod
```

Built `next start`. Not a hardened VPS deploy.

## Commands

```bash
make -f docker.mk docker-env
make -f docker.mk docker-up-backend
make -f docker.mk docker-up
make -f docker.mk docker-up-prod
make -f docker.mk docker-down
make -f docker.mk docker-seed
make -f docker.mk docker-reset
```

Sign-up is disabled. After Convex is up, run `docker-seed` and sign in as `owner@acme.dev` / `test-password-owner`.

## What is still not offline

Twilio, email, Stripe, Meta, Google, and Zoom still need the internet. Point inbound webhooks at a tunnel to `http://127.0.0.1:3211`.

## Env

- **`.env.docker`** — compose + containers. Generated from `.env.docker.example`. Do not commit it.
- **`apps/web/.env.local`** — host Next.js in hybrid mode. Copy from `apps/web/.env.docker-hybrid.example`.

Never rotate `INSTANCE_SECRET` after the first successful boot.
