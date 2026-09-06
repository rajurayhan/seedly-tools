# Seedly Coolify — install guide (for owners)

This guide is for a licensed **Seedly 5.7 or 5.8** owner. You do not need to be a programmer. If an assistant is doing the install, give them [AGENTS.md](AGENTS.md).

This zip lets you run your Seedly on a VPS with Coolify. Convex (the database) runs on the same box. You do not log in to Convex Cloud. This zip is not a CRM.

You need a VPS and a Coolify install. The zip also includes local Docker files if you want to try the stack on your computer first (`make -f docker.mk docker-up`).

## Before you start

- Seedly 5.7 or 5.8 is already on your computer. You know the **Seedly folder** (`apps`, `convex`, and `package.json`).
- This add-on is unzipped (`seedly-coolify-0.1.0` with a `bin` folder inside).
- You can open Terminal (Mac) or PowerShell (Windows).

## 1. Install the files

In the **Seedly folder**:

```
node /path/to/seedly-coolify-0.1.0/bin/install.mjs --seedly .
```

**What you should see:** `Installed seedly-coolify`. That only copies files and applies a few URL patches. It does not deploy yet.

## 2. Coolify on the server (once)

1. Point an `A` record for the Coolify admin hostname at the VPS public IP. In Cloudflare, keep it **DNS only** during first setup.
2. Open firewall ports `22`, `80`, `443`, plus `8000` / `6001` / `6002` for the first Coolify login.
3. Do **not** install Docker via Snap. Official installer:

```
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

4. Open `http://VPS_IP:8000`, create the first admin, then set the Coolify instance domain.

The Coolify admin hostname is for Coolify only. Do not attach your CRM to that name.

## 3. Create the CRM resource

1. New Coolify project → Docker Compose resource from **your Seedly folder** (the git repo you deploy).
2. Compose path: `compose.coolify.yaml`. Do not merge it with `compose.yaml`.
3. Assign HTTPS names:

| Service | Container port | Public? |
| --- | --- | --- |
| `web` | 3000 | Yes — the CRM |
| `convex-backend` | 3210 and 3211 | Yes — two names (API, then auth + webhooks) |
| `convex-dashboard` | 6791 | Yes — turn on Coolify Basic Auth |
| `convex-init`, `convex-sync` | — | No |

4. Copy `.env.coolify.example` into the Coolify env editor. Replace every `https://REPLACE_ME` with the exact names from step 3. Generate secrets once:

```
openssl rand -hex 32
openssl rand -base64 32
```

Never rotate `INSTANCE_SECRET` after the first successful boot. Do not set `CONVEX_DEPLOYMENT`. Pin `CONVEX_BACKEND_TAG` to a released tag.

5. Deploy. The first build is slow. `convex-sync` must finish successfully before the website starts.

6. Sign-up is turned off. Seed demo logins with a one-off on `convex-sync`:

```
docker compose -f compose.coolify.yaml run --rm --no-deps --entrypoint /bin/bash convex-sync /app/scripts/docker-seed.sh
```

Then sign in as `owner@acme.dev` / `test-password-owner`.

## 4. Later: real domains

Change the three public names, update the matching env vars, then **rebuild** (`NEXT_PUBLIC_*` is baked into the website image). Point Stripe / Twilio / email webhooks at the Convex **site** name (port 3211), not the Next.js host.

## What still needs the internet

Self-hosted Convex replaces Convex Cloud only. Twilio, email, Stripe, Google, and Zoom still go out.

## Check / remove

```
node /path/to/seedly-coolify-0.1.0/bin/doctor.mjs --seedly .
node /path/to/seedly-coolify-0.1.0/bin/uninstall.mjs --seedly . --yes
```

Shared owner steps for any zip: [../../docs/install-owners.md](../../docs/install-owners.md).
