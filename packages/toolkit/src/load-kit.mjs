import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FORBIDDEN, SHARED_SEAMS, ZERO_IMPORT_FILES } from './constants.mjs';
import { readJson } from './fs.mjs';

export function loadKit(kitRoot) {
  const moduleJson = readJson(join(kitRoot, 'module.json'));
  const seamsPath = join(kitRoot, 'seams.json');
  const seams = existsSync(seamsPath) ? readJson(seamsPath) : { merges: [] };
  if (!moduleJson.name || !Array.isArray(moduleJson.ownedFiles)) {
    throw new Error('module.json must have name and ownedFiles');
  }
  return { moduleJson, seams };
}

export function assertOwnedFilesSafe(ownedFiles) {
  for (const rel of ownedFiles) {
    if (FORBIDDEN.some((f) => rel === f || rel.startsWith(f))) {
      throw new Error(`Refusing to copy forbidden path ${rel}`);
    }
    if (SHARED_SEAMS.includes(rel)) {
      throw new Error(`Refusing exclusive ownership of shared seam ${rel}`);
    }
  }
}

export function assertSeamsSafe(seams) {
  for (const merge of seams.merges ?? []) {
    if (!ZERO_IMPORT_FILES.includes(merge.file)) continue;
    for (const op of merge.ops ?? []) {
      if (op.kind === 'ensureImport') {
        throw new Error(`Refusing to add an import to zero-import leaf ${merge.file}`);
      }
    }
  }
}
