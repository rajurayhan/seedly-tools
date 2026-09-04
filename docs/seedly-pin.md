# SeedlyPin

## What it is

Work and bug tickets for a Seedly shop, with a widget inside their dashboard. The product is Pins (hosted). The add-on is the hook.

## Who it is for

Licensed Seedly 5.8.x owners who want tickets in the CRM, not another Notion.

## What they get

- A Pins project on the hosted Pins site (billing, projects, API keys)
- A thin zip: widget mount + plan toggle
- CSP for the widget on the host’s `extension-headers.ts` seam (zero-import). Do not hand-edit core security headers

## What it is not

- Not Pins rebuilt inside Convex
- Not Sulus-only operator tickets
- Not a zip that includes the Pins backend

## Phase

2 — after [SeedlyMCP](seedly-mcp.md) is installable. Can be scoped in parallel once Phase 1 is on the shelf.

## Packaging

Hosted + thin zip.

## Depends on

- Hosted Pins (already running)
- Seedly 5.8.x widget seam / dashboard layout the installer can mount
- [Factory](factory.md) for the thin zip
