/**
 * Exact origins for a self-hosted Convex URL (Docker / on-prem).
 * Cloud `*.convex.cloud` / `*.convex.site` are already in the host CSP.
 * Do not add a host unless NEXT_PUBLIC_CONVEX_* points at it — production
 * Cloud deploys must keep 127.0.0.1 out of connect-src.
 */
export function connectSrcForConfiguredConvex(
  cloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL,
  siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
): string[] {
  const extras = new Set<string>();
  for (const raw of [cloudUrl, siteUrl]) {
    if (!raw) continue;
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith('.convex.cloud') || host.endsWith('.convex.site')) continue;
    extras.add(`${parsed.protocol}//${parsed.host}`);
    extras.add(parsed.protocol === 'https:' ? `wss://${parsed.host}` : `ws://${parsed.host}`);
  }
  return [...extras];
}
