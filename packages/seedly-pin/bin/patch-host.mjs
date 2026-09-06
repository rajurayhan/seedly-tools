/**
 * Insert SeedlyPin chrome + OpenAPI + optional SeedlyMCP allow-map.
 * Never overwrite host files. Marker-based. Idempotent. Revert strips only our lines.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyPinMcpBridge, revertPinMcpBridge } from './allow-map.mjs';
import { ensurePinOpenApi, revertPinOpenApi } from './openapi.mjs';

const MARK = 'seedly-pin';

const LAYOUT_IMPORT = "import { SeedlyPinFab } from '@/lib/seedly-pin/fab'; // seedly-pin";
const LAYOUT_MOUNT = '          <SeedlyPinFab />';

const SETTINGS_TAB = "  { label: 'Pins', href: '/settings/pins' }, // seedly-pin";

function read(abs) {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function write(abs, src) {
  writeFileSync(abs, src.endsWith('\n') ? src : `${src}\n`);
}

function ensureImport(src, line) {
  if (src.includes(line) || src.includes("from '@/lib/seedly-pin/fab'")) return src;
  const lastImport = [...src.matchAll(/^import .+$/gm)].pop()?.[0];
  if (lastImport) return src.replace(lastImport, `${lastImport}\n${line}`);
  return `${line}\n${src}`;
}

export function patchLayout(src) {
  let next = ensureImport(src, LAYOUT_IMPORT);
  if (next.includes('<SeedlyPinFab')) {
    return { src: next, ok: true };
  }
  if (next.includes('<CommandPalette')) {
    next = next.replace(/<CommandPalette\s*\/>/, `<CommandPalette />\n${LAYOUT_MOUNT}`);
  } else if (next.includes('<SulusPinWidget')) {
    next = next.replace(/<SulusPinWidget\s*\/>/, `${LAYOUT_MOUNT}\n          <SulusPinWidget />`);
  } else if (next.includes('</InitialDataProvider>')) {
    next = next.replace('</InitialDataProvider>', `${LAYOUT_MOUNT}\n        </InitialDataProvider>`);
  } else {
    return { src: next, ok: false };
  }
  return { src: next, ok: next.includes('<SeedlyPinFab') };
}

export function patchSettingsLayout(src) {
  let next = src;
  if (next.includes("href: '/settings/pins'") || next.includes('href: "/settings/pins"')) {
    return { src: next, ok: true };
  }
  if (next.includes("{ label: 'Access', href: '/settings/access' }")) {
    next = next.replace(
      "{ label: 'Access', href: '/settings/access' },",
      `{ label: 'Access', href: '/settings/access' },\n${SETTINGS_TAB}`,
    );
  } else if (next.includes('const settingsTabs = [')) {
    next = next.replace('const settingsTabs = [', `const settingsTabs = [\n${SETTINGS_TAB}`);
  } else {
    return { src: next, ok: false };
  }
  return { src: next, ok: next.includes('/settings/pins') };
}

export async function applyHostPatches(checkout, { dryRun = false, log = console, requireCore = true } = {}) {
  const changed = [];
  const gaps = [];

  const layoutRel = 'apps/web/app/(dashboard)/layout.tsx';
  const layout = read(join(checkout, layoutRel));
  if (!layout) {
    gaps.push(`${layoutRel} missing — cannot mount SeedlyPinFab`);
  } else {
    const { src, ok } = patchLayout(layout);
    if (!ok) gaps.push(`${layoutRel} has no CommandPalette / InitialDataProvider insert point`);
    else if (src !== layout) {
      if (!dryRun) write(join(checkout, layoutRel), src);
      changed.push(layoutRel);
    }
  }

  const settingsRel = 'apps/web/app/(dashboard)/settings/layout.tsx';
  const settings = read(join(checkout, settingsRel));
  if (!settings) {
    gaps.push(`${settingsRel} missing — cannot add Pins settings tab`);
  } else {
    const { src, ok } = patchSettingsLayout(settings);
    if (!ok) gaps.push(`${settingsRel} has no settingsTabs insert point`);
    else if (src !== settings) {
      if (!dryRun) write(join(checkout, settingsRel), src);
      changed.push(settingsRel);
    }
  }

  const openapi = ensurePinOpenApi({ checkout, dryRun, log });
  if (openapi.inserted) changed.push('docs/openapi.yaml');

  const mcp = await applyPinMcpBridge({ checkout, dryRun, log });
  if (mcp.changed?.length) changed.push(...mcp.changed);

  if (gaps.length && requireCore) {
    throw new Error(`seedly-pin seam gap: ${gaps.join('; ')}`);
  }
  if (changed.length) log.log(dryRun ? 'would patch' : 'patched', changed.join(', '));
  else log.log('host already has seedly-pin patches; no core inserts needed');
  return { changed, gaps };
}

export async function revertHostPatches(checkout, { dryRun = false, log = console } = {}) {
  const changed = [];

  function revertFile(rel, transforms) {
    const abs = join(checkout, rel);
    let src = read(abs);
    if (!src || (!src.includes(MARK) && !src.includes('seedly-pin/'))) return;
    let next = src;
    for (const fn of transforms) next = fn(next);
    if (next !== src) {
      if (!dryRun) write(abs, next);
      changed.push(rel);
    }
  }

  revertFile('apps/web/app/(dashboard)/layout.tsx', [
    (s) => s.replace(`${LAYOUT_IMPORT}\n`, ''),
    (s) => s.replace(`${LAYOUT_MOUNT}\n        </InitialDataProvider>`, '</InitialDataProvider>'),
    (s) => s.replace(`${LAYOUT_MOUNT}\n`, ''),
  ]);
  revertFile('apps/web/app/(dashboard)/settings/layout.tsx', [
    (s) => s.replace(`${SETTINGS_TAB}\n`, ''),
  ]);

  if (revertPinOpenApi({ checkout, dryRun, log }).changed) changed.push('docs/openapi.yaml');
  const mcpRevert = await revertPinMcpBridge({ checkout, dryRun, log });
  if (mcpRevert.changed?.length) changed.push(...mcpRevert.changed);

  if (changed.length) log.log(dryRun ? 'would revert' : 'reverted', changed.join(', '));
  return changed;
}
