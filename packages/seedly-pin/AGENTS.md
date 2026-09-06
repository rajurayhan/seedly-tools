# SeedlyPin — agent install playbook

Owner twin: [INSTALL.md](INSTALL.md). Shared agent rules: [../../docs/install-agents.md](../../docs/install-agents.md). Factory: [../../docs/factory.md](../../docs/factory.md).

## Never

- Edit `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`
- Claim dashboard `layout.tsx` or agency `settings/layout.tsx` as ownedFiles
- Install into a live CRM to test. Use `fixtures/seedly-host/`
- Deploy Convex without a fresh owner yes
- Mount `SulusPinWidget`, load `widget.js`, or add a Pins API key
- Add a plan feature key (`seedly_pin` in Admin → Plans is out of scope)

## Install

CWD = Seedly 5.7.x or 5.8.x checkout:

```
node /ABS/seedly-pin-0.1.0/bin/install.mjs --seedly .
```

That copies owned files, merges seams, then `bin/patch-host.mjs` inserts the FAB, the Settings → Pins tab, OpenAPI paths, and SeedlyMCP allow-map entries when that file exists. Missing layout / settings insert points is a **seam gap** — stop.

Then from the host:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

Agency owner enables the add-on at **Settings → Pins**. Not Admin → Plans.

If SeedlyMCP is installed, this zip appends pin `operationId`s to `packages/seedly-mcp/lib/allow-map.mjs`. Then run that zip’s `bin/sync-tools.mjs --seedly .` so Cursor / Claude get pin tools. Re-run SeedlyPin install after a later SeedlyMCP reinstall so the allow-map lines come back.

## Verify

```
node /ABS/seedly-pin-0.1.0/bin/doctor.mjs --seedly /ABS/seedly
```

`.modules.json` lists `seedly-pin`. `ownedFiles` does not include `convex/http.ts` or the patched layouts. `extension-plan-features.ts` must **not** gain a `seedly_pin` key.

## Uninstall

```
node /ABS/seedly-pin-0.1.0/bin/uninstall.mjs --seedly /ABS/seedly --yes
```

Revert runs first (only lines this zip added). Dispatch / other add-ons stay.

## Pack

```
node scripts/pack.mjs seedly-pin
```
