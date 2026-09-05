import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchCimdDocument,
  isClaudeCimdHost,
  isHttpsClientId,
  parseCimdDocument,
} from '../../files/packages/seedly-mcp/lib/cimd.mjs';

const CLIENT_ID = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const HERE = dirname(fileURLToPath(import.meta.url));
const FORM = readFileSync(
  join(HERE, '../../files/apps/web/app/seedly-mcp/oauth/authorize/authorize-form.tsx'),
  'utf8',
);
const PAGE = readFileSync(
  join(HERE, '../../files/apps/web/app/seedly-mcp/oauth/authorize/page.tsx'),
  'utf8',
);

test('https client_id URLs are recognized', () => {
  assert.equal(isHttpsClientId(CLIENT_ID), true);
  assert.equal(isHttpsClientId('claude-desktop'), false);
  assert.equal(isHttpsClientId('http://localhost/cimd'), false);
});

test('Claude CIMD hosts are the public claude.ai / claude.com names', () => {
  assert.equal(isClaudeCimdHost(CLIENT_ID), true);
  assert.equal(isClaudeCimdHost('https://claude.com/oauth/mcp-oauth-client-metadata'), true);
  assert.equal(isClaudeCimdHost('https://evil.example/cimd'), false);
});

test('CIMD parse requires client_id match and collects redirect URIs', () => {
  const ok = parseCimdDocument(
    { client_id: CLIENT_ID, client_name: 'Claude', redirect_uris: [REDIRECT] },
    CLIENT_ID,
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.clientName, 'Claude');
    assert.deepEqual(ok.redirectUris, [REDIRECT]);
  }

  const mismatch = parseCimdDocument({ client_id: 'https://evil.example/cimd' }, CLIENT_ID);
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) {
    assert.match(mismatch.error, /did not match/);
  }
});

test('fetchCimdDocument uses the injected fetch and maps HTTP failures', async () => {
  const doc = await fetchCimdDocument(CLIENT_ID, async () => ({
    ok: true,
    json: async () => ({ client_id: CLIENT_ID, redirect_uris: [REDIRECT] }),
  }));
  assert.equal(doc.ok, true);
  if (doc.ok) assert.deepEqual(doc.redirectUris, [REDIRECT]);

  const failed = await fetchCimdDocument(CLIENT_ID, async () => ({
    ok: false,
    json: async () => ({}),
  }));
  assert.equal(failed.ok, false);

  const threw = await fetchCimdDocument(CLIENT_ID, async () => {
    throw new TypeError('Failed to fetch');
  });
  assert.equal(threw.ok, false);
});

test('authorize form does not fetch Claude CIMD in the browser', () => {
  assert.equal(FORM.includes('fetchCimd'), false);
  assert.equal(FORM.includes('await fetch(clientId'), false);
  assert.equal(PAGE.includes('fetchCimdDocument'), true);
});
