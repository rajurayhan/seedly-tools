/**
 * If the buyer already has SeedlyMCP, append pin operationIds so sync-tools
 * emits list_pins / get_pin / export_pin_diagnostics. No-op when the file
 * is missing. Never overwrite the whole allow-map.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ALLOW_MAP_REL = 'packages/seedly-mcp/lib/allow-map.mjs';

export const PIN_ALLOW_ENTRIES = [
  { operationId: 'listPins', name: 'list_pins' },
  { operationId: 'createPin', name: 'create_pin' },
  { operationId: 'getPin', name: 'get_pin' },
  { operationId: 'updatePin', name: 'update_pin' },
  { operationId: 'listPinFiles', name: 'list_pin_files' },
  { operationId: 'listPinNotes', name: 'list_pin_notes' },
  { operationId: 'addPinNote', name: 'add_pin_note' },
  { operationId: 'listPinHistory', name: 'list_pin_history' },
  { operationId: 'exportPinDiagnostics', name: 'export_pin_diagnostics' },
  { operationId: 'pinStats', name: 'pin_stats' },
  { operationId: 'listPinAssignableUsers', name: 'list_pin_assignable_users' },
];

export function pinAllowMapLines() {
  return PIN_ALLOW_ENTRIES.map(
    (e) => `  { operationId: '${e.operationId}', name: '${e.name}' }, // seedly-pin`,
  );
}

export function insertPinAllowMap(src) {
  if (src.includes("operationId: 'listPins'") || src.includes("name: 'list_pins'")) {
    return { src, inserted: false };
  }
  const lines = pinAllowMapLines().join('\n');
  const close = src.lastIndexOf('\n];');
  if (close === -1) {
    return { src, inserted: false, ok: false };
  }
  return { src: `${src.slice(0, close)}\n${lines}${src.slice(close)}`, inserted: true, ok: true };
}

export function stripPinAllowMap(src) {
  return src
    .split('\n')
    .filter((line) => !line.includes('// seedly-pin') && !line.includes("operationId: 'listPins'"))
    .join('\n');
}

export function applyPinAllowMap({ checkout, dryRun = false, log = console } = {}) {
  const file = join(checkout, ALLOW_MAP_REL);
  if (!existsSync(file)) {
    log.log?.('no SeedlyMCP allow-map present; skipped pin tool entries');
    return { skipped: true, inserted: false };
  }
  const current = readFileSync(file, 'utf8');
  const { src, inserted, ok } = insertPinAllowMap(current);
  if (ok === false) {
    log.warn?.('SeedlyMCP allow-map has no insert point');
    return { skipped: false, inserted: false, ok: false };
  }
  if (!inserted) {
    log.log?.('SeedlyMCP allow-map already has SeedlyPin tools');
    return { skipped: false, inserted: false };
  }
  if (!dryRun) writeFileSync(file, src.endsWith('\n') ? src : `${src}\n`);
  log.log?.(dryRun ? 'would add SeedlyPin tools to allow-map' : 'added SeedlyPin tools to SeedlyMCP allow-map');
  return { skipped: false, inserted: true };
}

export function revertPinAllowMap({ checkout, dryRun = false, log = console } = {}) {
  const file = join(checkout, ALLOW_MAP_REL);
  if (!existsSync(file)) return { changed: false };
  const current = readFileSync(file, 'utf8');
  if (!current.includes('seedly-pin') && !current.includes("operationId: 'listPins'")) {
    return { changed: false };
  }
  const next = stripPinAllowMap(current);
  if (next === current) return { changed: false };
  if (!dryRun) writeFileSync(file, next.endsWith('\n') ? next : `${next}\n`);
  log.log?.(dryRun ? 'would revert SeedlyPin allow-map lines' : 'reverted SeedlyPin allow-map lines');
  return { changed: true };
}
