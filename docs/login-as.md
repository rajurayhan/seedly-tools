# Login As (agency)

## What it is

Agency owner or brand admin opens a location as that location’s user. Same job as GHL “login as” for support. Shop name: **Login as location user**.

## Who it is for

Licensed Seedly 5.8.x agencies who help their locations without sharing that user’s password.

## What they get

- Start a session as a user in their own agency / brand
- Banner: “you are X as Y”
- 2FA on the **real** user
- Audit row on start and stop
- Session ends when they stop
- Zip: permissions, overlay, picker, bar — still a module, not a Sulus-only flag

## What it is not

- **Not** Sulus super-admin impersonation. That path stays internal. Do not package or sell it.
- Not “Sulus support logs into a buyer’s Seedly”
- Not writes-as-the-target with no banner

## Phase

3 — after [SeedlyMCP](seedly-mcp.md).

## Packaging

Zip.

## Depends on

- Seedly 5.8.x auth overlay seams (or new files the installer owns)
- [Factory](factory.md)
- Must not copy or expose the current `isSuperAdmin` Login As
