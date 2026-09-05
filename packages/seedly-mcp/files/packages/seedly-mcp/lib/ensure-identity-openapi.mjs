/**
 * If the host OpenAPI has no getMe / getLocation, append the add-on fallback
 * doors under /api/v1/ext/seedly-mcp/*. Never invent /api/v1/me here — that
 * path only exists when the host router already has it.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OPENAPI_REL = 'docs/openapi.yaml';
const HOST_ME_ID = /operationId:\s*getMe\b/;
const EXT_ME_PATH = '/api/v1/ext/seedly-mcp/me';

const SNIPPET = `  /api/v1/ext/seedly-mcp/me:
    get:
      operationId: getMe
      tags: [Account]
      summary: Current user (API key owner)
      description: |
        SeedlyMCP fallback when the host has no GET /api/v1/me.
        Returns the user who created this API key.
      responses:
        "200":
          description: Current user
        "401":
          description: Unauthorized

  /api/v1/ext/seedly-mcp/location:
    get:
      operationId: getLocation
      tags: [Account]
      summary: Current authorized location
      description: |
        SeedlyMCP fallback when the host has no GET /api/v1/location.
        Returns the location this request is authorized to use.
      responses:
        "200":
          description: Current location
        "401":
          description: Unauthorized
`;

export function hostHasIdentityOps(yaml) {
  return HOST_ME_ID.test(yaml) || yaml.includes(EXT_ME_PATH);
}

export function insertIdentityOpenApi(yaml) {
  if (hostHasIdentityOps(yaml)) {
    return { yaml, inserted: false };
  }
  const anchors = [
    '\n# =============================================================================\n# COMPONENTS\n',
    '\ncomponents:\n',
  ];
  for (const anchor of anchors) {
    if (yaml.includes(anchor)) {
      return { yaml: yaml.replace(anchor, `\n${SNIPPET}${anchor}`), inserted: true };
    }
  }
  return { yaml: `${yaml.trimEnd()}\n\n${SNIPPET}`, inserted: true };
}

export function ensureIdentityOpenApi({ checkout, dryRun = false, log = console } = {}) {
  const file = join(checkout, OPENAPI_REL);
  if (!existsSync(file)) {
    log.warn?.('docs/openapi.yaml not found — skipped identity OpenAPI insert');
    return { ok: true, skipped: true, inserted: false };
  }
  const current = readFileSync(file, 'utf8');
  const { yaml, inserted } = insertIdentityOpenApi(current);
  if (!inserted) {
    log.log?.('ok  host OpenAPI already has getMe — left docs/openapi.yaml alone');
    return { ok: true, skipped: false, inserted: false };
  }
  if (dryRun) {
    log.log?.('Would append GET /api/v1/ext/seedly-mcp/me and /location to docs/openapi.yaml');
    return { ok: true, skipped: false, inserted: true, wrote: false };
  }
  writeFileSync(file, yaml.endsWith('\n') ? yaml : `${yaml}\n`);
  log.log?.('Wrote SeedlyMCP identity fallback paths into docs/openapi.yaml');
  return { ok: true, skipped: false, inserted: true, wrote: true };
}
