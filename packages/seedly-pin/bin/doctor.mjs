#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveOwnedHref, resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { doctorFromArgv } = await import(cliHref);
const { arg } = await import(pathToFileURL(join(dirname(fileURLToPath(cliHref)), 'fs.mjs')).href);
const { pinMcpDoctor } = await import(resolveOwnedHref(kitRoot, 'packages/seedly-pin/src/mcp-bridge.mjs'));

try {
  const checkout = arg(process.argv, '--seedly', process.cwd());
  const result = doctorFromArgv(kitRoot, process.argv);
  const mcp = pinMcpDoctor(checkout);
  if (result && result.ok === false) process.exitCode = 1;
  if (mcp && mcp.ok === false) process.exitCode = 1;
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
