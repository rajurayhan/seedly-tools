#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolveOwnedHref, resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { installFromArgv } = await import(cliHref);
const { arg } = await import(cliHref.replace(/cli\.mjs$/, 'fs.mjs'));
const { syncTools } = await import(
  resolveOwnedHref(kitRoot, 'packages/seedly-mcp/lib/generate-tools.mjs')
);

try {
  installFromArgv(kitRoot, process.argv);
  const checkout = arg(process.argv, '--seedly', process.cwd());
  const dryRun = process.argv.includes('--dry-run');
  syncTools({ checkout, dryRun });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
