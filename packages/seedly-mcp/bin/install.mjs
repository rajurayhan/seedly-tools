#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { resolveOwnedHref, resolveToolkit } from './resolve-toolkit.mjs';

const { kitRoot, cliHref } = resolveToolkit(fileURLToPath(import.meta.url));
const { installFromArgv } = await import(cliHref);
const { arg } = await import(cliHref.replace(/cli\.mjs$/, 'fs.mjs'));
const { syncTools } = await import(
  resolveOwnedHref(kitRoot, 'packages/seedly-mcp/lib/generate-tools.mjs')
);
const { ensureIdentityOpenApi } = await import(
  resolveOwnedHref(kitRoot, 'packages/seedly-mcp/lib/ensure-identity-openapi.mjs')
);

async function adoptInstalledPin(checkout, { dryRun, log = console } = {}) {
  const bridge = join(checkout, 'packages/seedly-pin/src/mcp-bridge.mjs');
  if (!existsSync(bridge)) {
    if (existsSync(join(checkout, 'convex/seedlyPin/routes.ts'))) {
      log.log?.(
        'SeedlyPin is present but has no mcp-bridge.mjs — re-run the SeedlyPin zip so pin tools return',
      );
    }
    return { skipped: true };
  }
  const { applyPinMcpBridge } = await import(pathToFileURL(bridge).href);
  log.log?.('SeedlyPin is installed; merging pin tools into SeedlyMCP');
  return applyPinMcpBridge({ checkout, dryRun, log });
}

try {
  installFromArgv(kitRoot, process.argv);
  const checkout = arg(process.argv, '--seedly', process.cwd());
  const dryRun = process.argv.includes('--dry-run');
  ensureIdentityOpenApi({ checkout, dryRun });
  const adopted = await adoptInstalledPin(checkout, { dryRun });
  if (adopted?.skipped) {
    syncTools({ checkout, dryRun });
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
