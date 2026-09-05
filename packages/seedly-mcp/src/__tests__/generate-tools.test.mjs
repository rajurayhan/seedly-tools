import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOW_MAP, BLOCKED_V1_TOOLS } from '../../files/packages/seedly-mcp/lib/allow-map.mjs';
import { FALLBACK_TOOLS } from '../../files/packages/seedly-mcp/lib/fallback-tools.mjs';
import { TOOLS } from '../../files/packages/seedly-mcp/lib/tools.mjs';
import {
  buildCatalog,
  catalogSignature,
  checkCatalog,
  syncTools,
} from '../../files/packages/seedly-mcp/lib/generate-tools.mjs';
import { catalogCoverage } from '../../files/packages/seedly-mcp/lib/tool-groups.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const stubYaml = readFileSync(join(here, 'fixtures/openapi.stub.yaml'), 'utf8');

function silent() {
  return { log() {}, warn() {}, error() {} };
}

test('allow list covers every shipped tool name exactly once', () => {
  const names = ALLOW_MAP.map((e) => e.name);
  assert.deepEqual([...names].sort(), [...TOOLS.map((t) => t.name)].sort());
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(ALLOW_MAP.map((e) => e.operationId)).size, ALLOW_MAP.length);
});

test('fallback rows match the shipped catalog', () => {
  assert.equal(catalogSignature(FALLBACK_TOOLS), catalogSignature(TOOLS));
});

test('stub OpenAPI fills allow-listed routes and keeps get_appointment', () => {
  const { tools, warnings } = buildCatalog(stubYaml);
  const byName = new Map(tools.map((t) => [t.name, t]));

  assert.equal(tools.length, ALLOW_MAP.length);
  assert.equal(byName.get('list_contacts').method, 'GET');
  assert.equal(byName.get('list_contacts').path, '/api/v1/contacts');
  assert.deepEqual(byName.get('list_contacts').queryParams, ['email', 'search', 'limit']);
  assert.equal(byName.get('create_contact').method, 'POST');
  assert.ok(byName.get('create_contact').bodyParams.includes('extraField'));
  assert.deepEqual(byName.get('create_contact').required, ['firstName', 'lastName']);
  assert.equal(byName.get('complete_task').method, 'PUT');
  assert.equal(byName.get('complete_task').path, '/api/v1/tasks/{id}/complete');
  assert.equal(byName.get('create_appointment').method, 'POST');
  assert.equal(byName.get('update_opportunity_status').method, 'PUT');
  assert.equal(byName.get('list_calendar_types').path, '/api/v1/calendars/types');

  assert.equal(byName.get('get_appointment').path, '/api/v1/calendars/appointments/{id}');
  assert.ok(warnings.some((w) => w.includes('getAppointment')));

  const names = new Set(tools.map((t) => t.name));
  assert.equal(names.has('send_conversation_message'), false);
  assert.equal(names.has('sendMessage'), false);
  for (const blocked of BLOCKED_V1_TOOLS) {
    assert.equal(names.has(blocked), false, blocked);
  }

  const { missing, extra, duplicates } = catalogCoverage(tools);
  assert.deepEqual(missing, []);
  assert.deepEqual(extra, []);
  assert.deepEqual(duplicates, []);
});

test('missing OpenAPI on a checkout with docs/ throws', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'seedly-mcp-docs-'));
  try {
    mkdirSync(join(checkout, 'docs'));
    assert.throws(
      () => syncTools({ checkout, requireOpenApi: true, log: silent() }),
      /docs\/openapi\.yaml is missing/,
    );
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('missing OpenAPI without docs/ is skipped', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'seedly-mcp-nodocs-'));
  try {
    const result = syncTools({ checkout, requireOpenApi: false, log: silent() });
    assert.equal(result.skipped, true);
    assert.equal(result.ok, true);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('sync writes tools.mjs and doctor matches', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'seedly-mcp-sync-'));
  try {
    mkdirSync(join(checkout, 'docs'));
    mkdirSync(join(checkout, 'packages/seedly-mcp/lib'), { recursive: true });
    writeFileSync(join(checkout, 'docs/openapi.yaml'), stubYaml);
    const result = syncTools({ checkout, log: silent() });
    assert.equal(result.wrote, true);
    const dest = join(checkout, 'packages/seedly-mcp/lib/tools.mjs');
    const src = readFileSync(dest, 'utf8');
    assert.match(src, /export const TOOLS/);
    assert.match(src, /get_appointment/);
    assert.equal(src.includes('sendMessage'), false);

    writeFileSync(join(checkout, 'packages/seedly-mcp/lib/allow-map.mjs'), 'export const BLOCKED_V1_TOOLS = [];\n');
    const doctor = checkCatalog({ checkout, log: silent() });
    assert.equal(doctor.ok, true);

    writeFileSync(dest, src.replace('/api/v1/contacts', '/api/v1/contacts-renamed'));
    const drifted = checkCatalog({ checkout, log: silent() });
    assert.equal(drifted.ok, false);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});
