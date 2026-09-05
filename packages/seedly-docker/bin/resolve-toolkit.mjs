import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
