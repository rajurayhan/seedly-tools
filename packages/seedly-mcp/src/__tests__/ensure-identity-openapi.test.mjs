import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureIdentityOpenApi,
  hostHasIdentityOps,
  insertIdentityOpenApi,
} from '../../files/packages/seedly-mcp/lib/ensure-identity-openapi.mjs';
import { buildCatalog } from '../../files/packages/seedly-mcp/lib/generate-tools.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const stubYaml = readFileSync(join(here, 'fixtures/openapi.stub.yaml'), 'utf8');
const stockYaml = stubYaml
  .replace(/\n  \/api\/v1\/me:[\s\S]*?(?=\n  \/api\/v1\/)/, '\n')
  .replace(/\n  \/api\/v1\/location:[\s\S]*?(?=\n  \/api\/v1\/)/, '\n');

function silent() {
  return { log() {}, warn() {}, error() {} };
}

test('skips insert when host already has operationId getMe', () => {
  const host = `${stubYaml}\n  /api/v1/me:\n    get:\n      operationId: getMe\n`;
  assert.equal(hostHasIdentityOps(host), true);
  const { inserted, yaml } = insertIdentityOpenApi(host);
  assert.equal(inserted, false);
  assert.equal(yaml, host);
});

test('skips insert when ext fallback path is already documented', () => {
  const host = `${stubYaml}\n  /api/v1/ext/seedly-mcp/me:\n    get:\n      operationId: getMe\n`;
  assert.equal(hostHasIdentityOps(host), true);
  assert.equal(insertIdentityOpenApi(host).inserted, false);
});

test('inserts ext identity doors when the host yaml has no getMe', () => {
  assert.equal(hostHasIdentityOps(stockYaml), false);
  const { inserted, yaml } = insertIdentityOpenApi(stockYaml);
  assert.equal(inserted, true);
  assert.match(yaml, /\/api\/v1\/ext\/seedly-mcp\/me:/);
  assert.match(yaml, /\/api\/v1\/ext\/seedly-mcp\/location:/);
  assert.match(yaml, /operationId: getMe/);
  assert.match(yaml, /operationId: getLocation/);
  assert.equal(yaml.includes('/api/v1/me:'), false);
});

test('ensure writes only when docs/openapi.yaml exists and lacks getMe', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'seedly-mcp-id-'));
  try {
    mkdirSync(join(checkout, 'docs'));
    writeFileSync(join(checkout, 'docs/openapi.yaml'), stockYaml);
    const first = ensureIdentityOpenApi({ checkout, log: silent() });
    assert.equal(first.inserted, true);
    assert.equal(first.wrote, true);
    const written = readFileSync(join(checkout, 'docs/openapi.yaml'), 'utf8');
    assert.match(written, /\/api\/v1\/ext\/seedly-mcp\/me:/);

    const second = ensureIdentityOpenApi({ checkout, log: silent() });
    assert.equal(second.inserted, false);

    const { tools } = buildCatalog(written);
    const me = tools.find((t) => t.name === 'get_me');
    const loc = tools.find((t) => t.name === 'get_location');
    assert.equal(me.path, '/api/v1/ext/seedly-mcp/me');
    assert.equal(loc.path, '/api/v1/ext/seedly-mcp/location');
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('ensure no-ops when openapi.yaml is absent', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'seedly-mcp-noid-'));
  try {
    const result = ensureIdentityOpenApi({ checkout, log: silent() });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    assert.equal(result.inserted, false);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});
