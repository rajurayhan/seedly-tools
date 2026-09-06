# Seedly Coolify — agent install playbook

Owner twin: [INSTALL.md](INSTALL.md). Shared agent rules: [../../docs/install-agents.md](../../docs/install-agents.md). Factory: [../../docs/factory.md](../../docs/factory.md).

## Never

- Edit `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`
- Claim `auth-server.ts` or `security-headers.ts` as ownedFiles
- Install into a live CRM to test. Use `fixtures/seedly-host/`
- Deploy Convex without a fresh owner yes
- Ship `sulusDockerSeed` or `raju@` / `josh@` operator grants
- Attach the CRM to the Coolify instance hostname
- Set `CONVEX_DEPLOYMENT` in Coolify env
- Rotate `INSTANCE_SECRET` after first boot

## Install

CWD = Seedly 5.7.x or 5.8.x checkout:

```
node /ABS/seedly-coolify-0.1.0/bin/install.mjs --seedly .
```

Same host patches as `seedly-docker`. This zip already includes the local Docker runtime — do not also install `seedly-docker` into the same folder (owned files overlap).

Coolify compose path: `compose.coolify.yaml` (standalone). Env template: `.env.coolify.example`.

## Verify

```
node /ABS/seedly-coolify-0.1.0/bin/doctor.mjs --seedly /ABS/seedly
```

## Uninstall

```
node /ABS/seedly-coolify-0.1.0/bin/uninstall.mjs --seedly /ABS/seedly --yes
```

## Pack

```
node scripts/pack.mjs seedly-coolify
```
