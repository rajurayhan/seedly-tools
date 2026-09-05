import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs';
import { proxyToConvex } from './auth-proxy';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? '';

export { convexUrl, convexSiteUrl };
