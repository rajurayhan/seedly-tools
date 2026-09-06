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

That copies owned files, merges seams, then `bin/patch-host.mjs` inserts the FAB, the Settings → Pins tab, and OpenAPI paths. **Then** it typechecks. Missing layout / settings insert points is a **seam gap** — stop.

If SeedlyMCP is already on the host (`packages/seedly-mcp/lib/allow-map.mjs`), the same install detects it and merges pin tools into `ALLOW_MAP` (never `BLOCKED_V1_TOOLS`), `fallback-tools.mjs`, and `tool-groups.mjs`, then refreshes `tools.mjs`. The merge lives in owned `packages/seedly-pin/src/mcp-bridge.mjs` so a later SeedlyMCP reinstall can re-adopt pin tools without this zip.

Then from the host:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

Agency owner enables the add-on from the **Agency navbar → Pins** (or Agency **Settings → Pins**). Not Admin → Plans. The installer also adds Pins to that Agency list so Superadmin mode can find it.

If you install SeedlyMCP **after** SeedlyPin, that zip’s installer looks for `mcp-bridge.mjs` on the host and re-merges pin tools itself. You do not need to re-run this zip unless the host has an older SeedlyPin without the bridge file.

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
