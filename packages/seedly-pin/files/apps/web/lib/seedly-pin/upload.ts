/** Convex storage upload tokens are hex. Reject anything else so the proxy cannot be pointed at another host. */
export function pinUploadToken(value: string | null | undefined): string | null {
  if (!value || !/^[a-fA-F0-9]{32,256}$/.test(value)) return null;
  return value;
}

export function pinUploadTokenFromUrl(url: string): string | null {
  try {
    return pinUploadToken(new URL(url).searchParams.get('token'));
  } catch {
    return null;
  }
}

/**
 * Storage uploads live on the Convex backend (.convex.cloud / CONVEX_URL),
 * not the HTTP site (.convex.site / CONVEX_SITE_URL). Self-hosted Docker
 * serves them on the backend port (3310), not the site port (3311).
 */
export function convexStorageUrl(): string {
  return (
    process.env['CONVEX_URL'] ||
    process.env['NEXT_PUBLIC_CONVEX_URL'] ||
    ''
  ).replace(/\/$/, '');
}

export function pinStorageUploadUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/api/storage/upload?token=${token}`;
}

/**
 * Convex getUrl often points at an internal Docker host or the .site HTTP
 * port. Only the /api/storage path + query is trusted; the origin is rebuilt
 * onto CONVEX_URL so the Next proxy can fetch the bytes.
 */
export function pinStoragePath(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    if (!parsed.pathname.startsWith('/api/storage/')) return null;
    if (parsed.pathname.includes('..')) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function pinStorageReadUrl(fileUrl: string): string | null {
  const path = pinStoragePath(fileUrl);
  const origin = convexStorageUrl();
  if (!path || !origin) return null;
  return `${origin}${path}`;
}

export function pinFileProxySrc(fileUrl: string | null | undefined): string | null {
  if (!fileUrl || !pinStoragePath(fileUrl)) return null;
  return `/api/seedly-pin/file?src=${encodeURIComponent(fileUrl)}`;
}
