#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveToolkit } from './resolve-toolkit.mjs';
import { applyHostPatches } from './patch-host.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { runInstall } = await import(cliHref);
const { arg } = await import(pathToFileURL(join(dirname(fileURLToPath(cliHref)), 'fs.mjs')).href);

try {
  const checkout = arg(process.argv, '--seedly', process.cwd());
  const dryRun = process.argv.includes('--dry-run');
  const skipTypecheck = process.argv.includes('--skip-typecheck');
  // Copy + seams first. Host patches (FAB, settings, MCP merge) must run
  // before typecheck — a type error must not leave the UI half-installed.
  runInstall({
    kitRoot,
    checkout,
    dryRun,
    skipTypecheck: true,
    runTypecheck: false,
  });
  await applyHostPatches(checkout, { dryRun });
  if (!dryRun && !skipTypecheck) {
    const result = spawnSync('npx', ['pnpm', '--filter', '@seedly-crm/web', 'typecheck'], {
      cwd: checkout,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error('Typecheck failed after install. Fix the checkout before deploying.');
    }
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
