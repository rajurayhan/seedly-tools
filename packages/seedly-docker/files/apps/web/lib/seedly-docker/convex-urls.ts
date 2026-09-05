/**
 * Convex URL helpers for self-hosted Docker / Coolify.
 *
 * Browser bundles must use NEXT_PUBLIC_* (localhost or the public FQDN).
 * Server-side code in Docker should prefer CONVEX_URL / CONVEX_SITE_URL so
 * Next can reach the backend container over compose DNS.
 *
 * Read via process.env[name] (not process.env.NAME). Next.js replaces the
 * dotted form at `next build` with whatever was set then. CONVEX_* is unset
 * during the Docker image build, so the dotted form becomes empty forever and
 * getToken falls through to NEXT_PUBLIC_ loopback — which is this container,
 * not Convex (ECONNREFUSED 127.0.0.1:3211).
 */
function runtimeEnv(name: string): string {
  return process.env[name] ?? '';
}

export function getServerConvexUrl(): string {
  return runtimeEnv('CONVEX_URL') || runtimeEnv('NEXT_PUBLIC_CONVEX_URL') || '';
}

export function getServerConvexSiteUrl(): string {
  return runtimeEnv('CONVEX_SITE_URL') || runtimeEnv('NEXT_PUBLIC_CONVEX_SITE_URL') || '';
}

export function getBrowserConvexSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  }
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
  return cloud.replace('.convex.cloud', '.convex.site').replace('.cloud', '.site');
}
