# Seedly tools catalog

This folder is the product list for **seedly-tools**. It is for us (what we are building) and for a future buyer (what they get).

The buyer is a licensed **Seedly 5.8.x** owner. This repo is not a CRM. Zips install into their Seedly folder.

Do not add SKUs here that are not on this list.

## Phase order

1. [HighLevel import](ghl-import.md) — on the shelf
2. [SeedlyMCP](seedly-mcp.md) — on the shelf ([build sheet](seedly-mcp-build.md))
3. [Seedly Docker](seedly-docker.md) — free local self-host pack
4. [Seedly Coolify](seedly-coolify.md) — free VPS self-host pack (includes Docker)
5. [SeedlyPin](seedly-pin.md) — in-CRM Pins (Convex + REST for SeedlyMCP)
6. [Login as location user](login-as.md) — agency owner opens a location as that user
7. [Native agent](native-agent.md) — dashboard helper that only uses SeedlyMCP
8. [Connectors](connectors.md) — first named outbound system, not a generic OAuth kit

How we pack and install: [Factory](factory.md). Owner steps: [install-owners.md](install-owners.md). Agent playbook: [install-agents.md](install-agents.md).

What we will not sell: [Out of scope](out-of-scope.md).

## Status

| Item | Phase | Packaging | Status |
| --- | --- | --- | --- |
| Factory (toolkit) | — | Vendored into every zip | Built |
| HighLevel import | 0 | Zip | On the shelf |
| SeedlyMCP | 1 | Zip | On the shelf |
| Seedly Docker | 1 | Zip (free) | On the shelf |
| Seedly Coolify | 1 | Zip (free) | On the shelf |
| SeedlyPin | 2 | Zip | On the shelf |
| Login as location user | 3 | Zip | On the shelf |
| Native agent | 4 | Zip | Planned |
| First connector | 5 | Zip | Planned |

No marketplace and no license-key server in this catalog.
