/**
 * Claude connector discovery documents. Same fields as
 * packages/seedly-mcp/lib/oauth-metadata.mjs — kept in TS so Convex / Next
 * can import without a .mjs boundary.
 *
 * SEAM-GAP (convex/http.ts): stock Seedly 5.8 has no Convex HTTP route
 * registry for add-ons. These documents are served from the Next.js
 * public-path seam (`/.well-known/*`, `/seedly-mcp/`). Do not patch
 * convex/http.ts to hang them on *.convex.site.
 */

export const CLAUDE_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
export const CLAUDE_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
] as const;

export function normalizeOrigin(origin: string): string {
  return String(origin ?? '').replace(/\/$/, '');
}

export function mcpResourceUrl(origin: string): string {
  return `${normalizeOrigin(origin)}/seedly-mcp`;
}

export function protectedResourceMetadata(origin: string) {
  const resource = mcpResourceUrl(origin);
  const issuer = normalizeOrigin(origin);
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    resource_documentation: `${issuer}/mcp-setup`,
  };
}

export function authorizationServerMetadata(origin: string) {
  const issuer = normalizeOrigin(origin);
  return {
    issuer,
    authorization_endpoint: `${issuer}/seedly-mcp/oauth/authorize`,
    token_endpoint: `${issuer}/seedly-mcp/oauth/token`,
    registration_endpoint: `${issuer}/seedly-mcp/oauth/register`,
    scopes_supported: ['seedly_mcp'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    revocation_endpoint: `${issuer}/seedly-mcp/oauth/revoke`,
  };
}

export function isAllowedRedirectUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if ((CLAUDE_REDIRECT_URIS as readonly string[]).includes(uri)) return true;
  try {
    const parsed = new URL(uri);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function wwwAuthenticate(origin: string): string {
  const metadata = `${normalizeOrigin(origin)}/.well-known/oauth-protected-resource`;
  return `Bearer realm="seedly-mcp", resource_metadata="${metadata}"`;
}

export const SEEDLY_MCP_KEY_SCOPES = [
  'contacts:read',
  'contacts:write',
  'conversations:read',
  'calendars:read',
  'calendars:write',
  'tasks:read',
  'tasks:write',
  'opportunities:read',
  'opportunities:write',
  'invoices:read',
  'estimates:read',
] as const;
