# Factory

## What it is

The shared installer toolkit. Every sellable zip uses the same pack / install / uninstall / doctor path so the next add-on does not copy-paste HighLevel import.

## Who it is for

Us, when we add a package under `packages/`. Buyers never clone this monorepo. They get a copy of the toolkit inside their unzipped folder.

## What they get

- `node scripts/pack.mjs <sku>` writes `dist/<sku>-<version>.zip`
- Buyer runs `node bin/install.mjs --seedly .` from their Seedly folder
- Installer copies owned files, **merges** shared seams, writes `.modules.json`
- Optional typecheck is **their** CRM, not ours
- Uninstall strips only that module. Dispatch / GoSeedly stay
- Doctor checks owned files, seams, and that the module does not claim shared seams

The installer never deploys. The buyer runs `npx convex deploy` themselves when they mean to.

## What it is not

- Not a CRM
- Not a store or license server
- Not Official Dispatch’s installer (that one **overwrites** most extension files). We only append.

## Phase

Always on. New SKUs are new `packages/<name>` folders plus `module.json` and `seams.json`.

## Packaging

Vendored into every buyer zip (`toolkit/` next to `bin/`).

## Depends on

Seedly 5.8.x (`seedlyRange` and `extensionApiVersion: 1`).

## Rules

**Merge, never overwrite** shared seams:

- `convex/extensions/index.ts`, `snapshot.ts`, `crons.ts`, `apiRoutes.ts`
- `apps/web/lib/extensions.ts`, `extension-plan-features.ts`
- `convex/http.ts` is forbidden. REST goes through `apiRoutes.ts`. Inbound webhooks go through `integrationWebhooks.ts`.

**Never copy:** `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`.

**Zero-import leaves** (literals only, no `import` lines): plan features, public paths, headers, palettes, integration cards.

**Tests** use `fixtures/seedly-host/`. Do not dry-run install into a live CRM checkout.

Owner walkthrough (any zip): [install-owners.md](install-owners.md). Agent playbook: [install-agents.md](install-agents.md).

## Buyer install (any zip)

1. Unzip the add-on.
2. In the Seedly folder (has `apps`, `convex`, and `package.json`):

```
node /path/to/<sku>-<version>/bin/install.mjs --seedly .
```

3. `npx pnpm install` and their usual website deploy. If backend files changed, they run `npx convex deploy`.
