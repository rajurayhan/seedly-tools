import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const SCHEMA = readFileSync(join(ROOT, 'seedlyMcpSchema.ts'), 'utf-8');
const META = readFileSync(join(ROOT, 'seedlyMcp/oauthMetadata.ts'), 'utf-8');
const HTTP = readFileSync(join(ROOT, 'seedlyMcp/http.ts'), 'utf-8');
const API = readFileSync(join(ROOT, 'seedlyMcp/api.ts'), 'utf-8');

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
  });
});
