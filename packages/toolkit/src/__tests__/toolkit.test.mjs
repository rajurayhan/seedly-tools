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

test('version range accepts 5.8.x only', () => {
  assert.equal(satisfiesRange('5.8.0', '>=5.8.0 <5.9.0'), true);
  assert.equal(satisfiesRange('5.8.12', '>=5.8.0 <5.9.0'), true);
  assert.equal(satisfiesRange('5.7.9', '>=5.8.0 <5.9.0'), false);
  assert.equal(satisfiesRange('5.9.0', '>=5.8.0 <5.9.0'), false);
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
