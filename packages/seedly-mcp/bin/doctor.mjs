#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { doctorFromArgv } = await import(cliHref);
const { arg } = await import(cliHref.replace(/cli\.mjs$/, 'fs.mjs'));
const { checkCatalog } = await import(
  pathToFileURL(join(kitRoot, 'files/packages/seedly-mcp/lib/generate-tools.mjs')).href
);

try {
  doctorFromArgv(kitRoot, process.argv);
  const checkout = arg(process.argv, '--seedly', process.cwd());
  const catalog = checkCatalog({ checkout });
  if (!catalog.ok) process.exitCode = 1;
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
