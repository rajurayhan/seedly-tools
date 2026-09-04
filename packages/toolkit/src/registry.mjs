import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MODULES_FILENAME, MODULES_FORMAT } from './constants.mjs';
import { readJson, writeJson } from './fs.mjs';

export function readRegistry(checkout) {
  const path = join(checkout, MODULES_FILENAME);
  if (!existsSync(path)) return { format: MODULES_FORMAT, modules: [] };
  const parsed = readJson(path);
  const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
  return { format: parsed.format ?? MODULES_FORMAT, modules };
}

export function recordModule(checkout, entry, { dryRun } = {}) {
  const current = readRegistry(checkout);
  const modules = current.modules;
  const next = { ...entry };
  const idx = modules.findIndex((m) => m.name === entry.name);
  if (idx >= 0) modules[idx] = { ...modules[idx], ...next };
  else modules.push(next);
  if (dryRun) return { format: MODULES_FORMAT, modules };
  writeJson(join(checkout, MODULES_FILENAME), { format: MODULES_FORMAT, modules });
  return { format: MODULES_FORMAT, modules };
}

export function unrecordModule(checkout, name) {
  const path = join(checkout, MODULES_FILENAME);
  if (!existsSync(path)) return;
  const current = readRegistry(checkout);
  current.modules = current.modules.filter((m) => m.name !== name);
  writeJson(path, current);
}
