# Native agent

## What it is

An in-dashboard helper that talks to people through Seedly and **only** uses [SeedlyMCP](seedly-mcp.md) tools to read or write. Confirm before send or charge. No model-vendor names on customer-facing copy.

## Who it is for

Licensed Seedly 5.7.x or 5.8.x owners who want help inside the CRM after MCP already works.

## What they get

- A dashboard agent UI
- Tool calls go through SeedlyMCP only
- Confirm step on anything that sends a message or charges a card
- Plan toggle for the agent

## What it is not

- Not a thin wrapper of someone else’s chat box
- Not a second copy of Seedly’s workflow `ai-prompt` node
- Not a hosted agent that bypasses the buyer’s MCP
- Not Phase 1 — do not start this before SeedlyMCP is installable

## Phase

4 — after [SeedlyMCP](seedly-mcp.md).

## Packaging

Zip (UI + wiring). Model keys stay the buyer’s, the same way Seedly already stores AI credentials.

## Depends on

- [SeedlyMCP](seedly-mcp.md)
- [Factory](factory.md)
