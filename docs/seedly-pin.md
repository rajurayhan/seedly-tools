# SeedlyPin

## What it is

An installable zip. Staff drop a Pin on the page they are looking at. The ticket, screenshot, and diagnostics live in **their** Seedly Convex. Shop name: **SeedlyPin**.

## Who it is for

Licensed Seedly 5.7.x or 5.8.x agencies that want in-CRM bug and work tickets. The seam host is Seedly 5.7 / 5.8. This zip does not change the Seedly git repo — the installer adds files to the buyer folder.

## What they get

- A **Drop Pin** control on the dashboard. Capture includes title, description, priority, viewport screenshot, annotation, optional element pin, optional screen/video, URL, browser, console errors, failed network calls, click activity, and storage **key names** (never values)
- Agency Settings → **Pins**: master on/off, who can drop, who can triage
- A location sidebar **Pins** inbox (list + Kanban, assignment, notes, history)
- REST under `/api/v1/ext/seedly-pin/*` so [SeedlyMCP](seedly-mcp.md) can list, inspect, export diagnostics, and update status. This zip does **not** ship a second MCP server

Pack: `node scripts/pack.mjs seedly-pin` → `dist/seedly-pin-0.1.0.zip`.

Buyer install: owners use [INSTALL.md](../packages/seedly-pin/INSTALL.md). Agents use [AGENTS.md](../packages/seedly-pin/AGENTS.md).

## What it is not

- Not SulusPins, `pins.sulus.ai`, `widget.js`, or a project API key
- Not a guest widget on a public website
- Not GitHub / Jira / Slack forwarding
- Not session replay (rrweb)
- Not a plan toggle under Admin → Plans

## Phase

2 — zip. Standalone. Does not depend on hosted Pins.

## Packaging

Zip. Installer copies owned files, merges factory seams, and inserts marked lines into the buyer dashboard layout and agency settings tabs. It appends OpenAPI paths and, if SeedlyMCP is already installed, pin tools on that zip’s allow-map. Uninstall reverts those lines. Missing insert points are a seam gap.

## Depends on

- Seedly 5.7.x or 5.8.x (dashboard `InitialDataProvider` + agency Settings layout + `extensionApiVersion: 1`)
- [Factory](factory.md)
- Optional: [SeedlyMCP](seedly-mcp.md) for editor-agent tools
