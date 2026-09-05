import { ConvexHttpClient } from 'convex/browser';

function qrHttp() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
  return url ? new ConvexHttpClient(url) : null;
}

export { qrHttp };
