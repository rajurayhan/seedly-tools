/**
 * SeedlyPin ↔ SeedlyMCP merge. Owned so a later SeedlyMCP reinstall can
 * re-adopt pin tools from the host without the pin zip on disk.
 *
 * Detects MCP by files on the host (allow-map / generate-tools), not by
 * assuming install order. Inserts only into ALLOW_MAP, FALLBACK_TOOLS, and
 * TOOL_GROUPS. Never into BLOCKED_V1_TOOLS.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ALLOW_MAP_REL = 'packages/seedly-mcp/lib/allow-map.mjs';
export const FALLBACK_REL = 'packages/seedly-mcp/lib/fallback-tools.mjs';
export const TOOL_GROUPS_REL = 'packages/seedly-mcp/lib/tool-groups.mjs';
export const GENERATE_REL = 'packages/seedly-mcp/lib/generate-tools.mjs';

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

const START = '// seedly-pin-start';
const END = '// seedly-pin-end';

export function mcpPresent(checkout) {
  return existsSync(join(checkout, ALLOW_MAP_REL)) || existsSync(join(checkout, GENERATE_REL));
}

export function pinPresent(checkout) {
  return (
    existsSync(join(checkout, 'packages/seedly-pin/src/mcp-bridge.mjs')) ||
    existsSync(join(checkout, 'convex/seedlyPin/routes.ts'))
  );
}

export function pinAllowMapLines() {
  return PIN_ALLOW_ENTRIES.map(
    (e) => `  { operationId: '${e.operationId}', name: '${e.name}' }, // seedly-pin`,
  );
}

function insertBeforeNamedArrayClose(src, exportName, block) {
  const start = src.indexOf(`export const ${exportName} = [`);
  if (start === -1) return { src, inserted: false, ok: false };
  const close = src.indexOf('\n];', start);
  if (close === -1) return { src, inserted: false, ok: false };
  return { src: `${src.slice(0, close)}\n${block}${src.slice(close)}`, inserted: true, ok: true };
}

export function insertPinAllowMap(src) {
  if (src.includes("operationId: 'listPins'") || src.includes("name: 'list_pins'")) {
    return { src, inserted: false };
  }
  const lines = pinAllowMapLines().join('\n');
  return insertBeforeNamedArrayClose(src, 'ALLOW_MAP', lines);
}

export function stripPinAllowMap(src) {
  return src
    .split('\n')
    .filter((line) => !line.includes('// seedly-pin') && !line.includes("operationId: 'listPins'"))
    .join('\n');
}

function pinFallbackBlock() {
  const rows = PIN_ALLOW_ENTRIES.map((e) => {
    const path = {
      list_pins: '/api/v1/ext/seedly-pin/pins',
      create_pin: '/api/v1/ext/seedly-pin/pins',
      get_pin: '/api/v1/ext/seedly-pin/pins/{id}',
      update_pin: '/api/v1/ext/seedly-pin/pins/{id}',
      list_pin_files: '/api/v1/ext/seedly-pin/pins/{id}/files',
      list_pin_notes: '/api/v1/ext/seedly-pin/pins/{id}/notes',
      add_pin_note: '/api/v1/ext/seedly-pin/pins/{id}/notes',
      list_pin_history: '/api/v1/ext/seedly-pin/pins/{id}/history',
      export_pin_diagnostics: '/api/v1/ext/seedly-pin/pins/{id}/export',
      pin_stats: '/api/v1/ext/seedly-pin/stats',
      list_pin_assignable_users: '/api/v1/ext/seedly-pin/assignable-users',
    }[e.name];
    const method = {
      create_pin: 'POST',
      update_pin: 'PATCH',
      add_pin_note: 'POST',
    }[e.name] ?? 'GET';
    const needsId = path.includes('{id}');
    const extra = [];
    if (e.name === 'list_pins') extra.push(`    queryParams: ['status', 'priority', 'search'],`);
    if (e.name === 'export_pin_diagnostics') extra.push(`    queryParams: ['format'],`);
    if (needsId) extra.push(`    pathParams: ['id'],`, `    required: ['id'],`);
    return [
      `  {`,
      `    name: '${e.name}',`,
      `    method: '${method}',`,
      `    path: '${path}',`,
      `    description: 'SeedlyPin ${e.name.replaceAll('_', ' ')}',`,
      ...extra,
      `  },`,
    ].join('\n');
  });
  return `  ${START}\n${rows.join('\n')}\n  ${END}`;
}

export function insertPinFallbackTools(src) {
  if (src.includes(START) || src.includes("name: 'list_pins'")) {
    return { src, inserted: false };
  }
  return insertBeforeNamedArrayClose(src, 'FALLBACK_TOOLS', pinFallbackBlock());
}

function pinToolGroupBlock() {
  const names = PIN_ALLOW_ENTRIES.map((e) => `      '${e.name}',`).join('\n');
  return `  ${START}\n  {\n    title: 'Pins',\n    names: [\n${names}\n    ],\n  },\n  ${END}`;
}

export function insertPinToolGroup(src) {
  if (src.includes(START) || src.includes("title: 'Pins'")) {
    return { src, inserted: false };
  }
  return insertBeforeNamedArrayClose(src, 'TOOL_GROUPS', pinToolGroupBlock());
}

export function stripPinMarkedBlock(src) {
  const re = new RegExp(`\\s*${START}[\\s\\S]*?${END}\\n?`, 'g');
  return src.replace(re, '\n');
}

function writeIfChanged(abs, current, next, dryRun) {
  if (next === current) return false;
  if (!dryRun) writeFileSync(abs, next.endsWith('\n') ? next : `${next}\n`);
  return true;
}

function patchFile(checkout, rel, insertFn, { dryRun }) {
  const abs = join(checkout, rel);
  if (!existsSync(abs)) return { skipped: true, inserted: false };
  const current = readFileSync(abs, 'utf8');
  const { src, inserted, ok } = insertFn(current);
  if (ok === false) return { skipped: false, inserted: false, ok: false };
  if (inserted) writeIfChanged(abs, current, src, dryRun);
  return { skipped: false, inserted: Boolean(inserted), ok: true };
}

export function applyPinAllowMap({ checkout, dryRun = false, log = console } = {}) {
  const result = patchFile(checkout, ALLOW_MAP_REL, insertPinAllowMap, { dryRun });
  if (result.skipped) log.log?.('no SeedlyMCP allow-map present; skipped pin tool entries');
  else if (result.ok === false) log.warn?.('SeedlyMCP allow-map has no ALLOW_MAP insert point');
  else if (result.inserted) log.log?.(dryRun ? 'would add SeedlyPin tools to allow-map' : 'added SeedlyPin tools to SeedlyMCP allow-map');
  else log.log?.('SeedlyMCP allow-map already has SeedlyPin tools');
  return result;
}

export function revertPinAllowMap({ checkout, dryRun = false, log = console } = {}) {
  const abs = join(checkout, ALLOW_MAP_REL);
  if (!existsSync(abs)) return { changed: false };
  const current = readFileSync(abs, 'utf8');
  const next = stripPinAllowMap(current);
  const changed = writeIfChanged(abs, current, next, dryRun);
  if (changed) log.log?.(dryRun ? 'would revert SeedlyPin allow-map lines' : 'reverted SeedlyPin allow-map lines');
  return { changed };
}

export async function syncPinTools({ checkout, dryRun = false, log = console } = {}) {
  const gen = join(checkout, GENERATE_REL);
  if (!existsSync(gen)) return { skipped: true };
  if (dryRun) {
    log.log?.('would refresh SeedlyMCP tools.mjs with pin operations');
    return { skipped: false, dryRun: true };
  }
  const { syncTools } = await import(pathToFileURL(gen).href);
  const result = syncTools({ checkout, dryRun, log });
  return { skipped: false, ...result };
}

export async function applyPinMcpBridge({ checkout, dryRun = false, log = console } = {}) {
  if (!mcpPresent(checkout)) {
    log.log?.('SeedlyMCP is not installed; skipped pin MCP merge');
    return { skipped: true, changed: [] };
  }

  const changed = [];
  const allow = applyPinAllowMap({ checkout, dryRun, log });
  if (allow.inserted) changed.push(ALLOW_MAP_REL);

  const fallback = patchFile(checkout, FALLBACK_REL, insertPinFallbackTools, { dryRun });
  if (fallback.ok === false) log.warn?.('SeedlyMCP fallback-tools.mjs has no FALLBACK_TOOLS insert point');
  else if (fallback.inserted) {
    changed.push(FALLBACK_REL);
    log.log?.(dryRun ? 'would add SeedlyPin fallback tools' : 'added SeedlyPin fallback tools');
  }

  const synced = await syncPinTools({ checkout, dryRun, log });
  if (synced.wrote) changed.push('packages/seedly-mcp/lib/tools.mjs');

  const groups = patchFile(checkout, TOOL_GROUPS_REL, insertPinToolGroup, { dryRun });
  if (groups.ok === false) log.warn?.('SeedlyMCP tool-groups.mjs has no TOOL_GROUPS insert point');
  else if (groups.inserted) {
    changed.push(TOOL_GROUPS_REL);
    log.log?.(dryRun ? 'would add SeedlyPin tool group' : 'added SeedlyPin tool group');
  }

  return { skipped: false, changed, synced };
}

export async function revertPinMcpBridge({ checkout, dryRun = false, log = console } = {}) {
  const changed = [];
  if (revertPinAllowMap({ checkout, dryRun, log }).changed) changed.push(ALLOW_MAP_REL);

  for (const rel of [FALLBACK_REL, TOOL_GROUPS_REL]) {
    const abs = join(checkout, rel);
    if (!existsSync(abs)) continue;
    const current = readFileSync(abs, 'utf8');
    const next = stripPinMarkedBlock(current);
    if (writeIfChanged(abs, current, next, dryRun)) {
      changed.push(rel);
      log.log?.(dryRun ? `would revert ${rel}` : `reverted ${rel}`);
    }
  }

  const synced = await syncPinTools({ checkout, dryRun, log });
  if (synced.wrote) changed.push('packages/seedly-mcp/lib/tools.mjs');
  return { changed };
}

export function pinMcpDoctor(checkout, log = console) {
  if (!mcpPresent(checkout)) return { skipped: true, ok: true, checks: [] };
  const checks = [];
  const allow = existsSync(join(checkout, ALLOW_MAP_REL)) ? readFileSync(join(checkout, ALLOW_MAP_REL), 'utf8') : '';
  const fallback = existsSync(join(checkout, FALLBACK_REL)) ? readFileSync(join(checkout, FALLBACK_REL), 'utf8') : '';
  const groups = existsSync(join(checkout, TOOL_GROUPS_REL)) ? readFileSync(join(checkout, TOOL_GROUPS_REL), 'utf8') : '';
  const rules = [
    [allow.includes("operationId: 'listPins'") && !allow.slice(allow.indexOf('BLOCKED_V1_TOOLS')).includes("operationId: 'listPins'"), 'SeedlyMCP allow-map lists pin tools on ALLOW_MAP, not BLOCKED_V1_TOOLS'],
    [fallback.includes("name: 'list_pins'"), 'SeedlyMCP fallback-tools include list_pins'],
    [groups.includes("title: 'Pins'"), 'SeedlyMCP tool-groups include a Pins group'],
  ];
  for (const [ok, message] of rules) {
    checks.push({ ok, message });
    if (ok) log.log('ok ', message);
    else log.error('ERR', message);
  }
  return { skipped: false, ok: checks.every((c) => c.ok), checks };
}
