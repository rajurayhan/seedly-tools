import { corsHeaders, json } from '@/lib/seedly-mcp/origin';
import { revokeTokenRef, seedlyMcpConvex } from '@/lib/seedly-mcp/convex-http';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const client = seedlyMcpConvex();
  if (!client) return json({ error: 'server_error' }, 500);
  const contentType = request.headers.get('content-type') ?? '';
  let token = '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    token = String(form.get('token') ?? '');
  } else {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    token = body.token ?? '';
  }
  if (token) await client.action(revokeTokenRef, { token });
  return json({ revoked: true });
}
