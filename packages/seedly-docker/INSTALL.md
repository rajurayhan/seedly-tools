# Seedly Docker — install guide (for owners)

This guide is for a licensed **Seedly 5.7 or 5.8** owner. You do not need to be a programmer. If an assistant is doing the install, give them [AGENTS.md](AGENTS.md).

This zip lets you run your Seedly on your computer with Docker. Convex (the database) runs in Docker too. You do not log in to Convex Cloud. This zip is not a CRM.

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

## Before you start

- Seedly 5.7 or 5.8 is already on your computer. You know the **Seedly folder** (`apps`, `convex`, and `package.json`).
- This add-on is unzipped (`seedly-docker-0.1.0` with a `bin` folder inside).
- You can open Terminal (Mac) or PowerShell (Windows).

## 1. Install the files

In Terminal, go to the **Seedly folder** (not the unzipped add-on):

```
node /path/to/seedly-docker-0.1.0/bin/install.mjs --seedly .
```

On a Mac: type `node `, drag the unzipped folder onto the window, then type `/bin/install.mjs --seedly .` and press Return.

**What you should see:** `Installed seedly-docker`. That copies files and patches a few Seedly files (Convex URLs, cookie name `seedly-crm`, and trust for http://localhost:3100). It does not start Docker yet.

If you already installed an older copy of this zip, run that same `install.mjs` command again so the cookie / :3100 patches apply. Otherwise sign-in can stay blank (`get-session` null) when another CRM is also open on localhost.

## 2. Start Docker (recommended: hybrid)

This keeps the website on your computer so edits show up immediately. Convex stays in Docker.

```
make -f docker.mk docker-up-backend
cp apps/web/.env.docker-hybrid.example apps/web/.env.local
npx pnpm --filter @seedly-crm/web exec next dev --port 3100
```

Then open http://localhost:3100.

Do **not** set `CONVEX_DEPLOYMENT` in `apps/web/.env.local`. That binds Convex Cloud and fights this stack.

### All-in-Docker instead

```
make -f docker.mk docker-up
```

First boot takes a few minutes.

## 3. Sign in

Sign-up is turned off. After Convex is up:

```
make -f docker.mk docker-seed
```

Then sign in as:

| Email | Password |
| --- | --- |
| `owner@acme.dev` | `test-password-owner` |
| `admin@acme.dev` | `test-password-admin` |
| `user@acme.dev` | `test-password-user` |

## 4. What still needs the internet

Self-hosted Convex replaces Convex Cloud only. Twilio, email, Stripe, Google, and Zoom still go out. For inbound webhooks on your laptop, point the provider at a tunnel to `http://127.0.0.1:3311`.

## Check / remove

```
node /path/to/seedly-docker-0.1.0/bin/doctor.mjs --seedly .
node /path/to/seedly-docker-0.1.0/bin/uninstall.mjs --seedly . --yes
```

More operator detail after install: `docker/README.md` in your Seedly folder.

Shared owner steps for any zip: [../../docs/install-owners.md](../../docs/install-owners.md).
