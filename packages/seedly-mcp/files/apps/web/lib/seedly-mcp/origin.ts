import { wwwAuthenticate } from '../../../../convex/seedlyMcp/oauthMetadata';

export function publicOrigin(request: Request): string {
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id',
    'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Session-Id',
  };
}

export function unauthorized(origin: string) {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': wwwAuthenticate(origin),
      ...corsHeaders(),
    },
  });
}

export function json(data: unknown, status = 200, extra?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...(extra ?? {}),
    },
  });
}
