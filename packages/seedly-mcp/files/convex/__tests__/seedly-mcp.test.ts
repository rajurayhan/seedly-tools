import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const SCHEMA = readFileSync(join(ROOT, 'seedlyMcpSchema.ts'), 'utf-8');
const META = readFileSync(join(ROOT, 'seedlyMcp/oauthMetadata.ts'), 'utf-8');
const HTTP = readFileSync(join(ROOT, 'seedlyMcp/http.ts'), 'utf-8');
const API = readFileSync(join(ROOT, 'seedlyMcp/api.ts'), 'utf-8');
const IDENTITY = readFileSync(join(ROOT, 'seedlyMcp/identity.ts'), 'utf-8');
const IDENTITY_ROUTES = readFileSync(join(ROOT, 'seedlyMcp/identityRoutes.ts'), 'utf-8');
const AUTHORIZE_FORM = readFileSync(
  join(ROOT, '../apps/web/app/seedly-mcp/oauth/authorize/authorize-form.tsx'),
  'utf-8',
);
const AUTHORIZE_PAGE = readFileSync(
  join(ROOT, '../apps/web/app/seedly-mcp/oauth/authorize/page.tsx'),
  'utf-8',
);

describe('SeedlyMCP Convex add-on', () => {
  it('declares grant tables on the extension seam', () => {
    expect(SCHEMA).toContain('seedlyMcpClients: defineTable');
    expect(SCHEMA).toContain('seedlyMcpAuthCodes: defineTable');
    expect(SCHEMA).toContain('seedlyMcpGrants: defineTable');
    expect(SCHEMA).toContain("index('by_accessTokenHash'");
  });

  it('advertises Claude OAuth discovery fields', () => {
    expect(META).toContain('authorization_servers');
    expect(META).toContain('client_id_metadata_document_supported');
    expect(META).toContain("code_challenge_methods_supported: ['S256']");
    expect(META).toContain("token_endpoint_auth_methods_supported: ['none']");
    expect(META).toContain('registration_endpoint');
    expect(META).toContain('https://claude.ai/api/mcp/auth_callback');
    expect(META).toContain('SEAM-GAP');
    expect(META).toContain('Do not patch');
  });

  it('does not register routes on convex/http.ts', () => {
    expect(HTTP).not.toContain("from '../http'");
    expect(API).not.toContain("from '../http'");
    expect(IDENTITY).not.toContain("from '../http'");
    expect(IDENTITY_ROUTES).not.toContain("from '../http'");
    expect(IDENTITY_ROUTES).not.toContain('../extensions/apiRoutes');
    expect(IDENTITY_ROUTES).toContain("from './apiRouteTypes'");
  });

  it('ships identity fallback routes under ext/seedly-mcp with any-key scope', () => {
    expect(IDENTITY_ROUTES).toContain("namespace: 'seedly-mcp'");
    expect(IDENTITY_ROUTES).toContain("path: 'me'");
    expect(IDENTITY_ROUTES).toContain("path: 'location'");
    expect(IDENTITY_ROUTES).toContain("scope: 'any'");
    expect(IDENTITY).toContain('export const getMe');
    expect(IDENTITY).toContain('export const getLocation');
  });

  it('loads Claude CIMD on the server, not in the Allow button', () => {
    expect(AUTHORIZE_FORM).not.toContain('fetchCimd');
    expect(AUTHORIZE_FORM).not.toContain('await fetch(clientId');
    expect(AUTHORIZE_PAGE).toContain('fetchCimdDocument');
  });
});
