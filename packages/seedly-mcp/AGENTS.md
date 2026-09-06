# SeedlyMCP — agent install playbook

Install this zip into a licensed **Seedly 5.7.x or 5.8.x** checkout. Owner twin: [INSTALL.md](INSTALL.md). Factory: [../../docs/factory.md](../../docs/factory.md). Shared agent rules: [../../docs/install-agents.md](../../docs/install-agents.md).

This zip is not a CRM. Do not start Phases 2–5 product work from here.

## Goal

Two doors, both talking only to **this** host’s `/api/v1`:

1. Local stdio (`packages/seedly-mcp/server.mjs`) + `SEEDLY_BASE_URL` + `SEEDLY_API_KEY`
2. Remote Streamable HTTP + OAuth on the buyer’s **public website** (`/seedly-mcp`), not on Sulus

Plan feature: `seedly_mcp` / label **SeedlyMCP** / group **Add-ons**.

## Never

- Edit `SETUP/`, `LICENSE.md`, `SUPPORT.md`, `convex/http.ts`
- Patch `convex/http.ts` to hang MCP on `*.convex.site` (recorded seam gap)
- Own shared seams in `module.json` `ownedFiles`
- Add `import` lines to `extension-plan-features.ts` or `extension-public-paths.ts`
- Expose send-message, send/void/refund invoice, send/accept/decline estimate, campaign send, webhook write
- Dry-run install into a live CRM checkout. Use `fixtures/seedly-host/`
- Run `npx convex deploy` or `--prod` without a fresh owner yes
- Echo API keys back to chat

## Host check

```
test -d apps && test -d convex && test -f package.json
```

`package.json` `version` must satisfy `>=5.7.0 <5.9.0`. `extensionApiVersion` must be `1`.

## Install

CWD = Seedly checkout (or pass an absolute `--seedly`):

```
node /ABS/seedly-mcp-0.1.0/bin/install.mjs --seedly .
```

Dev checkout of this monorepo (toolkit not vendored next to the kit):

```
node --input-type=module -e "
import { runInstall } from '../toolkit/src/install.mjs';
runInstall({ kitRoot: process.cwd(), checkout: '/ABS/seedly', skipTypecheck: true, runTypecheck: false });
"
```

(from `packages/seedly-mcp`, adjust paths). Packed zips resolve toolkit via `bin/resolve-toolkit.mjs` (`./toolkit` or `../../toolkit`).

Installer: copies `ownedFiles`, merges `seams.json`, writes `.modules.json`, then — if the host yaml has no `operationId: getMe` — inserts **real** fallback doors `/api/v1/ext/seedly-mcp/me` and `/location` into that yaml, then refreshes `packages/seedly-mcp/lib/tools.mjs`. It never invents `/api/v1/me` in `convex/http.ts`. It never deploys.

If you call toolkit `runInstall` directly (dev path above), also run:

```
node /ABS/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly /ABS/seedly
```

## After install (host)

```
npx pnpm install
npx pnpm --filter @seedly-crm/web typecheck
```

Then the **owner** publishes:

- Website / Vercel as they already do
- `npx convex deploy` only after you explain backend files changed and they say yes

Enable **SeedlyMCP** on the location’s plan (Admin → Plans → Add-ons). Sidebar label: **MCP** (`/mcp-setup`).

## Seams this zip merges

| Host file | Append |
| --- | --- |
| `apps/web/lib/extension-plan-features.ts` | `{ key: 'seedly_mcp', label: 'SeedlyMCP', group: 'Add-ons' }` (zero-import) |
| `apps/web/lib/extension-public-paths.ts` | `/seedly-mcp` (no trailing slash — host matching only treats `/seedly-mcp/` as the subtree), `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server` (zero-import) |
| `apps/web/lib/extensions.ts` | nav / feature map / subjects / route permissions |
| `apps/web/lib/extension-subjects.ts` | `Seedly_mcp` |
| `packages/shared/src/extensions.ts` | permission module `seedly_mcp` |
| `convex/extensions/index.ts` | `...seedlyMcpTables` |
| `convex/extensions/snapshot.ts` | `seedlyMcpClients`, `seedlyMcpAuthCodes`, `seedlyMcpGrants` (private) |
| `convex/extensions/subjects.ts` | `seedly_mcp` → `Seedly_mcp` |
| `convex/extensions/apiRoutes.ts` | `...seedlyMcpIdentityRoutes` (GET `ext/seedly-mcp/me` + `location`, `scope: 'any'`) |

Do not own `convex/extensions/apiRoutes.ts`. Merge identity fallback routes only. Prefer `/seedly-mcp` on the Next.js public-path seam. Do not patch `convex/http.ts` to add `/api/v1/me` — that door is host-owned. The zip’s fallback is `/api/v1/ext/seedly-mcp/*` and needs a host dispatcher that honors `scope: 'any'` and passes `apiKeyId`.

## Remote URLs (buyer website origin)

```
https://{public-seedly-origin}/seedly-mcp
https://{public-seedly-origin}/.well-known/oauth-protected-resource
https://{public-seedly-origin}/.well-known/oauth-authorization-server
```

OAuth allow-list includes `https://claude.ai/api/mcp/auth_callback`. CIMD + DCR + PKCE S256. Fallback: Claude static header `Authorization: Bearer sk_live_...`.

## Local Cursor config

```json
{
  "mcpServers": {
    "seedly": {
      "command": "node",
      "args": ["/ABS/seedly/packages/seedly-mcp/server.mjs"],
      "env": {
        "SEEDLY_BASE_URL": "https://DEPLOYMENT.convex.site",
        "SEEDLY_API_KEY": "sk_live_..."
      }
    }
  }
}
```

Fail-fast if either env var is missing. Never print the key.

## Keep OpenAPI in step with `/api/v1`

Same-change rule: any edit to `convex/http.ts` `/api/v1/*` (or the handler it calls) **must** update host `docs/openapi.yaml` and `docs/integration-guide.md` when the public contract changed. Do not leave docs for later. Full checklist: [OPENAPI.md](OPENAPI.md).

Do not silently rename allow-listed `operationId`s (`listContacts`, `completeTask`, `bookAppointment`, …). Do not add send/money/webhook operations to `ALLOW_MAP`. After the yaml change:

```
node /ABS/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly /ABS/seedly
node /ABS/seedly-mcp-0.1.0/bin/doctor.mjs --seedly /ABS/seedly
```

Remind the owner to publish the website so `/seedly-mcp` serves the new `tools.mjs`.

## Verify

```
node /ABS/seedly-mcp-0.1.0/bin/doctor.mjs --seedly /ABS/seedly
```

Must pass. Also assert:

- `.modules.json` has `seedly-mcp`
- `ownedFiles` does not include `convex/http.ts`
- `extension-plan-features.ts` has `key: 'seedly_mcp'` and no `import`
- `packages/seedly-mcp/server.mjs` exists on the host
- `convex/seedlyMcp/identityRoutes.ts` exists and does not import `convex/http.ts`
- fixture tests (this repo, not the buyer):

```
node --test packages/seedly-mcp/src/__tests__/*.test.mjs packages/toolkit/src/__tests__/*.test.mjs
```

Doctor may **warn** when an allow-listed `operationId` is missing from the host yaml (shipped fallback kept). That is not `ERR`.

Do not call a live Convex deployment or Anthropic from CI.

## Uninstall

```
node /ABS/seedly-mcp-0.1.0/bin/uninstall.mjs --seedly /ABS/seedly --yes
```

Dispatch / GoSeedly / ghl-import stay. Tell the owner to revoke `SeedlyMCP (Claude)` API keys and empty `seedlyMcp*` tables before the next backend deploy.

## Pack (this repo)

```
node scripts/pack.mjs seedly-mcp
```

Writes `dist/seedly-mcp-0.1.0.zip`. Zip must include `toolkit/`, `INSTALL.md`, `AGENTS.md`, `OPENAPI.md`, and must not include `convex/http.ts` or `SETUP/`.
