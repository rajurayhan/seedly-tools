# SeedlyMCP build sheet

This is the Phase 1 build sheet. It is not the zip. Do not start Phases 2–5 until this zip installs on `fixtures/seedly-host/`.

Product page: [seedly-mcp.md](seedly-mcp.md). Factory rules: [factory.md](factory.md).

## What we are building

A zip a Seedly 5.8 owner installs. It gives them **two ways** to attach an assistant. Both talk to **their** Seedly only. Their contact book never goes to Sulus.

**A. Local (Cursor, Claude on the computer)** — no OAuth. A small program on their machine. They paste a Seedly API key.

```
Cursor / Claude Desktop
    → local SeedlyMCP program (stdio)
        → HTTPS Authorization: Bearer sk_live_...
            → https://{their-deployment}.convex.site/api/v1/...
```

**B. Claude on the web (claude.ai)** — OAuth. Claude cannot see a program on their laptop. The zip must put an MCP HTTP door on **their public Seedly URL**. Claude opens a sign-in page on that Seedly. After they allow it, Claude calls that URL.

```
claude.ai
    → OAuth sign-in on their Seedly
    → HTTPS MCP (Streamable HTTP) on their Convex site
        → same /api/v1 tools, as that signed-in user
```

This OAuth is **Claude connecting to SeedlyMCP** (inbound). It is not QuickBooks / HubSpot ([connectors.md](connectors.md)).

## Decisions locked for v1

1. **Talk to `/api/v1` only.** Do not extract GoSeedly in this zip.
2. **Ship both doors.** Local stdio + API key for Cursor / Claude Desktop. Remote HTTP + OAuth for claude.ai.
3. **Remote MCP lives on the buyer’s Seedly**, not on Sulus and not on localhost. Claude.ai must reach a public `https://` URL.
4. **OAuth login is their Seedly login** (existing users). Do not invent a second password. After they allow Claude, tools run as that user’s location access.
5. **The zip uses the factory installer** so Admin → Plans can show **SeedlyMCP** (`seedly_mcp`).
6. **No chat UI** in the CRM. That is [Native agent](native-agent.md).
7. **No SulusMCP Studio** in the zip.
8. **Never edit `convex/http.ts`.** Mount remote MCP + OAuth discovery on an existing public extension seam. If that seam does not exist, record a seam gap and stop — do not patch the core router. Fallback while the gap is open: claude.ai **static request header** with a Seedly API key (Claude supports this for custom connectors).

## What the buyer does after install

### Cursor / Claude Desktop (local)

1. Settings → Integrations → API Keys → Create Key. Copy it once.
2. Paste into Cursor MCP settings (buyer README will use the real path):

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

The key stays in their env. We do not print it back.

### claude.ai (remote + OAuth)

1. Deploy the website and Convex as they already do (so the new MCP URL is live).
2. In claude.ai: Settings → Connectors → Add custom connector.
3. URL: their public MCP address (exact path written in the buyer README after we pick the seam — something they already host, like `https://THEIR_DEPLOYMENT.convex.site/…`).
4. Claude starts OAuth. They sign in on **their** Seedly and allow access.
5. Callback Claude uses: `https://claude.ai/api/mcp/auth_callback` (we must allow that redirect).

If OAuth discovery cannot be mounted without editing `http.ts`, the buyer README will say: add the connector with a **request header** `Authorization: Bearer sk_live_...` instead (Claude’s static-header option). That is a fallback, not the goal.

## Folder we will add (when we build)

```
packages/seedly-mcp/
  module.json
  seams.json
  README.md                 # buyer
  bin/install.mjs           # factory wrappers
  bin/uninstall.mjs
  bin/doctor.mjs
  files/
    packages/seedly-mcp/server.mjs      # local stdio
    convex/seedlyMcp/...                # remote HTTP MCP + OAuth metadata
    apps/web/lib/seedly-mcp/nav.ts
    apps/web/lib/seedly-mcp/subjects.ts
  ADDON-LICENSE.md
```

Pack: `node scripts/pack.mjs seedly-mcp` → `dist/seedly-mcp-0.1.0.zip`.

## Seams v1

Append only. Same toolkit as HighLevel import.

| Host file | What we add |
| --- | --- |
| `apps/web/lib/extension-plan-features.ts` | `{ key: 'seedly_mcp', label: 'SeedlyMCP', group: 'Add-ons' }` (zero-import) |
| Public extension seam (not `http.ts`) | Streamable HTTP MCP + `/.well-known` OAuth metadata Claude expects (DCR or CIMD) |
| `apps/web/lib/extension-public-paths.ts` | Public prefixes for OAuth + MCP (zero-import) |

Do not own `convex/extensions/apiRoutes.ts` unless that is the only safe public prefix. Prefer a dedicated public MCP path. If the host has no place to hang a public MCP URL, **seam gap** — do not patch `http.ts`.

Forbidden: `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`.

## Tools in v1

Each tool is a thin wrap of an existing `/api/v1` route.

- **Local:** the API key’s scopes are the gate.
- **Remote OAuth:** the signed-in Seedly user’s location access is the gate. Do not ask them for a second key after they signed in.

### Read (ship these)

| Tool | Calls |
| --- | --- |
| `list_contacts` | `GET /api/v1/contacts` |
| `get_contact` | `GET /api/v1/contacts/{id}` |
| `list_contact_fields` | `GET /api/v1/contacts/fields` |
| `list_conversations` | `GET /api/v1/conversations` |
| `get_conversation` | `GET /api/v1/conversations/{id}` |
| `list_messages` | `GET /api/v1/conversations/{id}/messages` |
| `list_calendars` | `GET /api/v1/calendars` |
| `list_calendar_types` | `GET /api/v1/calendars/types` |
| `get_availability` | `GET /api/v1/calendars/availability` |
| `list_appointments` | `GET /api/v1/calendars/appointments` |
| `get_appointment` | `GET /api/v1/calendars/appointments/{id}` |
| `list_tasks` | `GET /api/v1/tasks` |
| `get_task` | `GET /api/v1/tasks/{id}` |
| `list_opportunities` | `GET /api/v1/opportunities` |
| `get_opportunity` | `GET /api/v1/opportunities/{id}` |
| `list_pipelines` | `GET /api/v1/pipelines` |
| `list_invoices` | `GET /api/v1/invoices` |
| `get_invoice` | `GET /api/v1/invoices/{id}` |
| `list_estimates` | `GET /api/v1/estimates` |
| `get_estimate` | `GET /api/v1/estimates/{id}` |
| `list_sub_accounts` | `GET /api/v1/sub-accounts` |

### Write without sending money or messages (ship these)

| Tool | Calls |
| --- | --- |
| `create_contact` | `POST /api/v1/contacts` |
| `update_contact` | `PATCH /api/v1/contacts/{id}` (or the verb OpenAPI lists) |
| `create_task` | `POST /api/v1/tasks` |
| `complete_task` | `POST /api/v1/tasks/{id}/complete` |
| `create_opportunity` | `POST /api/v1/opportunities` |
| `update_opportunity_status` | `POST /api/v1/opportunities/{id}/status` |
| `update_opportunity_stage` | `POST /api/v1/opportunities/{id}/stage` |
| `create_appointment` | `POST /api/v1/calendars/appointments` |

### Not in v1 (too easy to hurt a live shop)

Do not expose these as tools until the native agent’s confirm step exists, or we add an explicit `SEEDLY_MCP_ALLOW_SEND=1` flag later:

- send conversation message
- send / void / mark-paid / refund invoice
- send / accept / decline estimate, convert to invoice
- send / schedule campaign
- webhook create/delete (easy to break automations)

`list_campaigns` can wait. Duplicate invoice/estimate can wait.

## Program behavior

- **Local:** Node `server.mjs`, stdio, MCP SDK vendored in the zip. Fail fast if `SEEDLY_BASE_URL` or `SEEDLY_API_KEY` is missing.
- **Remote:** same tools, Streamable HTTP, on their Convex site. Claude OAuth per Anthropic’s connector auth (protected-resource metadata, authorization-server metadata, DCR or CIMD). Redirect allow-list includes `https://claude.ai/api/mcp/auth_callback`.
- Tool HTTP to `/api/v1`: JSON `{ data, meta }` / `{ error: { code, message } }`. Do not dump keys or tokens.
- Timeouts and size caps: Seedly’s published rate limits; one request per tool call; no background loops.

## Tests (fixture only)

- Unit: tool name → method + path (no live CRM).
- Doctor: module recorded, plan feature present, stdio server present, no `http.ts` in `ownedFiles`.
- OAuth: fixture checks that discovery JSON has the fields Claude looks for (no live claude.ai).
- Do not call a real Convex deployment or Anthropic from CI.

## Out of this zip

- Hosted multi-tenant MCP
- GoSeedly extract
- Native agent UI
- Inbound OAuth for **other** apps (Slack, HubSpot). Claude-to-Seedly OAuth **is** in this zip.
- Phases 2–5

## When this sheet is done

Build the zip. Then update [seedly-mcp.md](seedly-mcp.md) status from Planned to On the shelf.
