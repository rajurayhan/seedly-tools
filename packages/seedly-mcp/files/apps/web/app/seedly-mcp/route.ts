import { corsHeaders, json, publicOrigin, unauthorized } from '@/lib/seedly-mcp/origin';
import {
  convexSiteUrl,
  resolveBearerRef,
  seedlyMcpConvex,
} from '@/lib/seedly-mcp/convex-http';
import { handleJsonRpc, apiExecutor, initializeResult } from '../../../../packages/seedly-mcp/lib/mcp-protocol.mjs';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const auth = request.headers.get('authorization');
  if (!auth) return unauthorized(origin);
  return json({
    name: 'seedly-mcp',
    version: '0.1.0',
    protocol: initializeResult(),
    resource: `${origin}/seedly-mcp`,
  });
}

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  const auth = request.headers.get('authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) return unauthorized(origin);
  const token = auth.slice(7).trim();
  if (!token) return unauthorized(origin);

  const client = seedlyMcpConvex();
  const site = convexSiteUrl();
  if (!site) {
    return json({ error: { code: 'MISCONFIGURED', message: 'CONVEX_SITE_URL is not set' } }, 500);
  }

  let apiKey = token;
  if (!token.startsWith('sk_')) {
    if (!client) return json({ error: { code: 'MISCONFIGURED', message: 'Convex URL is not set' } }, 500);
    const resolved = await client.action(resolveBearerRef, { token });
    if (!resolved.ok) return unauthorized(origin);
    apiKey = resolved.apiKey;
  }

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  }

  const reply = await handleJsonRpc(message, apiExecutor({ baseUrl: site, apiKey }));
  if (!reply) return new Response(null, { status: 202, headers: corsHeaders() });
  return json(reply);
}
