/**
 * Insert login-as overlay + chrome into the buyer checkout.
 * Never overwrite host files. Marker-based. Idempotent. Revert strips only our lines.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARK = 'login-as';

const HELPERS_IMPORT =
  "import { applyAddonLoginAsOverlay } from './loginAs/overlay'; // login-as";
const ACTION_IMPORT =
  "import { applyAddonLoginAsOverlay } from './loginAs/overlay'; // login-as";
const OVERLAY_LINE = '  ({ user } = await applyAddonLoginAsOverlay(ctx, user)); // login-as';
const ACTION_OVERLAY_LINE =
  '    ({ user } = await applyAddonLoginAsOverlay(ctx, user)); // login-as';

const LAYOUT_IMPORT = "import { LoginAsBar } from '@/lib/login-as/bar'; // login-as";
const LAYOUT_MOUNT = '        <LoginAsBar />';

const TOPBAR_IMPORT = "import { LoginAsMenuItem } from '@/lib/login-as/menu'; // login-as";
const TOPBAR_ITEM = '        <LoginAsMenuItem />';

const RESOLVE_SUBJECT_CONST = 'const user = await resolveUserBySubject(ctx, identity.subject);';
const RESOLVE_SUBJECT_LET = 'let user = await resolveUserBySubject(ctx, identity.subject);';
const RESOLVE_ACTION_CONST = 'const user = await resolveUserBySubject(ctx, args.subject);';
const RESOLVE_ACTION_LET = 'let user = await resolveUserBySubject(ctx, args.subject);';

const INACTIVE_BLOCK = `  if (!user.isActive) {
    throw new ConvexError('Not authenticated');
  }`;

const ACTION_INACTIVE = `    if (!user.isActive) throw new ConvexError('Not authenticated');`;

function read(abs) {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function write(abs, src) {
  writeFileSync(abs, src.endsWith('\n') ? src : `${src}\n`);
}

function ensureImport(src, line) {
  if (src.includes(line) || src.includes("from './loginAs/overlay'")) return src;
  const lastImport = [...src.matchAll(/^import .+$/gm)].pop()?.[0];
  if (lastImport) return src.replace(lastImport, `${lastImport}\n${line}`);
  return `${line}\n${src}`;
}

function patchHelpers(src) {
  let next = ensureImport(src, HELPERS_IMPORT);
  if (next.includes(RESOLVE_SUBJECT_CONST)) {
    next = next.replace(RESOLVE_SUBJECT_CONST, RESOLVE_SUBJECT_LET);
  }
  if (!next.includes('applyAddonLoginAsOverlay(ctx, user)')) {
    if (!next.includes(INACTIVE_BLOCK)) {
      return { src: next, ok: false };
    }
    next = next.replace(INACTIVE_BLOCK, `${INACTIVE_BLOCK}\n${OVERLAY_LINE}`);
  }
  return { src: next, ok: next.includes('applyAddonLoginAsOverlay(ctx, user)') };
}

function patchActionAuth(src) {
  let next = ensureImport(src, ACTION_IMPORT);
  if (next.includes(RESOLVE_ACTION_CONST)) {
    next = next.replace(RESOLVE_ACTION_CONST, RESOLVE_ACTION_LET);
  }
  if (!next.includes('applyAddonLoginAsOverlay(ctx, user)')) {
    if (!next.includes(ACTION_INACTIVE)) {
      return { src: next, ok: false };
    }
    next = next.replace(ACTION_INACTIVE, `${ACTION_INACTIVE}\n${ACTION_OVERLAY_LINE}`);
  }
  return { src: next, ok: next.includes('applyAddonLoginAsOverlay(ctx, user)') };
}

function patchLayout(src) {
  let next = src;
  if (!next.includes("from '@/lib/login-as/bar'")) {
    const lastImport = [...next.matchAll(/^import .+$/gm)].pop()?.[0];
    if (lastImport) next = next.replace(lastImport, `${lastImport}\n${LAYOUT_IMPORT}`);
    else next = `${LAYOUT_IMPORT}\n${next}`;
  }
  if (!next.includes('<LoginAsBar')) {
    if (!next.includes('<InitialDataProvider>')) {
      return { src: next, ok: false };
    }
    next = next.replace(
      '<InitialDataProvider>',
      `${LAYOUT_MOUNT}\n        <InitialDataProvider>`,
    );
  }
  return { src: next, ok: next.includes('<LoginAsBar') };
}

function patchTopbar(src) {
  let next = src;
  if (!next.includes("from '@/lib/login-as/menu'")) {
    const lastImport = [...next.matchAll(/^import .+$/gm)].pop()?.[0];
    if (lastImport) next = next.replace(lastImport, `${lastImport}\n${TOPBAR_IMPORT}`);
    else next = `${TOPBAR_IMPORT}\n${next}`;
  }
  if (!next.includes('<LoginAsMenuItem')) {
    const account = next.includes('href="/account/settings"')
      ? next.match(/<Link href="\/account\/settings">[\s\S]*?<\/Link>/)
      : null;
    if (account) {
      next = next.replace(account[0], `${TOPBAR_ITEM}\n        ${account[0]}`);
    } else if (next.includes('<DropdownMenuContent')) {
      next = next.replace(
        /<DropdownMenuContent[\s\S]*?>/,
        (open) => `${open}\n${TOPBAR_ITEM}`,
      );
    } else {
      return { src: next, ok: false };
    }
  }
  return { src: next, ok: next.includes('<LoginAsMenuItem') };
}

export function applyHostPatches(checkout, { dryRun = false, log = console, requireCore = true } = {}) {
  const changed = [];
  const gaps = [];

  const helpersRel = 'convex/_helpers.ts';
  const helpers = read(join(checkout, helpersRel));
  if (!helpers) {
    gaps.push(`${helpersRel} missing — cannot overlay getAuthContext`);
  } else {
    const { src, ok } = patchHelpers(helpers);
    if (!ok) gaps.push(`${helpersRel} has no getAuthContext insert point`);
    else if (src !== helpers) {
      if (!dryRun) write(join(checkout, helpersRel), src);
      changed.push(helpersRel);
    }
  }

  const actionRel = 'convex/_actionAuth.ts';
  const action = read(join(checkout, actionRel));
  if (action) {
    const { src, ok } = patchActionAuth(action);
    if (!ok) {
      gaps.push(`${actionRel} has no resolveActionAuthWithGate insert point`);
    } else if (src !== action) {
      if (!dryRun) write(join(checkout, actionRel), src);
      changed.push(actionRel);
    }
  }

  const layoutRel = 'apps/web/app/(dashboard)/layout.tsx';
  const layout = read(join(checkout, layoutRel));
  if (!layout) {
    gaps.push(`${layoutRel} missing — cannot mount LoginAsBar`);
  } else {
    const { src, ok } = patchLayout(layout);
    if (!ok) gaps.push(`${layoutRel} has no InitialDataProvider insert point`);
    else if (src !== layout) {
      if (!dryRun) write(join(checkout, layoutRel), src);
      changed.push(layoutRel);
    }
  }

  const topbarRel = 'apps/web/components/navigation/topbar.tsx';
  const topbar = read(join(checkout, topbarRel));
  if (!topbar) {
    gaps.push(`${topbarRel} missing — cannot add user-menu item`);
  } else {
    const { src, ok } = patchTopbar(topbar);
    if (!ok) gaps.push(`${topbarRel} has no user-menu insert point`);
    else if (src !== topbar) {
      if (!dryRun) write(join(checkout, topbarRel), src);
      changed.push(topbarRel);
    }
  }

  if (gaps.length && requireCore) {
    throw new Error(`login-as seam gap: ${gaps.join('; ')}`);
  }
  if (changed.length) log.log(dryRun ? 'would patch' : 'patched', changed.join(', '));
  else log.log('host already has login-as patches; no core inserts needed');
  return { changed, gaps };
}

export function revertHostPatches(checkout, { dryRun = false, log = console } = {}) {
  const changed = [];

  function revertFile(rel, transforms) {
    const abs = join(checkout, rel);
    let src = read(abs);
    if (!src || !src.includes(MARK) && !src.includes('loginAs/overlay') && !src.includes('login-as/')) {
      return;
    }
    let next = src;
    for (const fn of transforms) next = fn(next);
    if (next !== src) {
      if (!dryRun) write(abs, next);
      changed.push(rel);
    }
  }

  revertFile('convex/_helpers.ts', [
    (s) => s.replace(`${HELPERS_IMPORT}\n`, ''),
    (s) => s.replace(`${OVERLAY_LINE}\n`, ''),
    (s) => s.replace(RESOLVE_SUBJECT_LET, RESOLVE_SUBJECT_CONST),
  ]);
  revertFile('convex/_actionAuth.ts', [
    (s) => s.replace(`${ACTION_IMPORT}\n`, ''),
    (s) => s.replace(`${ACTION_OVERLAY_LINE}\n`, ''),
    (s) => s.replace(`${OVERLAY_LINE}\n`, ''),
    (s) => s.replace(RESOLVE_ACTION_LET, RESOLVE_ACTION_CONST),
  ]);
  revertFile('apps/web/app/(dashboard)/layout.tsx', [
    (s) => s.replace(`${LAYOUT_IMPORT}\n`, ''),
    (s) => s.replace(`${LAYOUT_MOUNT}\n        <InitialDataProvider>`, '<InitialDataProvider>'),
    (s) => s.replace(`${LAYOUT_MOUNT}\n`, ''),
  ]);
  revertFile('apps/web/components/navigation/topbar.tsx', [
    (s) => s.replace(`${TOPBAR_IMPORT}\n`, ''),
    (s) => s.replace(`${TOPBAR_ITEM}\n        `, ''),
    (s) => s.replace(`${TOPBAR_ITEM}\n`, ''),
  ]);

  if (changed.length) log.log(dryRun ? 'would revert' : 'reverted', changed.join(', '));
  return changed;
}
