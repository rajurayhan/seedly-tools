#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolveOwnedHref, resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { doctorFromArgv } = await import(cliHref);
const { arg } = await import(cliHref.replace(/cli\.mjs$/, 'fs.mjs'));
const { checkCatalog } = await import(
  resolveOwnedHref(kitRoot, 'packages/seedly-mcp/lib/generate-tools.mjs')
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
