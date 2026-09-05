const CONNECT_SRC_DEV_EXTRA = ['http://127.0.0.1:*', 'ws://127.0.0.1:*'];

export function buildCspDirectives(opts: { isDev: boolean }): string[] {
  const connectSrc = ["'self'"];
  if (opts.isDev) connectSrc.push(...CONNECT_SRC_DEV_EXTRA);
  return [`connect-src ${connectSrc.join(' ')}`];
}
