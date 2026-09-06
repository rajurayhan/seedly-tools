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

export function convexSiteUrl(): string {
  return (
    process.env['CONVEX_SITE_URL'] ||
    process.env['NEXT_PUBLIC_CONVEX_SITE_URL'] ||
    ''
  ).replace(/\/$/, '');
}

export function pinStorageUploadUrl(site: string, token: string): string {
  return `${site.replace(/\/$/, '')}/api/storage/upload?token=${token}`;
}
