import { corsHeaders, json } from '@/lib/seedly-mcp/origin';
import { exchangeTokenRef, seedlyMcpConvex } from '@/lib/seedly-mcp/convex-http';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const client = seedlyMcpConvex();
  if (!client) return json({ error: 'server_error' }, 500);

  const contentType = request.headers.get('content-type') ?? '';
  let grantType = '';
  let code = '';
  let redirectUri = '';
  let clientId = '';
  let codeVerifier = '';
  let refreshToken = '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    grantType = String(form.get('grant_type') ?? '');
    code = String(form.get('code') ?? '');
    redirectUri = String(form.get('redirect_uri') ?? '');
    clientId = String(form.get('client_id') ?? '');
    codeVerifier = String(form.get('code_verifier') ?? '');
    refreshToken = String(form.get('refresh_token') ?? '');
  } else {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    grantType = body.grant_type ?? '';
    code = body.code ?? '';
    redirectUri = body.redirect_uri ?? '';
    clientId = body.client_id ?? '';
    codeVerifier = body.code_verifier ?? '';
    refreshToken = body.refresh_token ?? '';
  }

  const result = await client.action(exchangeTokenRef, {
    grantType,
    code: code || undefined,
    redirectUri: redirectUri || undefined,
    clientId: clientId || undefined,
    codeVerifier: codeVerifier || undefined,
    refreshToken: refreshToken || undefined,
  });
  if (!result.ok) {
    return json({ error: result.error, error_description: result.error_description }, 400);
  }
  return json(result);
}
