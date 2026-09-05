import { afterEach, describe, expect, it, vi } from 'vitest';
import { getServerConvexSiteUrl, getServerConvexUrl } from '../convex-urls';
import { connectSrcForConfiguredConvex } from '../connect-src';

describe('seedly-docker convex URL helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers CONVEX_URL over the public loopback URL', () => {
    vi.stubEnv('CONVEX_URL', 'http://convex-backend:3210');
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'http://127.0.0.1:3210');
    expect(getServerConvexUrl()).toBe('http://convex-backend:3210');
  });

  it('falls back to NEXT_PUBLIC_CONVEX_URL on Convex Cloud', () => {
    vi.stubEnv('CONVEX_URL', '');
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://happy-otter-123.convex.cloud');
    expect(getServerConvexUrl()).toBe('https://happy-otter-123.convex.cloud');
  });

  it('prefers CONVEX_SITE_URL for server-side site calls', () => {
    vi.stubEnv('CONVEX_SITE_URL', 'http://convex-backend:3211');
    vi.stubEnv('NEXT_PUBLIC_CONVEX_SITE_URL', 'http://127.0.0.1:3211');
    expect(getServerConvexSiteUrl()).toBe('http://convex-backend:3211');
  });

  it('adds self-hosted Convex origins to connect-src and skips Convex Cloud', () => {
    expect(
      connectSrcForConfiguredConvex('http://127.0.0.1:3210', 'http://127.0.0.1:3211'),
    ).toEqual([
      'http://127.0.0.1:3210',
      'ws://127.0.0.1:3210',
      'http://127.0.0.1:3211',
      'ws://127.0.0.1:3211',
    ]);
    expect(
      connectSrcForConfiguredConvex(
        'https://happy-otter-123.convex.cloud',
        'https://happy-otter-123.convex.site',
      ),
    ).toEqual([]);
  });
});
