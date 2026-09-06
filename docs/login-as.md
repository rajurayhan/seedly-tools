# Login as location user

## What it is

An installable zip. An agency owner opens a location as that location’s user without sharing a password. Same job as HighLevel “login as” for support. Shop name: **Login as location user**.

## Who it is for

Licensed Seedly 5.8.x agencies. The seam host is Seedly 5.8.0. This zip does not change the Seedly git repo — the installer adds files to the buyer folder.

## What they get

- Agency owner starts a session as a user in their own agency
- Optional Super Admin: if the buyer user row has `isSuperAdmin === true`, search is system-wide and the plan toggle is not required. Stock Seedly 5.8 has no such field
- Banner: “you are X as Y”
- 2FA enrollment on the **real** user
- Audit row on start and stop
- Session ends on stop or sign-out
- Plan toggle: **Login as location user** (`login_as`)

Pack: `node scripts/pack.mjs login-as` → `dist/login-as-0.1.0.zip`.

Buyer install: owners use [INSTALL.md](../packages/login-as/INSTALL.md). Agents use [AGENTS.md](../packages/login-as/AGENTS.md).

## What it is not

- Not a copy of any host `impersonation.ts` / `setSuperAdmin` module
- Not brand admin, agency admin, or location-user Login As
- Not writes-as-the-target with no banner
- Not a cookie or middleware identity

## Phase

3 — zip. Pin can stay earlier on paper; this SKU does not depend on it.

## Packaging

Zip. Installer copies owned files, merges factory seams, and inserts marked lines into the buyer `getAuthContext`, action-auth, dashboard layout, and topbar. Uninstall reverts those lines. Missing insert points are a seam gap.

## Depends on

- Seedly 5.8.x (`getAuthContext` + dashboard `InitialDataProvider` + user menu)
- [Factory](factory.md)
