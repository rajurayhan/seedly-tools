import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveToolkit(fromBinFile) {
  const kitRoot = resolve(dirname(fromBinFile), '..');
  const candidates = [
    join(kitRoot, 'toolkit/src/cli.mjs'),
    join(kitRoot, '../../toolkit/src/cli.mjs'),
  ];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error('Could not find the add-on toolkit next to this kit.');
  }
  return { kitRoot, cliHref: pathToFileURL(found).href };
}

/** Dev kit: files/<rel>. Packed zip: <rel> at the zip root. */
export function resolveOwnedHref(kitRoot, rel) {
  const candidates = [join(kitRoot, 'files', rel), join(kitRoot, rel)];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(`Could not find ${rel} in this SeedlyPin zip.`);
  }
  return pathToFileURL(found).href;
}
