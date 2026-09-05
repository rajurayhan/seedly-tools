# Sulus Seedly add-ons

Installable add-ons for licensed **Seedly 5.8.x** owners. This repo is not a CRM. Each package packs a zip that a buyer drops into their own Seedly folder.

## Who this is for

- **Us:** build and pack add-ons here.
- **Buyers:** already own Seedly 5.8. They unzip one add-on and run its installer. They never clone this monorepo.

## Catalog

Every planned item is written up in [docs/](docs/README.md).

| Item | Status |
| --- | --- |
| [Factory](docs/factory.md) | Built (`packages/toolkit`) |
| [HighLevel import](docs/ghl-import.md) | On the shelf (`packages/ghl-import`) |
| [SeedlyMCP](docs/seedly-mcp.md) | On the shelf (`packages/seedly-mcp`) |
| [SeedlyPin](docs/seedly-pin.md) | Planned — hosted + thin zip |
| [Login As](docs/login-as.md) | Planned — agency only |
| [Native agent](docs/native-agent.md) | Planned — after SeedlyMCP |
| [Connectors](docs/connectors.md) | Planned — named system, not “OAuth” |
| [Out of scope](docs/out-of-scope.md) | Will not sell |

## Packages on disk today

| Package | What a buyer gets |
| --- | --- |
| `packages/ghl-import` | HighLevel import: sidebar Import row, read-only GHL token, dry-run then import |
| `packages/seedly-mcp` | SeedlyMCP: local stdio + remote `/seedly-mcp` for Cursor / Claude |
| `packages/toolkit` | Shared install / uninstall / pack / doctor. Vendored into every buyer zip |

## Pack a buyer zip

From this folder:

```
node scripts/pack.mjs ghl-import
node scripts/pack.mjs seedly-mcp
```

Writes `dist/<sku>-<version>.zip`. The zip includes the toolkit so the buyer does not need this repo.

Owner walkthrough: [docs/install-owners.md](docs/install-owners.md). Agent playbook: [docs/install-agents.md](docs/install-agents.md).

## How a buyer installs

1. Unzip the add-on.
2. In their Seedly folder (the one with `apps`, `convex`, and `package.json`):

```
node /path/to/ghl-import-0.1.0/bin/install.mjs --seedly .
```

3. Then `npx pnpm install` and their usual website deploy. If backend files changed, they run `npx convex deploy` themselves. The installer never deploys.

Seedly 5.8.x only. The installer merges next to Dispatch / GoSeedly. It never overwrites those shared seams.

License terms for the add-on source are in [ADDON-LICENSE.md](ADDON-LICENSE.md). This is not a Seedly license.

## Tests

```
node --test packages/toolkit/src/__tests__/*.test.mjs packages/seedly-mcp/src/__tests__/*.test.mjs
```

Tests use `fixtures/seedly-host/`. They do not install into a real CRM checkout.
