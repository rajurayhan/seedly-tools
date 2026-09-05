#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { arg } = await import(cliHref.replace(/cli\.mjs$/, 'fs.mjs'));
const { syncTools } = await import(
  pathToFileURL(join(kitRoot, 'files/packages/seedly-mcp/lib/generate-tools.mjs')).href
);

try {
  const checkout = arg(process.argv, '--seedly', process.cwd());
  const dryRun = process.argv.includes('--dry-run');
  syncTools({ checkout, dryRun, requireOpenApi: true });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
