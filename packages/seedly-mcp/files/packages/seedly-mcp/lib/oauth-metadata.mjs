/** Claude custom-connector OAuth discovery (RFC 9728 + RFC 8414 + CIMD / DCR). */

export const CLAUDE_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
export const CLAUDE_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
];

export function normalizeOrigin(origin) {
  return String(origin ?? '').replace(/\/$/, '');
}

export function mcpResourceUrl(origin) {
  return `${normalizeOrigin(origin)}/seedly-mcp`;
}

export function protectedResourceMetadata(origin) {
  const resource = mcpResourceUrl(origin);
  const issuer = normalizeOrigin(origin);
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    resource_documentation: `${issuer}/mcp-setup`,
  };
}

export function authorizationServerMetadata(origin) {
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

export function isAllowedRedirectUri(uri) {
  if (!uri) return false;
  if (CLAUDE_REDIRECT_URIS.includes(uri)) return true;
  try {
    const parsed = new URL(uri);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function wwwAuthenticate(origin) {
  const metadata = `${normalizeOrigin(origin)}/.well-known/oauth-protected-resource`;
  return `Bearer realm="seedly-mcp", resource_metadata="${metadata}"`;
}
