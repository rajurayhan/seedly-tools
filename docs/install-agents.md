# Install a Seedly add-on (for AI agents)

Audience: an agent installing a **buyer zip** into a licensed Seedly 5.8.x checkout. This is not a CRM repo. Do not treat `seedly-tools` as the host.

Owner-facing twin: [install-owners.md](install-owners.md). Factory rules: [factory.md](factory.md).

SKU playbooks (prefer these when the zip is named):

- [SeedlyMCP AGENTS.md](../packages/seedly-mcp/AGENTS.md)
- [HighLevel import AGENTS.md](../packages/ghl-import/AGENTS.md)

## Hard rules

- Never edit `SETUP/`, `LICENSE.md`, `SUPPORT.md`, or `convex/http.ts`.
- Never overwrite shared seams. Merge only (`convex/extensions/*`, `apps/web/lib/extensions.ts`, `extension-plan-features.ts`, `extension-public-paths.ts`).
- Never run `npx convex deploy` or `--prod` unless the owner typed yes for that exact command.
- Never install into a live CRM checkout to “try” the installer. Fixture only: `fixtures/seedly-host/`.
- Never invent a parallel feature. If the host already has a half-wired path, fix or wire that.
- Do not clone this monorepo onto the buyer machine. They unzip a zip. The toolkit is already inside it.

## Detect the host

The Seedly folder must have `apps/`, `convex/`, and `package.json` with `version` in `>=5.8.0 <5.9.0` and `extensionApiVersion: 1`.

```
node bin/install.mjs --seedly /absolute/path/to/seedly
```

Run that from the **unzipped zip**, or pass the absolute path to `bin/install.mjs`. `--seedly .` is correct only when the current working directory is the CRM, not the zip.

Flags: `--dry-run`, `--skip-typecheck`. Default install may run the host web typecheck.

## After install

From the Seedly folder:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

Remind the owner: Vercel/website deploy is their usual frontend publish. Convex backend changes need `npx convex deploy` — explain first, wait for yes.

Turn the plan feature on in Admin → Plans. The key is in the SKU playbook (`seedly_mcp`, `ghl_import`, …).

## Verify

```
node bin/doctor.mjs --seedly /absolute/path/to/seedly
```

Doctor must pass. Confirm `.modules.json` lists the module, `ownedFiles` does not include shared seams or `convex/http.ts`, and zero-import leaves still have no `import` lines.

## Uninstall

```
node bin/uninstall.mjs --seedly /absolute/path/to/seedly --yes
```

`--yes` is required. Dispatch / GoSeedly / other modules must remain. Leftover Convex tables are the owner’s cleanup before the next backend deploy.

## Tests (this repo, not the buyer)

```
node --test packages/toolkit/src/__tests__/*.test.mjs
```

Uses `fixtures/seedly-host/` only.
