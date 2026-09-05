# Keep the public API list in step

SeedlyMCP reads **`docs/openapi.yaml` in your Seedly folder** (not this zip) when you install or run `bin/sync-tools.mjs`. That file is the written list of public `/api/v1` doors. If the live API changes and this file does not, the assistant keeps the old doors (or a shipped fallback).

Do not put this note in `SETUP/`.

## Owner (not a programmer)

1. When you or an assistant add, remove, rename, or change a public `/api/v1` route or its fields, update `docs/openapi.yaml` **in the same sitting**.
2. From your Seedly folder:

```
node /path/to/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly .
node /path/to/seedly-mcp-0.1.0/bin/doctor.mjs --seedly .
```

3. Publish the website the way you already do, so Claude on the web sees the new list. Restart Cursor if you use the local program.

A Seedly overlay (`npx pnpm run update`) may already refresh the yaml. Still run sync + doctor afterward.

You do **not** need to list send-message, invoice money, or webhook writes to keep the assistant safer. Those stay off even if they appear in the yaml.

If doctor **warns** that a tool used a fallback (for example `get_appointment`), the yaml has no matching door. Add the route to the yaml and the live API, or ignore the warn if you did not mean to ship that door.

If doctor says `docs/openapi.yaml is missing`, restore that file from your Seedly package. Stock 5.8 includes it.

## AI agent

Same-change rule: any edit to `convex/http.ts` `/api/v1/*` (or the handler it calls) **must** update `docs/openapi.yaml` and `docs/integration-guide.md` when the public contract changed. Do not leave docs for later.

Before you call the API change done:

1. Path + method in the yaml match the live route.
2. `operationId` stays stable camelCase. If you add a **new** public operation, add an id. Do not rename an id an allow-listed tool already uses (`listContacts`, `completeTask`, `bookAppointment`, …).
3. Query / path / body fields and `required` match the handler. Follow the host file’s OpenAPI 3.1 style (`$ref` to `#/components/schemas/…`).
4. Dangerous verbs (send message, invoice send/void/refund, estimate send/accept/decline/convert, campaign send, webhook write) may be documented for human integrators. **Do not** add them to `ALLOW_MAP` in `packages/seedly-mcp/lib/allow-map.mjs` unless a human product decision says so.
5. Run sync, then doctor:

```
node /ABS/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly .
node /ABS/seedly-mcp-0.1.0/bin/doctor.mjs --seedly .
```

Warns for known fallbacks are OK. `ERR` on catalog drift means run sync again or fix the yaml.
6. Remind the owner to publish the website so `/seedly-mcp` picks up `packages/seedly-mcp/lib/tools.mjs`. `npx convex deploy` only if `convex/` changed and they typed yes to that command.
