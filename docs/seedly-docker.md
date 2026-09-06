# Seedly Docker

## What it is

A free, login-gated zip that installs a local Docker Compose stack into a licensed Seedly 5.7 or 5.8 folder. Convex runs self-hosted. The buyer does not need Convex Cloud for this path.

## Who it is for

Licensed Seedly 5.7.x or 5.8.x owners who want the CRM on their computer (or a later Coolify VPS via [Seedly Coolify](seedly-coolify.md)).

## What they get

- `compose.yaml` / `compose.prod.yaml`, `docker/`, `docker.mk`, env examples
- Demo seed (`owner@acme.dev` and friends) — not Sulus operator accounts
- A small helper under `apps/web/lib/seedly-docker/`
- Install-time patches (`bin/install.mjs` → `bin/patch-host.mjs`): self-host URL / CSP / PDF call sites; `cookiePrefix: 'seedly-crm'` + middleware; trust `http://localhost:3100` so get-session is not null when sulus-crm is also on localhost

## What it is not

- Not a CRM
- Not a plan toggle
- Not the Coolify VPS pack ([Seedly Coolify](seedly-coolify.md) includes this runtime)

## Phase

1 — on the shelf. Zip installs on `fixtures/seedly-host/`.

## Packaging

Zip only. Marketplace listing `seedly-docker`, `price_cents: 0`.

## Depends on

Seedly `>=5.7.0 <5.9.0` and `extensionApiVersion: 1`. Docker Desktop for the local path.
