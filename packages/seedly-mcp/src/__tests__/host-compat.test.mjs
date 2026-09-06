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
