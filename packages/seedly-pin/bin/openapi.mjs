/**
 * Append SeedlyPin REST paths to the buyer docs/openapi.yaml.
 * Idempotent. Never invent host-owned /api/v1/me.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OPENAPI_REL = 'docs/openapi.yaml';
export const PIN_PATH_MARK = '/api/v1/ext/seedly-pin/pins';

export const PIN_OPENAPI_SNIPPET = `  /api/v1/ext/seedly-pin/pins:
    get:
      operationId: listPins
      tags: [SeedlyPin]
      summary: List pins
      parameters:
        - in: query
          name: status
          schema: { type: string }
        - in: query
          name: priority
          schema: { type: string }
        - in: query
          name: search
          schema: { type: string }
      responses:
        "200": { description: Pin list }
        "403": { description: Pins disabled or forbidden }
    post:
      operationId: createPin
      tags: [SeedlyPin]
      summary: Create a manual pin
      responses:
        "200": { description: Created pin }
        "403": { description: Pins disabled or forbidden }
  /api/v1/ext/seedly-pin/pins/{id}:
    get:
      operationId: getPin
      tags: [SeedlyPin]
      summary: Get one pin with files, notes, and history
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      responses:
        "200": { description: Pin detail }
        "404": { description: Not found }
    patch:
      operationId: updatePin
      tags: [SeedlyPin]
      summary: Update pin status, priority, assignee, title, or description
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      responses:
        "200": { description: Updated pin }
        "403": { description: Forbidden }
  /api/v1/ext/seedly-pin/pins/{id}/files:
    get:
      operationId: listPinFiles
      tags: [SeedlyPin]
      summary: List pin files
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      responses:
        "200": { description: File list }
  /api/v1/ext/seedly-pin/pins/{id}/notes:
    get:
      operationId: listPinNotes
      tags: [SeedlyPin]
      summary: List internal notes
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      responses:
        "200": { description: Notes }
    post:
      operationId: addPinNote
      tags: [SeedlyPin]
      summary: Add an internal note
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      responses:
        "200": { description: Created note }
  /api/v1/ext/seedly-pin/pins/{id}/history:
    get:
      operationId: listPinHistory
      tags: [SeedlyPin]
      summary: Pin history
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      responses:
        "200": { description: History }
  /api/v1/ext/seedly-pin/pins/{id}/export:
    get:
      operationId: exportPinDiagnostics
      tags: [SeedlyPin]
      summary: Redacted diagnostic pack for editor agents
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
        - in: query
          name: format
          schema: { type: string, enum: [markdown, plain, aiPrompt, json] }
      responses:
        "200": { description: Diagnostics }
  /api/v1/ext/seedly-pin/stats:
    get:
      operationId: pinStats
      tags: [SeedlyPin]
      summary: Pin counts by status and priority
      responses:
        "200": { description: Stats }
  /api/v1/ext/seedly-pin/assignable-users:
    get:
      operationId: listPinAssignableUsers
      tags: [SeedlyPin]
      summary: Users who can be assigned a pin
      responses:
        "200": { description: Assignable users }
`;

export function insertPinOpenApi(yaml) {
  if (yaml.includes(PIN_PATH_MARK)) {
    return { yaml, inserted: false };
  }
  const anchors = [
    '\n# =============================================================================\n# COMPONENTS\n',
    '\ncomponents:\n',
  ];
  for (const anchor of anchors) {
    if (yaml.includes(anchor)) {
      return { yaml: yaml.replace(anchor, `\n${PIN_OPENAPI_SNIPPET}${anchor}`), inserted: true };
    }
  }
  return { yaml: `${yaml.trimEnd()}\n\n${PIN_OPENAPI_SNIPPET}`, inserted: true };
}

export function ensurePinOpenApi({ checkout, dryRun = false, log = console } = {}) {
  const file = join(checkout, OPENAPI_REL);
  if (!existsSync(file)) {
    log.warn?.('docs/openapi.yaml not found — skipped SeedlyPin OpenAPI insert');
    return { ok: true, skipped: true, inserted: false };
  }
  const current = readFileSync(file, 'utf8');
  const { yaml, inserted } = insertPinOpenApi(current);
  if (!inserted) {
    log.log?.('host OpenAPI already has SeedlyPin paths');
    return { ok: true, skipped: false, inserted: false };
  }
  if (!dryRun) {
    writeFileSync(file, yaml.endsWith('\n') ? yaml : `${yaml}\n`);
  }
  log.log?.(dryRun ? 'would write SeedlyPin OpenAPI paths' : 'wrote SeedlyPin paths into docs/openapi.yaml');
  return { ok: true, skipped: false, inserted: true, wrote: !dryRun };
}

export function revertPinOpenApi({ checkout, dryRun = false, log = console } = {}) {
  const file = join(checkout, OPENAPI_REL);
  if (!existsSync(file)) return { changed: false };
  const current = readFileSync(file, 'utf8');
  if (!current.includes(PIN_PATH_MARK) && !current.includes('tags: [SeedlyPin]')) {
    return { changed: false };
  }
  const next = current.replace(PIN_OPENAPI_SNIPPET, '').replace(/\n{3,}/g, '\n\n');
  if (next === current) return { changed: false };
  if (!dryRun) writeFileSync(file, next.endsWith('\n') ? next : `${next}\n`);
  log.log?.(dryRun ? 'would revert SeedlyPin OpenAPI paths' : 'reverted SeedlyPin OpenAPI paths');
  return { changed: true };
}
