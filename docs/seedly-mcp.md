# SeedlyMCP

## What it is

An installable MCP server the buyer points Cursor or Claude at. Tools call **their** Seedly `/api/v1` (and GoSeedly write routes when needed) with **their** API key. Their data never goes to Sulus.

## Who it is for

Licensed Seedly 5.8.x owners who want AI tools on their own CRM.

## What they get

- Same install path as HighLevel import ([Factory](factory.md))
- GoSeedly-style extension routes if the host seam is empty (append `apiRoutes`, scopes, tables)
- Local MCP program (stdio) for Cursor / Claude Desktop, with a Seedly API key
- Remote MCP on **their** public Seedly URL for claude.ai, with **OAuth** (they sign in to their Seedly)
- Fallback if the host has no public MCP seam: Claude custom connector + API key request header
- Plan toggle: `seedly_mcp`

Claude-to-Seedly OAuth belongs here. QuickBooks / HubSpot OAuth does not ([connectors.md](connectors.md)).

## What it is not

- Not a Sulus-hosted MCP that can see every buyer’s book
- Not the chat agent UI (that is [Native agent](native-agent.md))
- Not SulusMCP Studio (that is our factory, not theirs)
- Not a replacement for Seedly’s public REST docs

## Phase

1 — on the shelf. Zip installs on `fixtures/seedly-host/`.

## Packaging

Zip only. Buyer-zip hosting: MCP talks to that owner’s Seedly.

## Depends on

- Seedly 5.8.x and `extensionApiVersion: 1`
- Empty `apiRoutes` seam if stock 5.8 shipped it empty. If the leaf does not exist at all, that is a seam gap — record it; do not patch `convex/http.ts`

## Honest note

Seedly already has `/api/v1`. MCP is not in the CRM today. This zip is the door. [Native agent](native-agent.md) sits on it.

## Build sheet

Phase 1 detail (tools, seams, buyer Cursor config): [seedly-mcp-build.md](seedly-mcp-build.md). Pack: `node scripts/pack.mjs seedly-mcp` → `dist/seedly-mcp-0.1.0.zip`.

Install: owners use [INSTALL.md](../packages/seedly-mcp/INSTALL.md). Agents use [AGENTS.md](../packages/seedly-mcp/AGENTS.md).
