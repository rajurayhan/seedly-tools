/**
 * Apply / revert self-host patches on Seedly core files.
 * Never overwrite those files. String ops only. Idempotent.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IMPORT_URLS =
  "import { getServerConvexSiteUrl, getServerConvexUrl } from './seedly-docker/convex-urls';";
const IMPORT_CSP =
  "import { connectSrcForConfiguredConvex } from './seedly-docker/connect-src';";
const CSP_PUSH = '  connectSrc.push(...connectSrcForConfiguredConvex()); // seedly-docker';
const QR_IMPORT = "import { getServerConvexUrl } from '@/lib/seedly-docker/convex-urls';";

const PDF_FILES = [
  'convex/actions/invoicePdf.ts',
  'convex/actions/documentPdf.ts',
  'convex/actions/signedSubmissionPdf.ts',
];

function read(abs) {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function write(abs, src) {
  writeFileSync(abs, src.endsWith('\n') ? src : `${src}\n`);
}

function ensureLine(src, needle, insert, after) {
  if (src.includes(needle)) return src;
  if (after && src.includes(after)) return src.replace(after, `${after}\n${insert}`);
  return `${insert}\n${src}`;
}

export function applyHostPatches(checkout, { dryRun = false, log = console } = {}) {
  const changed = [];

  const authRel = 'apps/web/lib/auth-server.ts';
  let auth = read(join(checkout, authRel));
  if (auth && !auth.includes('getServerConvexUrl')) {
    auth = ensureLine(auth, IMPORT_URLS, IMPORT_URLS, "import { proxyToConvex } from './auth-proxy';");
    auth = auth.replace(
      "const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';",
      'const convexUrl = getServerConvexUrl();',
    );
    auth = auth.replace(
      "const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? '';",
      'const convexSiteUrl = getServerConvexSiteUrl();',
    );
    if (!dryRun) write(join(checkout, authRel), auth);
    changed.push(authRel);
  }

  const cspRel = 'apps/web/lib/security-headers.ts';
  let csp = read(join(checkout, cspRel));
  if (csp && !csp.includes('connectSrcForConfiguredConvex')) {
    const lastImport = [...csp.matchAll(/^import .+$/gm)].pop()?.[0];
    csp = ensureLine(csp, IMPORT_CSP, IMPORT_CSP, lastImport);
    const devPush = csp.match(/if \([^)]*isDev\) connectSrc\.push\(\.\.\.CONNECT_SRC_DEV_EXTRA\);/);
    if (devPush) {
      csp = csp.replace(devPush[0], `${devPush[0]}\n${CSP_PUSH}`);
    }
    if (!dryRun) write(join(checkout, cspRel), csp);
    changed.push(cspRel);
  }

  const qrRel = 'apps/web/app/q/[code]/route.ts';
  let qr = read(join(checkout, qrRel));
  if (qr && !qr.includes('getServerConvexUrl')) {
    qr = ensureLine(qr, QR_IMPORT, QR_IMPORT, "import { ConvexHttpClient } from 'convex/browser';");
    qr = qr.replace(
      /const url = process\.env\.NEXT_PUBLIC_CONVEX_URL(?: \?\? '')?;/,
      'const url = getServerConvexUrl();',
    );
    if (!dryRun) write(join(checkout, qrRel), qr);
    changed.push(qrRel);
  }

  const cookieOptsRel = 'convex/authOptions.ts';
  let cookieOpts = read(join(checkout, cookieOptsRel));
  if (cookieOpts && !cookieOpts.includes("cookiePrefix: 'seedly-crm'")) {
    cookieOpts = cookieOpts.replace(
      `advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    },
  },`,
      `advanced: {
    cookiePrefix: 'seedly-crm',
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: !(process.env.SITE_URL ?? '').startsWith('http://'),
      httpOnly: true,
    },
  },`,
    );
    if (!dryRun) write(join(checkout, cookieOptsRel), cookieOpts);
    changed.push(cookieOptsRel);
  }

  const mwRel = 'apps/web/middleware.ts';
  let mw = read(join(checkout, mwRel));
  if (mw && mw.includes('getSessionCookie(request)') && !mw.includes("cookiePrefix: 'seedly-crm'")) {
    mw = mw.replace(
      'const session = getSessionCookie(request);',
      "const session = getSessionCookie(request, { cookiePrefix: 'seedly-crm' });",
    );
    if (!dryRun) write(join(checkout, mwRel), mw);
    changed.push(mwRel);
  }

  const originsRel = 'convex/auth.ts';
  let origins = read(join(checkout, originsRel));
  if (origins && !origins.includes('http://localhost:3100')) {
    origins = origins.replace(
      `'http://localhost:3001',
        'http://127.0.0.1:3001',`,
      `'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3100',
        'http://127.0.0.1:3100',`,
    );
    if (!dryRun) write(join(checkout, originsRel), origins);
    changed.push(originsRel);
  }

  const stockAppUrl = 'process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? process.env.SITE_URL';
  const patchedAppUrl =
    'process.env.INTERNAL_APP_URL /* seedly-docker */ ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? process.env.SITE_URL';
  for (const rel of PDF_FILES) {
    const src = read(join(checkout, rel));
    if (!src || src.includes('INTERNAL_APP_URL')) continue;
    if (!src.includes(stockAppUrl)) continue;
    if (!dryRun) write(join(checkout, rel), src.replace(stockAppUrl, patchedAppUrl));
    changed.push(rel);
  }

  if (changed.length) log.log(dryRun ? 'would patch' : 'patched', changed.join(', '));
  else log.log('host already has self-host URL helpers; no core patches needed');
  return changed;
}

export function revertHostPatches(checkout, { dryRun = false, log = console } = {}) {
  const changed = [];

  const authRel = 'apps/web/lib/auth-server.ts';
  let auth = read(join(checkout, authRel));
  if (auth?.includes('seedly-docker/convex-urls')) {
    auth = auth.replace(`${IMPORT_URLS}\n`, '');
    auth = auth.replace('const convexUrl = getServerConvexUrl();', "const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';");
    auth = auth.replace(
      'const convexSiteUrl = getServerConvexSiteUrl();',
      "const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? '';",
    );
    if (!dryRun) write(join(checkout, authRel), auth);
    changed.push(authRel);
  }

  const cspRel = 'apps/web/lib/security-headers.ts';
  let csp = read(join(checkout, cspRel));
  if (csp?.includes('seedly-docker/connect-src') || csp?.includes('// seedly-docker')) {
    csp = csp.replace(`${IMPORT_CSP}\n`, '');
    csp = csp.replace(`${CSP_PUSH}\n`, '');
    if (!dryRun) write(join(checkout, cspRel), csp);
    changed.push(cspRel);
  }

  const qrRel = 'apps/web/app/q/[code]/route.ts';
  let qr = read(join(checkout, qrRel));
  if (qr?.includes('seedly-docker/convex-urls')) {
    qr = qr.replace(`${QR_IMPORT}\n`, '');
    qr = qr.replace('const url = getServerConvexUrl();', "const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';");
    if (!dryRun) write(join(checkout, qrRel), qr);
    changed.push(qrRel);
  }

  const cookieOptsRelRevert = 'convex/authOptions.ts';
  let cookieOptsRevert = read(join(checkout, cookieOptsRelRevert));
  if (cookieOptsRevert?.includes("cookiePrefix: 'seedly-crm'")) {
    cookieOptsRevert = cookieOptsRevert.replace(
      `advanced: {
    cookiePrefix: 'seedly-crm',
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: !(process.env.SITE_URL ?? '').startsWith('http://'),
      httpOnly: true,
    },
  },`,
      `advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    },
  },`,
    );
    if (!dryRun) write(join(checkout, cookieOptsRelRevert), cookieOptsRevert);
    changed.push(cookieOptsRelRevert);
  }

  const mwRelRevert = 'apps/web/middleware.ts';
  let mwRevert = read(join(checkout, mwRelRevert));
  if (mwRevert?.includes("cookiePrefix: 'seedly-crm'")) {
    mwRevert = mwRevert.replace(
      "const session = getSessionCookie(request, { cookiePrefix: 'seedly-crm' });",
      'const session = getSessionCookie(request);',
    );
    if (!dryRun) write(join(checkout, mwRelRevert), mwRevert);
    changed.push(mwRelRevert);
  }

  const originsRelRevert = 'convex/auth.ts';
  let originsRevert = read(join(checkout, originsRelRevert));
  if (originsRevert?.includes('http://localhost:3100')) {
    originsRevert = originsRevert.replace(
      `'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3100',
        'http://127.0.0.1:3100',`,
      `'http://localhost:3001',
        'http://127.0.0.1:3001',`,
    );
    if (!dryRun) write(join(checkout, originsRelRevert), originsRevert);
    changed.push(originsRelRevert);
  }

  const marked =
    'process.env.INTERNAL_APP_URL /* seedly-docker */ ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? process.env.SITE_URL';
  const stock = 'process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? process.env.SITE_URL';
  for (const rel of PDF_FILES) {
    const src = read(join(checkout, rel));
    if (!src?.includes('/* seedly-docker */')) continue;
    if (!dryRun) write(join(checkout, rel), src.replace(marked, stock));
    changed.push(rel);
  }

  if (changed.length) log.log(dryRun ? 'would revert' : 'reverted', changed.join(', '));
  return changed;
}
