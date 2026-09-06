# Out of scope

Items we planned **not** to sell or build as seedly-tools SKUs.

## Official Dispatch

Seedly already sells Dispatch. Their installer overwrites most extension host files. A Sulus fork would fight that installer. Do not package Dispatch.

## Super-admin Login As (host module)

Do not copy a host `impersonation.ts` / `setSuperAdmin` module into a buyer zip. [Login as location user](login-as.md) is a separate add-on. It may honor an optional `isSuperAdmin` field if the buyer user row already has one. It never writes that field.

## An agent that skips SeedlyMCP

[Native agent](native-agent.md) only writes through [SeedlyMCP](seedly-mcp.md). A third-party chat box with extra tools is not a SKU.

## Generic OAuth kit

Seedly already does Google, Meta, Zoom, and Microsoft. A box called “OAuth” confuses buyers. Sell a [named connector](connectors.md) instead.

## Seedly source

The add-on license does not grant a Seedly license. Zips must not include CRM core files, `SETUP/`, `LICENSE.md`, `SUPPORT.md`, or `convex/http.ts`.

## Marketplace and license-key server

Not in this catalog. Zips are enough for now.

## Live install into our CRM to “try it”

Factory tests use `fixtures/seedly-host/`. Do not seam-merge into a live Seedly checkout (including `seedly/`) to see if a zip works.
