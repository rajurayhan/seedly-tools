# Seedly Docker — agent install playbook

Owner twin: [INSTALL.md](INSTALL.md). Shared agent rules: [../../docs/install-agents.md](../../docs/install-agents.md). Factory: [../../docs/factory.md](../../docs/factory.md).

## Never

- Edit `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`
- Claim `apps/web/lib/auth-server.ts` or `apps/web/lib/security-headers.ts` as ownedFiles
- Install into a live CRM to test. Use `fixtures/seedly-host/`
- Deploy Convex without a fresh owner yes
- Ship `sulusDockerSeed` or `raju@` / `josh@` operator grants
- Set `CONVEX_DEPLOYMENT` in Docker env

## Install

CWD = Seedly 5.7.x or 5.8.x checkout:

```
node /ABS/seedly-docker-0.1.0/bin/install.mjs --seedly .
```

That copies compose / docker / helpers, then `bin/patch-host.mjs` (called from `install.mjs`) applies host patches. Already-patched files are left alone.

Install is the patch command. Dry-run:

```
node /ABS/seedly-docker-0.1.0/bin/install.mjs --seedly . --dry-run
```

Patches (string ops only, never overwrite the file):

- `apps/web/lib/auth-server.ts` + QR/CSP/PDF call sites — self-host Convex URLs if they still read `NEXT_PUBLIC_*` only
- `convex/authOptions.ts` — `cookiePrefix: 'seedly-crm'` so localhost cookies do not collide with sulus-crm on `:3000` (browsers share cookies across ports)
- `apps/web/middleware.ts` — `getSessionCookie(..., { cookiePrefix: 'seedly-crm' })`
- `convex/auth.ts` — trust `http://localhost:3100` and `http://127.0.0.1:3100`

If an older zip was already installed, re-run the same `install.mjs` command so these patches apply.

There is no plan feature toggle.

## Start

```
make -f docker.mk docker-up-backend
# or: make -f docker.mk docker-up
make -f docker.mk docker-seed
```

## Verify

```
node /ABS/seedly-docker-0.1.0/bin/doctor.mjs --seedly /ABS/seedly
```

`.modules.json` lists `seedly-docker`. `ownedFiles` does not include `convex/http.ts` or `security-headers.ts`.

## Uninstall

```
node /ABS/seedly-docker-0.1.0/bin/uninstall.mjs --seedly /ABS/seedly --yes
```

Revert runs first (only lines this zip added). Dispatch / GoSeedly stay.

## Pack

```
node scripts/pack.mjs seedly-docker
```
