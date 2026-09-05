import { corsHeaders, json } from '@/lib/seedly-mcp/origin';
import { registerClientRef, seedlyMcpConvex } from '@/lib/seedly-mcp/convex-http';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const client = seedlyMcpConvex();
  if (!client) return json({ error: 'server_error' }, 500);
  let body: { client_name?: string; redirect_uris?: string[]; token_endpoint_auth_method?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_client_metadata' }, 400);
  }
  const result = await client.action(registerClientRef, {
    clientName: body.client_name,
    redirectUris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
    tokenEndpointAuthMethod: body.token_endpoint_auth_method,
  });
  if (!result.ok) return json({ error: 'invalid_redirect_uri', error_description: result.error }, 400);
  return json(result, 201);
}
