import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

import { runInstall } from '../install.mjs';
import { runUninstall } from '../uninstall.mjs';
import { runDoctor } from '../doctor.mjs';
import { runPack } from '../pack.mjs';
import { satisfiesRange } from '../version.mjs';
import { assertOwnedFilesSafe } from '../load-kit.mjs';
import { readRegistry } from '../registry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const hostFixture = join(repoRoot, 'fixtures/seedly-host');
const miniKit = join(repoRoot, 'fixtures/mini-addon');
const ghlKit = join(repoRoot, 'packages/ghl-import');
const seedlyMcpKit = join(repoRoot, 'packages/seedly-mcp');
const seedlyDockerKit = join(repoRoot, 'packages/seedly-docker');
const seedlyCoolifyKit = join(repoRoot, 'packages/seedly-coolify');
const loginAsKit = join(repoRoot, 'packages/login-as');
const seedlyPinKit = join(repoRoot, 'packages/seedly-pin');
const toolkitRoot = join(repoRoot, 'packages/toolkit');

function silentLog() {
  return { log() {}, error() {} };
}

function cloneHost() {
  const dir = mkdtempSync(join(tmpdir(), 'seedly-host-'));
  cpSync(hostFixture, dir, { recursive: true });
  return dir;
}

function read(checkout, rel) {
  return readFileSync(join(checkout, rel), 'utf8');
}

test('version range accepts 5.7.x and 5.8.x', () => {
  const range = '>=5.7.0 <5.9.0';
  assert.equal(satisfiesRange('5.7.0', range), true);
  assert.equal(satisfiesRange('5.7.9', range), true);
  assert.equal(satisfiesRange('5.8.0', range), true);
  assert.equal(satisfiesRange('5.8.12', range), true);
  assert.equal(satisfiesRange('5.6.9', range), false);
  assert.equal(satisfiesRange('5.9.0', range), false);
});

test('ownedFiles may not claim shared seams', () => {
  assert.throws(
    () => assertOwnedFilesSafe(['convex/extensions/index.ts']),
    /shared seam/,
  );
  assert.throws(() => assertOwnedFilesSafe(['convex/http.ts']), /forbidden/);
});

test('install copies files, merges seams, and records .modules.json', () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: miniKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
      now: new Date('2026-09-05T00:00:00.000Z'),
    });
    assert.equal(read(checkout, 'packages/mini/hello.txt').trim(), 'hello from mini');
    const index = read(checkout, 'convex/extensions/index.ts');
    assert.match(index, /_m0\.extensionTables/);
    assert.match(index, /miniTables/);
    const plan = read(checkout, 'apps/web/lib/extension-plan-features.ts');
    assert.match(plan, /key: 'dispatch'/);
    assert.match(plan, /key: 'mini'/);
    assert.equal(/^\s*import\s/m.test(plan), false);
    const registry = readRegistry(checkout);
    assert.equal(registry.modules.some((m) => m.name === 'dispatch'), true);
    const mini = registry.modules.find((m) => m.name === 'mini');
    assert.ok(mini);
    assert.deepEqual(mini.ownedFiles, ['packages/mini/hello.txt']);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('uninstall leaves the other module', () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: miniKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    runUninstall({ kitRoot: miniKit, checkout, yes: true });
    assert.equal(existsSync(join(checkout, 'packages/mini/hello.txt')), false);
    assert.equal(existsSync(join(checkout, 'convex/dispatch/jobs.ts')), true);
    const index = read(checkout, 'convex/extensions/index.ts');
    assert.match(index, /_m0\.extensionTables/);
    assert.equal(index.includes('miniTables'), false);
    const plan = read(checkout, 'apps/web/lib/extension-plan-features.ts');
    assert.match(plan, /key: 'dispatch'/);
    assert.equal(plan.includes("key: 'mini'"), false);
    const registry = readRegistry(checkout);
    assert.equal(registry.modules.some((m) => m.name === 'dispatch'), true);
    assert.equal(registry.modules.some((m) => m.name === 'mini'), false);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('doctor fails before install and passes after', () => {
  const checkout = cloneHost();
  try {
    const before = runDoctor({ kitRoot: miniKit, checkout, log: silentLog() });
    assert.equal(before.ok, false);
    runInstall({
      kitRoot: miniKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const after = runDoctor({ kitRoot: miniKit, checkout, log: silentLog() });
    assert.equal(after.ok, true);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('install rejects a host outside the Seedly range', () => {
  const checkout = cloneHost();
  try {
    writeFileSync(
      join(checkout, 'package.json'),
      `${JSON.stringify({ name: 'seedly-crm', version: '5.9.0', extensionApiVersion: 1 }, null, 2)}\n`,
    );
    assert.throws(
      () =>
        runInstall({
          kitRoot: miniKit,
          checkout,
          skipTypecheck: true,
          runTypecheck: false,
        }),
      /5\.9\.0/,
    );
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('ghl-import merges next to Dispatch and doctor passes', () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: ghlKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const index = read(checkout, 'convex/extensions/index.ts');
    assert.match(index, /_m0\.extensionTables/);
    assert.match(index, /ghlImportTables/);
    assert.match(index, /HighLevel import/);
    const nav = read(checkout, 'apps/web/lib/extensions.ts');
    assert.match(nav, /dispatch\/nav/);
    assert.match(nav, /ghl-import\/nav/);
    const plan = read(checkout, 'apps/web/lib/extension-plan-features.ts');
    assert.match(plan, /key: 'dispatch'/);
    assert.match(plan, /key: 'ghl_import'/);
    assert.equal(/^\s*import\s/m.test(plan), false);
    assert.equal(existsSync(join(checkout, 'convex/ghlImport/api.ts')), true);
    const doctor = runDoctor({ kitRoot: ghlKit, checkout, log: silentLog() });
    assert.equal(doctor.ok, true, doctor.checks.filter((c) => !c.ok).map((c) => c.message).join('; '));

    runUninstall({ kitRoot: ghlKit, checkout, yes: true });
    assert.equal(existsSync(join(checkout, 'convex/ghlImport/api.ts')), false);
    assert.equal(existsSync(join(checkout, 'convex/dispatch/jobs.ts')), true);
    const after = read(checkout, 'convex/extensions/index.ts');
    assert.match(after, /_m0\.extensionTables/);
    assert.equal(after.includes('ghlImportTables'), false);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('seedly-mcp merges the empty 5.7 extension-subjects leaf and repairs a half-applied install', () => {
  const checkout = cloneHost();
  try {
    writeFileSync(
      join(checkout, 'apps/web/lib/extension-subjects.ts'),
      `import * as _seedlyMcp from './seedly-mcp/subjects';
export const extensionSubjects = [] as const;
export type ExtensionSubject = (typeof extensionSubjects)[number];
`,
    );
    runInstall({
      kitRoot: seedlyMcpKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const repaired = read(checkout, 'apps/web/lib/extension-subjects.ts');
    assert.match(repaired, /from '\.\/seedly-mcp\/subjects'/);
    assert.match(repaired, /\[\.\.\._seedlyMcp\.extensionSubjects\] as const/);
    assert.equal(repaired.includes('export const extensionSubjects = [] as const;'), false);

    writeFileSync(
      join(checkout, 'apps/web/lib/extension-subjects.ts'),
      `export const extensionSubjects = [] as const;
export type ExtensionSubject = (typeof extensionSubjects)[number];
`,
    );
    runInstall({
      kitRoot: seedlyMcpKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const fresh = read(checkout, 'apps/web/lib/extension-subjects.ts');
    assert.match(fresh, /from '\.\/seedly-mcp\/subjects'/);
    assert.match(fresh, /\[\.\.\._seedlyMcp\.extensionSubjects\] as const/);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('seedly-mcp installs on the fixture host and doctor passes', () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: seedlyMcpKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const plan = read(checkout, 'apps/web/lib/extension-plan-features.ts');
    assert.match(plan, /key: 'dispatch'/);
    assert.match(plan, /key: 'seedly_mcp'/);
    assert.match(plan, /label: 'SeedlyMCP'/);
    assert.equal(/^\s*import\s/m.test(plan), false);
    const paths = read(checkout, 'apps/web/lib/extension-public-paths.ts');
    assert.match(paths, /'\/seedly-mcp'/);
    assert.equal(/^\s*import\s/m.test(paths), false);
    assert.equal(existsSync(join(checkout, 'packages/seedly-mcp/server.mjs')), true);
    assert.equal(existsSync(join(checkout, 'convex/http.ts')), false);
    const registry = readRegistry(checkout);
    const entry = registry.modules.find((m) => m.name === 'seedly-mcp');
    assert.ok(entry);
    assert.equal((entry.ownedFiles ?? []).includes('convex/http.ts'), false);
    const doctor = runDoctor({ kitRoot: seedlyMcpKit, checkout, log: silentLog() });
    assert.equal(doctor.ok, true, doctor.checks.filter((c) => !c.ok).map((c) => c.message).join('; '));

    runUninstall({ kitRoot: seedlyMcpKit, checkout, yes: true });
    assert.equal(existsSync(join(checkout, 'packages/seedly-mcp/server.mjs')), false);
    assert.equal(existsSync(join(checkout, 'convex/dispatch/jobs.ts')), true);
    const afterPlan = read(checkout, 'apps/web/lib/extension-plan-features.ts');
    assert.match(afterPlan, /key: 'dispatch'/);
    assert.equal(afterPlan.includes("key: 'seedly_mcp'"), false);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('seedly-docker copies ops files, patches host URLs, and uninstall restores them', async () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: seedlyDockerKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const { applyHostPatches, revertHostPatches } = await import(
      join(seedlyDockerKit, 'bin/patch-host.mjs')
    );
    applyHostPatches(checkout, { log: silentLog() });

    assert.equal(existsSync(join(checkout, 'compose.yaml')), true);
    assert.equal(existsSync(join(checkout, 'docker.mk')), true);
    assert.match(read(checkout, 'compose.yaml'), /name: seedly-crm/);
    assert.match(read(checkout, 'apps/web/lib/auth-server.ts'), /seedly-docker\/convex-urls/);
    assert.match(read(checkout, 'apps/web/lib/auth-server.ts'), /getServerConvexUrl/);
    assert.match(read(checkout, 'apps/web/lib/security-headers.ts'), /\/\/ seedly-docker/);
    assert.match(read(checkout, 'convex/actions/invoicePdf.ts'), /INTERNAL_APP_URL \/\* seedly-docker \*\//);
    assert.equal(read(checkout, 'scripts/docker-seed.sh').includes('sulusDockerSeed'), false);
    assert.equal(read(checkout, 'scripts/docker-seed.sh').includes('raju@sulus.ai'), false);

    const doctor = runDoctor({ kitRoot: seedlyDockerKit, checkout, log: silentLog() });
    assert.equal(doctor.ok, true, doctor.checks.filter((c) => !c.ok).map((c) => c.message).join('; '));

    revertHostPatches(checkout, { log: silentLog() });
    runUninstall({ kitRoot: seedlyDockerKit, checkout, yes: true });
    assert.equal(existsSync(join(checkout, 'compose.yaml')), false);
    assert.equal(existsSync(join(checkout, 'apps/web/lib/seedly-docker/convex-urls.ts')), false);
    assert.equal(read(checkout, 'apps/web/lib/auth-server.ts').includes('seedly-docker'), false);
    assert.match(read(checkout, 'apps/web/lib/auth-server.ts'), /NEXT_PUBLIC_CONVEX_URL/);
    assert.equal(read(checkout, 'convex/actions/invoicePdf.ts').includes('seedly-docker'), false);
    assert.equal(existsSync(join(checkout, 'convex/dispatch/jobs.ts')), true);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('seedly-coolify includes Coolify compose and the Docker runtime', async () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: seedlyCoolifyKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const { applyHostPatches } = await import(join(seedlyCoolifyKit, 'bin/patch-host.mjs'));
    applyHostPatches(checkout, { log: silentLog() });
    assert.equal(existsSync(join(checkout, 'compose.coolify.yaml')), true);
    assert.equal(existsSync(join(checkout, 'compose.yaml')), true);
    assert.equal(existsSync(join(checkout, 'docker/Dockerfile.convex-init')), true);
    assert.match(read(checkout, 'compose.coolify.yaml'), /name: seedly-crm/);
    assert.equal(read(checkout, '.env.coolify.example').includes('raju@sulus.ai'), false);
    const doctor = runDoctor({ kitRoot: seedlyCoolifyKit, checkout, log: silentLog() });
    assert.equal(doctor.ok, true, doctor.checks.filter((c) => !c.ok).map((c) => c.message).join('; '));
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('login-as merges seams, patches host chrome, and uninstall restores them', async () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: loginAsKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const { applyHostPatches, revertHostPatches } = await import(
      join(loginAsKit, 'bin/patch-host.mjs')
    );
    applyHostPatches(checkout, { log: silentLog() });

    assert.match(read(checkout, 'convex/extensions/index.ts'), /loginAsTables/);
    assert.match(read(checkout, 'apps/web/lib/extension-plan-features.ts'), /key: 'login_as'/);
    assert.equal(/^\s*import\s/m.test(read(checkout, 'apps/web/lib/extension-plan-features.ts')), false);
    assert.match(read(checkout, 'apps/web/lib/extension-signout-hooks.ts'), /id: 'login-as'/);
    assert.match(read(checkout, 'convex/_helpers.ts'), /applyAddonLoginAsOverlay/);
    assert.match(read(checkout, 'convex/_helpers.ts'), /let user = await resolveUserBySubject/);
    assert.match(read(checkout, 'convex/_actionAuth.ts'), /applyAddonLoginAsOverlay/);
    assert.match(read(checkout, 'apps/web/app/(dashboard)/layout.tsx'), /LoginAsBar/);
    assert.match(read(checkout, 'apps/web/components/navigation/topbar.tsx'), /LoginAsMenuItem/);
    assert.equal(existsSync(join(checkout, 'convex/loginAs/api.ts')), true);
    assert.equal(existsSync(join(checkout, 'convex/http.ts')), false);
    const registry = readRegistry(checkout);
    const entry = registry.modules.find((m) => m.name === 'login-as');
    assert.ok(entry);
    assert.equal((entry.ownedFiles ?? []).includes('convex/_helpers.ts'), false);
    assert.equal((entry.ownedFiles ?? []).includes('convex/http.ts'), false);

    const doctor = runDoctor({ kitRoot: loginAsKit, checkout, log: silentLog() });
    assert.equal(doctor.ok, true, doctor.checks.filter((c) => !c.ok).map((c) => c.message).join('; '));

    revertHostPatches(checkout, { log: silentLog() });
    runUninstall({ kitRoot: loginAsKit, checkout, yes: true });
    assert.equal(existsSync(join(checkout, 'convex/loginAs/api.ts')), false);
    assert.equal(existsSync(join(checkout, 'convex/dispatch/jobs.ts')), true);
    assert.equal(read(checkout, 'convex/_helpers.ts').includes('applyAddonLoginAsOverlay'), false);
    assert.match(read(checkout, 'convex/_helpers.ts'), /const user = await resolveUserBySubject/);
    assert.equal(read(checkout, 'apps/web/app/(dashboard)/layout.tsx').includes('LoginAsBar'), false);
    assert.equal(read(checkout, 'apps/web/lib/extension-plan-features.ts').includes("key: 'login_as'"), false);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('login-as reports a seam gap when getAuthContext markers are missing', async () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: loginAsKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    writeFileSync(
      join(checkout, 'convex/_helpers.ts'),
      'export async function getAuthContext() { return null; }\n',
    );
    const { applyHostPatches } = await import(join(loginAsKit, 'bin/patch-host.mjs'));
    assert.throws(
      () => applyHostPatches(checkout, { log: silentLog() }),
      /seam gap/,
    );
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('seedly-pin merges seams, patches chrome, and uninstall restores them', async () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: seedlyPinKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    const { applyHostPatches, revertHostPatches } = await import(
      join(seedlyPinKit, 'bin/patch-host.mjs')
    );
    await applyHostPatches(checkout, { log: silentLog() });

    assert.match(read(checkout, 'convex/extensions/index.ts'), /seedlyPinTables/);
    assert.match(read(checkout, 'convex/extensions/snapshot.ts'), /seedlyPins/);
    assert.match(read(checkout, 'apps/web/lib/extensions.ts'), /seedly-pin\/nav/);
    assert.match(read(checkout, 'convex/extensions/apiRoutes.ts'), /seedlyPinRoutes/);
    assert.equal(read(checkout, 'apps/web/lib/extension-plan-features.ts').includes("key: 'seedly_pin'"), false);
    assert.match(read(checkout, 'apps/web/app/(dashboard)/layout.tsx'), /SeedlyPinFab/);
    assert.match(read(checkout, 'apps/web/app/(dashboard)/settings/layout.tsx'), /\/settings\/pins/);
    assert.match(read(checkout, 'docs/openapi.yaml'), /operationId: listPins/);
    assert.match(read(checkout, 'docs/openapi.yaml'), /operationId: exportPinDiagnostics/);
    assert.match(read(checkout, 'packages/seedly-mcp/lib/allow-map.mjs'), /list_pins/);
    assert.equal(existsSync(join(checkout, 'convex/seedlyPin/api.ts')), true);
    assert.equal(existsSync(join(checkout, 'convex/http.ts')), false);
    const registry = readRegistry(checkout);
    const entry = registry.modules.find((m) => m.name === 'seedly-pin');
    assert.ok(entry);
    assert.equal((entry.ownedFiles ?? []).includes('convex/http.ts'), false);
    assert.equal((entry.ownedFiles ?? []).includes('apps/web/app/(dashboard)/layout.tsx'), false);

    const doctor = runDoctor({ kitRoot: seedlyPinKit, checkout, log: silentLog() });
    assert.equal(doctor.ok, true, doctor.checks.filter((c) => !c.ok).map((c) => c.message).join('; '));

    await revertHostPatches(checkout, { log: silentLog() });
    runUninstall({ kitRoot: seedlyPinKit, checkout, yes: true });
    assert.equal(existsSync(join(checkout, 'convex/seedlyPin/api.ts')), false);
    assert.equal(existsSync(join(checkout, 'convex/dispatch/jobs.ts')), true);
    assert.equal(read(checkout, 'apps/web/app/(dashboard)/layout.tsx').includes('SeedlyPinFab'), false);
    assert.equal(read(checkout, 'apps/web/app/(dashboard)/settings/layout.tsx').includes('/settings/pins'), false);
    assert.equal(read(checkout, 'docs/openapi.yaml').includes('listPins'), false);
    assert.equal(read(checkout, 'packages/seedly-mcp/lib/allow-map.mjs').includes('list_pins'), false);
    assert.match(read(checkout, 'packages/seedly-mcp/lib/allow-map.mjs'), /get_me/);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('seedly-pin reports a seam gap when dashboard layout markers are missing', async () => {
  const checkout = cloneHost();
  try {
    runInstall({
      kitRoot: seedlyPinKit,
      checkout,
      skipTypecheck: true,
      runTypecheck: false,
    });
    writeFileSync(join(checkout, 'apps/web/app/(dashboard)/layout.tsx'), 'export default function L() { return null; }\n');
    const { applyHostPatches } = await import(join(seedlyPinKit, 'bin/patch-host.mjs'));
    await assert.rejects(
      () => applyHostPatches(checkout, { log: silentLog() }),
      /seam gap/,
    );
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test('pack zip contains owned files and toolkit, not CRM core paths', () => {
  const distDir = mkdtempSync(join(tmpdir(), 'addon-dist-'));
  try {
    const { zipPath, name } = runPack({
      kitRoot: miniKit,
      toolkitRoot,
      distDir,
    });
    assert.equal(existsSync(zipPath), true);
    const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
    assert.match(listing, new RegExp(`${name}/packages/mini/hello.txt`));
    assert.match(listing, new RegExp(`${name}/bin/install.mjs`));
    assert.match(listing, new RegExp(`${name}/toolkit/src/install.mjs`));
    assert.match(listing, new RegExp(`${name}/module.json`));
    assert.equal(listing.includes('convex/http.ts'), false);
    assert.equal(listing.includes('SETUP/'), false);
    assert.equal(listing.includes('__tests__'), false);
  } finally {
    rmSync(distDir, { recursive: true, force: true });
  }
});
