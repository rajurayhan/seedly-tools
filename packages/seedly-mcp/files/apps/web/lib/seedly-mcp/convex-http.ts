import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { getServerConvexUrl } from '@/lib/convex-urls';

const exchangeTokenRef = makeFunctionReference<'action'>('seedlyMcp/http:exchangeToken');
const registerClientRef = makeFunctionReference<'action'>('seedlyMcp/http:registerClient');
const resolveBearerRef = makeFunctionReference<'action'>('seedlyMcp/http:resolveBearer');
const revokeTokenRef = makeFunctionReference<'action'>('seedlyMcp/http:revokeToken');
const rememberCimdRef = makeFunctionReference<'action'>('seedlyMcp/http:rememberCimdClient');

export function seedlyMcpConvex(): ConvexHttpClient | null {
  const url = getServerConvexUrl();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export {
  exchangeTokenRef,
  registerClientRef,
  resolveBearerRef,
  revokeTokenRef,
  rememberCimdRef,
};

export function convexSiteUrl(): string {
  const site =
    process.env.CONVEX_SITE_URL ||
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
    (process.env.NEXT_PUBLIC_CONVEX_URL ?? '').replace('.convex.cloud', '.convex.site');
  return site.replace(/\/$/, '');
}
