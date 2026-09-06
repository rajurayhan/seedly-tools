import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = join(here, '../..');
const convexHttp = readFileSync(join(kit, 'files/apps/web/lib/seedly-mcp/convex-http.ts'), 'utf8');
const identityRoutes = readFileSync(join(kit, 'files/convex/seedlyMcp/identityRoutes.ts'), 'utf8');
const seams = readFileSync(join(kit, 'seams.json'), 'utf8');

test('convex-http does not import a host convex-urls module', () => {
  assert.equal(convexHttp.includes('@/lib/convex-urls'), false);
  assert.equal(convexHttp.includes('seedly-docker/convex-urls'), false);
  assert.match(convexHttp, /process\.env\[name\]/);
  assert.match(convexHttp, /CONVEX_URL/);
  assert.match(convexHttp, /NEXT_PUBLIC_CONVEX_URL/);
});

test('identity routes own their ExtensionApi types', () => {
  assert.match(identityRoutes, /from '\.\/apiRouteTypes'/);
  assert.equal(identityRoutes.includes('../extensions/apiRoutes'), false);
});

test('subject seam merges the empty 5.7 leaf and repairs a half-applied install', () => {
  assert.match(seams, /"_seedlyMcp\.extensionSubjects"/);
  assert.match(seams, /export const extensionSubjects = \[\] as const;/);
  assert.match(seams, /\[\.\.\._seedlyMcp\.extensionSubjects\] as const/);
});

test('MCP seams merge a host that already has SeedlyPin', () => {
  assert.match(seams, /\.\.\.seedlyPinTables/);
  assert.match(seams, /_seedlyPin\.extensionSubjects/);
  assert.match(seams, /_seedlyPin\.extensionPermissionModules/);
  assert.match(seams, /\.\.\.seedlyPinRoutes/);
});

test('MCP installer re-adopts SeedlyPin tools when the bridge is on the host', () => {
  const install = readFileSync(join(kit, 'bin/install.mjs'), 'utf8');
  assert.match(install, /packages\/seedly-pin\/src\/mcp-bridge\.mjs/);
  assert.match(install, /applyPinMcpBridge/);
  assert.match(install, /adoptInstalledPin/);
});

test('MCP setup lists use the shared DataTable, not a hand-rolled table', () => {
  const hub = readFileSync(
    join(kit, 'files/apps/web/app/(dashboard)/location/[locationId]/mcp-setup/_components/mcp-setup-hub.tsx'),
    'utf8',
  );
  const catalog = readFileSync(
    join(kit, 'files/apps/web/app/(dashboard)/location/[locationId]/mcp-setup/_components/mcp-tool-catalog.tsx'),
    'utf8',
  );
  const page = readFileSync(
    join(kit, 'files/apps/web/app/(dashboard)/location/[locationId]/mcp-setup/page.tsx'),
    'utf8',
  );
  assert.match(hub, /ListPageLayout/);
  assert.match(hub, /DataTable/);
  assert.match(hub, /CopyButton/);
  assert.match(hub, /Copy local snippet/);
  assert.match(hub, /Copy live snippet/);
  assert.match(hub, /Copy MCP URL/);
  assert.match(catalog, /CopyButton/);
  assert.match(catalog, /Available tools/);
  assert.ok(
    hub.indexOf('<McpToolCatalog') < hub.indexOf('Connect an assistant'),
    'Available tools must render above the connect section',
  );
  assert.equal(hub.includes('<table'), false);
  assert.equal(catalog.includes('<table'), false);
  assert.equal(catalog.includes('DataTable'), false);
  assert.equal(page.includes('p-6'), false);
});
