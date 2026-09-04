#!/usr/bin/env node
/**
 * Local SeedlyMCP (stdio). Cursor / Claude Desktop start this with a Seedly API key.
 * Vendored protocol — no npm install required to run this file.
 */
import { assertLocalEnv } from './lib/client.mjs';
import { apiExecutor } from './lib/mcp-protocol.mjs';
import { runStdio } from './lib/stdio.mjs';

try {
  const { baseUrl, apiKey } = assertLocalEnv(process.env);
  await runStdio(apiExecutor({ baseUrl, apiKey }));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
