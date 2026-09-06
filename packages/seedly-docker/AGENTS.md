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

That copies compose / docker / helpers, then `bin/patch-host.mjs` patches host URL + CSP call sites if they still read `NEXT_PUBLIC_CONVEX_*` only. Hosts that already have `getServerConvexUrl` are left alone.

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
