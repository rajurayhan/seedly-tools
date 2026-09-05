import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAUDE_REDIRECT_URI,
  authorizationServerMetadata,
  isAllowedRedirectUri,
  mcpResourceUrl,
  protectedResourceMetadata,
} from '../../files/packages/seedly-mcp/lib/oauth-metadata.mjs';

const ORIGIN = 'https://crm.example.com';

test('protected resource metadata has the fields Claude looks for', () => {
  const doc = protectedResourceMetadata(ORIGIN);
  assert.equal(doc.resource, 'https://crm.example.com/seedly-mcp');
  assert.deepEqual(doc.authorization_servers, [ORIGIN]);
  assert.deepEqual(doc.bearer_methods_supported, ['header']);
});

test('authorization server metadata advertises CIMD, DCR, and PKCE S256', () => {
  const doc = authorizationServerMetadata(ORIGIN);
  assert.equal(doc.issuer, ORIGIN);
  assert.equal(doc.authorization_endpoint, `${ORIGIN}/seedly-mcp/oauth/authorize`);
  assert.equal(doc.token_endpoint, `${ORIGIN}/seedly-mcp/oauth/token`);
  assert.equal(doc.registration_endpoint, `${ORIGIN}/seedly-mcp/oauth/register`);
  assert.equal(doc.client_id_metadata_document_supported, true);
  assert.deepEqual(doc.code_challenge_methods_supported, ['S256']);
  assert.ok(doc.token_endpoint_auth_methods_supported.includes('none'));
  assert.ok(doc.grant_types_supported.includes('authorization_code'));
});

test('Claude callback is on the redirect allow-list', () => {
  assert.equal(CLAUDE_REDIRECT_URI, 'https://claude.ai/api/mcp/auth_callback');
  assert.equal(isAllowedRedirectUri(CLAUDE_REDIRECT_URI), true);
  assert.equal(isAllowedRedirectUri('https://evil.example/callback'), false);
  assert.equal(mcpResourceUrl(`${ORIGIN}/`), `${ORIGIN}/seedly-mcp`);
});
