/**
 * Zip-side re-export of the owned SeedlyPin ↔ SeedlyMCP bridge.
 * Resolves the owned file without the toolkit so unit tests can import this.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const found = [
  join(kitRoot, 'files/packages/seedly-pin/src/mcp-bridge.mjs'),
  join(kitRoot, 'packages/seedly-pin/src/mcp-bridge.mjs'),
].find(existsSync);
if (!found) {
  throw new Error('Could not find packages/seedly-pin/src/mcp-bridge.mjs in this SeedlyPin kit.');
}
const bridge = await import(pathToFileURL(found).href);

export const {
  ALLOW_MAP_REL,
  PIN_ALLOW_ENTRIES,
  pinAllowMapLines,
  insertPinAllowMap,
  stripPinAllowMap,
  applyPinAllowMap,
  revertPinAllowMap,
  insertPinFallbackTools,
  insertPinToolGroup,
  stripPinMarkedBlock,
  applyPinMcpBridge,
  revertPinMcpBridge,
  syncPinTools,
  mcpPresent,
  pinPresent,
  pinMcpDoctor,
} = bridge;
