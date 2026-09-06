import { NextResponse } from 'next/server';
import { pinStorageReadUrl } from '@/lib/seedly-pin/upload';

/**
 * Same-origin hop for pin screenshots on the detail page. Convex getUrl
 * returns a backend/internal host (or the .site port, which 404s /api/storage).
 * The browser <img> cannot load those; this route fetches from CONVEX_URL.
 * Only /api/storage paths are forwarded.
 */
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  if (!src) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const upstreamUrl = pinStorageReadUrl(src);
  if (!upstreamUrl) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  }

  const upstream = await fetch(upstreamUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'File not found' }, { status: upstream.status === 404 ? 404 : 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
