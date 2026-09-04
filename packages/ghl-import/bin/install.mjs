#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { installFromArgv } = await import(cliHref);
try {
  installFromArgv(kitRoot, process.argv);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
