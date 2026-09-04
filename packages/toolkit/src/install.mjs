import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FORBIDDEN } from './constants.mjs';
import { arg, copyOwnedFile, ownedSource, readJson, readText, writeText } from './fs.mjs';
import { assertHostCompatible } from './version.mjs';
import { applySeams } from './seams.mjs';
import { recordModule } from './registry.mjs';
import { assertOwnedFilesSafe, assertSeamsSafe, loadKit } from './load-kit.mjs';

function assertSeedlyCheckout(checkout) {
  if (!existsSync(join(checkout, 'package.json')) || !existsSync(join(checkout, 'convex'))) {
    throw new Error(`Not a Seedly checkout: ${checkout}`);
  }
}

export function runInstall({
  kitRoot,
  checkout,
  dryRun = false,
  skipTypecheck = false,
  now = new Date(),
  runTypecheck = true,
} = {}) {
  const { moduleJson, seams } = loadKit(kitRoot);
  assertSeedlyCheckout(checkout);
  const hostPkg = readJson(join(checkout, 'package.json'));
  assertHostCompatible(hostPkg, moduleJson);
  assertOwnedFilesSafe(moduleJson.ownedFiles);
  assertSeamsSafe(seams);

  const owned = moduleJson.ownedFiles;
  for (const rel of owned) {
    if (FORBIDDEN.some((f) => rel === f || rel.startsWith(f))) {
      throw new Error(`Refusing to copy forbidden path ${rel}`);
    }
    const from = ownedSource(kitRoot, rel);
    const to = join(checkout, rel);
    if (!existsSync(from)) {
      console.warn('skip missing', rel);
      continue;
    }
    if (dryRun) {
      console.log('copy', rel);
      continue;
    }
    copyOwnedFile(from, to);
  }

  for (const merge of seams.merges ?? []) {
    const src = readText(join(checkout, merge.file));
    if (src === null) {
      console.warn('skip missing seam', merge.file);
      continue;
    }
    const next = applySeams(src, merge);
    if (next === src) continue;
    if (dryRun) {
      console.log('write', merge.file);
      continue;
    }
    writeText(join(checkout, merge.file), next);
  }

  recordModule(
    checkout,
    {
      name: moduleJson.name,
      version: moduleJson.version,
      extensionApiVersion: moduleJson.extensionApiVersion,
      installedAt: now.toISOString(),
      ownedFiles: owned,
    },
    { dryRun },
  );

  if (!dryRun && !skipTypecheck && runTypecheck) {
    const result = spawnSync('npx', ['pnpm', '--filter', '@seedly-crm/web', 'typecheck'], {
      cwd: checkout,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error('Typecheck failed after install. Fix the checkout before deploying.');
    }
  }

  console.log(
    dryRun
      ? 'Dry-run complete.'
      : `Installed ${moduleJson.name} ${moduleJson.version} into ${checkout}`,
  );
  console.log('This installer never deploys. When you are ready, run npx convex deploy yourself.');
  return { ok: true, name: moduleJson.name, version: moduleJson.version };
}

export function installFromArgv(kitRoot, argv) {
  const checkout = arg(argv, '--seedly', process.cwd());
  return runInstall({
    kitRoot,
    checkout,
    dryRun: argv.includes('--dry-run'),
    skipTypecheck: argv.includes('--skip-typecheck'),
  });
}
