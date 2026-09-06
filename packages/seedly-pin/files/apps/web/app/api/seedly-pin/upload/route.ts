import { NextResponse } from 'next/server';
import { convexSiteUrl, pinStorageUploadUrl, pinUploadToken } from '@/lib/seedly-pin/upload';

/**
 * Same-origin hop for pin screenshots. The browser cannot POST to self-hosted
 * Convex storage (localhost:3100 → 127.0.0.1:3311 is a CORS preflight miss).
 * This route forwards the bytes server-side to /api/storage/upload.
 */
export async function POST(request: Request) {
  const token = pinUploadToken(request.headers.get('x-seedly-pin-upload-token'));
  const site = convexSiteUrl();
  if (!token || !site) {
    return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
  }

  const contentType = request.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
  }

  const body = await request.arrayBuffer();
  if (!body.byteLength) {
    return NextResponse.json({ error: 'Empty upload' }, { status: 400 });
  }
  if (body.byteLength > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'Screenshot too large' }, { status: 413 });
  }

  const upstream = await fetch(pinStorageUploadUrl(site, token), {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  });
}
