#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { uninstallFromArgv } = await import(cliHref);
try {
  uninstallFromArgv(kitRoot, process.argv);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
