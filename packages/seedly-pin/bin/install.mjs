#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveToolkit } from './resolve-toolkit.mjs';
import { applyHostPatches } from './patch-host.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { installFromArgv } = await import(cliHref);
const { arg } = await import(pathToFileURL(join(dirname(fileURLToPath(cliHref)), 'fs.mjs')).href);

try {
  installFromArgv(kitRoot, process.argv);
  const checkout = arg(process.argv, '--seedly', process.cwd());
  applyHostPatches(checkout, { dryRun: process.argv.includes('--dry-run') });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
