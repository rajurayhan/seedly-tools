# SeedlyMCP (Seedly add-on)

Install this into a licensed **Seedly 5.8.x** folder. It gives Cursor, Claude Desktop, and claude.ai tools that talk to **your** Seedly `/api/v1` only. Your contact book never goes to Sulus.

This zip is not a CRM. It will not run on its own.

- **Owner (not a programmer):** start at [INSTALL.md](INSTALL.md)
- **AI agent doing the install:** start at [AGENTS.md](AGENTS.md)
- **After an `/api/v1` change:** [OPENAPI.md](OPENAPI.md) then `bin/sync-tools.mjs`

## Install

1. Unzip this folder somewhere you can find it.
2. Open a terminal in **your Seedly CRM folder** (the one that already has `apps`, `convex`, and `package.json`).
3. Run:

```
node /path/to/seedly-mcp-0.1.0/bin/install.mjs --seedly .
```

The installer copies the add-on files, merges them next to Dispatch / GoSeedly / HighLevel import if those are already installed, and records the add-on in `.modules.json`. It never deploys. It never edits `convex/http.ts`.

4. Then, from the Seedly folder:

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

5. Deploy the website as you usually do. If you changed the backend, also run `npx convex deploy` from the Seedly folder (that is a live deploy — only do it when you mean to).

6. Turn **SeedlyMCP** on for the client plan (Admin → Plans → Add-ons).

## Cursor / Claude Desktop (local)

1. Settings → Integrations → API Keys → Create Key. Copy it once.
2. Paste into Cursor MCP settings (use the real path to `server.mjs` inside your Seedly folder):

```json
{
  "mcpServers": {
    "seedly": {
      "command": "node",
      "args": ["/path/to/their-seedly/packages/seedly-mcp/server.mjs"],
      "env": {
        "SEEDLY_BASE_URL": "https://THEIR_DEPLOYMENT.convex.site",
        "SEEDLY_API_KEY": "sk_live_..."
      }
    }
  }
}
```

The key stays in that env. We do not print it back.

## claude.ai (remote)

The remote door is on **your public Seedly website**, not on Sulus:

`https://YOUR_SEEDLY_URL/seedly-mcp`

Stock Seedly 5.8 has no add-on hook for extra routes on `*.convex.site` (`convex/http.ts` is off-limits). OAuth discovery and the MCP HTTP door use the existing public-path seam:

- `https://YOUR_SEEDLY_URL/seedly-mcp`
- `https://YOUR_SEEDLY_URL/.well-known/oauth-protected-resource`
- `https://YOUR_SEEDLY_URL/.well-known/oauth-authorization-server`

1. Deploy the website (and Convex if you just installed this).
2. In claude.ai: Settings → Connectors → Add custom connector.
3. URL: `https://YOUR_SEEDLY_URL/seedly-mcp`
4. Sign in on **your** Seedly and Allow. Claude’s callback we allow: `https://claude.ai/api/mcp/auth_callback`

If OAuth discovery cannot complete, add the connector with a request header `Authorization: Bearer sk_live_...` instead (Claude’s static-header option).

## What Claude / Cursor can do

Read the current user, the authorized location, contacts, conversations, messages, calendars, appointments, tasks, opportunities, pipelines, invoices, estimates, and other locations.

Create/update contacts, create/complete tasks, create opportunities and move their status/stage, book appointments.

They cannot send messages, send or void invoices, send or accept estimates, or change webhooks. That wait is intentional.

## Uninstall

From the Seedly folder:

```
node /path/to/seedly-mcp-0.1.0/bin/uninstall.mjs --seedly . --yes
```

Revoke leftover SeedlyMCP API keys in Settings → Integrations if you are removing the add-on for good. Empty leftover `seedlyMcp*` tables in Convex before the next backend deploy.

## Health check

```
node /path/to/seedly-mcp-0.1.0/bin/doctor.mjs --seedly .
```
