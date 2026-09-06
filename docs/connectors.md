# Connectors

## What it is

One outbound connector at a time: Seedly talks to a named outside system (first candidates: QuickBooks or HubSpot connect). Pick the first name when a buyer asks.

This is **not** a product called “OAuth.” Seedly core already connects Google, Meta, Zoom, and Microsoft.

## Who it is for

Licensed Seedly 5.7.x or 5.8.x owners who need a system Seedly does not already connect.

## What they get

- A named zip (for example QuickBooks, not “OAuth pack”)
- Workflow nodes and/or a cron the operator can see and turn off (no silent subscription)
- Plan toggle for that connector

Inbound “apps sign into this Seedly” is part of [SeedlyMCP](seedly-mcp.md), not this SKU.

## What it is not

- Not a generic “connect anything” OAuth kit
- Not a replacement for core Google / Meta / Zoom / Microsoft
- Not CRMLynk (that stays a Sulus-hosted option, not this zip)
- Not HighLevel import (that is inbound from GHL; see [ghl-import](ghl-import.md))

## Phase

5 — after [SeedlyMCP](seedly-mcp.md). First connector chosen when a buyer asks.

## Packaging

Zip per named system.

## Depends on

- [SeedlyMCP](seedly-mcp.md) for inbound app sign-in
- [Factory](factory.md)
- Seedly extension workflow + cron seams
