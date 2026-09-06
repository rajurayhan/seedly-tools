# HighLevel import — agent install playbook

Owner twin: [INSTALL.md](INSTALL.md). Shared agent rules: [../../docs/install-agents.md](../../docs/install-agents.md). Factory: [../../docs/factory.md](../../docs/factory.md).

## Never

- Edit `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`
- Install into a live CRM to test. Use `fixtures/seedly-host/`
- Deploy Convex without a fresh owner yes
- Ask the owner for a HighLevel **write** token. Read-only PIT only.

## Install

CWD = Seedly 5.7.x or 5.8.x checkout:

```
node /ABS/ghl-import-0.1.0/bin/install.mjs --seedly .
```

Then from the host:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

Plan feature: `ghl_import` / **HighLevel import**. Sidebar: `/import`.

## Verify

```
node /ABS/ghl-import-0.1.0/bin/doctor.mjs --seedly /ABS/seedly
```

`.modules.json` lists `ghl-import`. `ownedFiles` does not include `convex/http.ts`. `extension-plan-features.ts` stays zero-import.

## Uninstall

```
node /ABS/ghl-import-0.1.0/bin/uninstall.mjs --seedly /ABS/seedly --yes
```

Dispatch / GoSeedly stay. Owner empties leftover `ghl*` tables before the next backend deploy.

## Pack

```
node scripts/pack.mjs ghl-import
```
