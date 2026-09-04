import { protectedResourceMetadata } from '@/lib/seedly-mcp/oauth-reexport';
import { corsHeaders, json, publicOrigin } from '@/lib/seedly-mcp/origin';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function GET(request: Request) {
  return json(protectedResourceMetadata(publicOrigin(request)));
}
