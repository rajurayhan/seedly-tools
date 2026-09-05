# Seedly Coolify

## What it is

A free, login-gated zip that installs Coolify compose + the local Docker runtime into a licensed Seedly 5.8 folder. One zip. The buyer does not also need [Seedly Docker](seedly-docker.md).

## Who it is for

Licensed Seedly 5.8.x owners who want the CRM on a VPS with Coolify’s HTTPS proxy. No Convex Cloud. No Vercel.

## What they get

- Everything in Seedly Docker
- `compose.coolify.yaml`, `.env.coolify.example`, `docker/Dockerfile.convex-init`
- The same install-time host patches

## What it is not

- Not a CRM
- Not a Coolify installer (they still install Coolify on the VPS)
- Not our internal `sulusDockerSeed` operator grant

## Phase

1 — on the shelf. Zip installs on `fixtures/seedly-host/`.

## Packaging

Zip only. Marketplace listing `seedly-coolify`, `price_cents: 0`.

## Depends on

Seedly 5.8.x and `extensionApiVersion: 1`. A VPS + Coolify for the deploy path.
