# Login as location user — agent install playbook

Owner twin: [INSTALL.md](INSTALL.md). Shared agent rules: [../../docs/install-agents.md](../../docs/install-agents.md). Factory: [../../docs/factory.md](../../docs/factory.md).

## Never

- Edit `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`
- Claim `convex/_helpers.ts`, dashboard `layout.tsx`, or `topbar.tsx` as ownedFiles
- Install into a live CRM to test. Use `fixtures/seedly-host/`
- Deploy Convex without a fresh owner yes
- Copy or expose a host `impersonation.ts` / `setSuperAdmin` module

## Install

CWD = Seedly 5.7.x or 5.8.x checkout:

```
node /ABS/login-as-0.1.0/bin/install.mjs --seedly .
```

That copies owned files, merges seams, then `bin/patch-host.mjs` inserts overlay + chrome markers. Missing `getAuthContext` / layout insert points is a **seam gap** — stop.

Then from the host:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

Plan feature: `login_as` / **Login as location user**. User menu item, not a sidebar row.

## Verify

```
node /ABS/login-as-0.1.0/bin/doctor.mjs --seedly /ABS/seedly
```

`.modules.json` lists `login-as`. `ownedFiles` does not include `convex/http.ts` or `_helpers.ts`. `extension-plan-features.ts` stays zero-import. `_helpers.ts` contains `applyAddonLoginAsOverlay`.

## Uninstall

```
node /ABS/login-as-0.1.0/bin/uninstall.mjs --seedly /ABS/seedly --yes
```

Revert runs first (only lines this zip added). Dispatch / other add-ons stay.

## Pack

```
node scripts/pack.mjs login-as
```
