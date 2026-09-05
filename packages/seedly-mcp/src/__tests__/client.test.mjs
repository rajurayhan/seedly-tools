import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalEnv, callSeedlyApi } from '../../files/packages/seedly-mcp/lib/client.mjs';

test('stdio env fails fast when the key or URL is missing', () => {
  assert.throws(() => assertLocalEnv({}), /SEEDLY_BASE_URL/);
  assert.throws(() => assertLocalEnv({ SEEDLY_BASE_URL: 'https://x.convex.site' }), /SEEDLY_API_KEY/);
  const ok = assertLocalEnv({
    SEEDLY_BASE_URL: 'https://x.convex.site/',
    SEEDLY_API_KEY: 'sk_live_test',
  });
  assert.equal(ok.baseUrl, 'https://x.convex.site');
});

test('API client maps { error: { code, message } } and never echoes the key', async () => {
  const seen = [];
  const result = await callSeedlyApi({
    baseUrl: 'https://x.convex.site',
    apiKey: 'sk_live_secret_value',
    method: 'GET',
    path: '/api/v1/contacts',
    fetchImpl: async (url, init) => {
      seen.push({ href: String(url), auth: init.headers.Authorization });
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }),
      };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'UNAUTHORIZED');
  assert.equal(JSON.stringify(result).includes('sk_live_secret_value'), false);
  assert.equal(seen[0].auth, 'Bearer sk_live_secret_value');
});
