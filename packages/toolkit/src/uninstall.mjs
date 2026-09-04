import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { arg, readText, writeText } from './fs.mjs';
import { stripMatchingLines, stripPlanFeature } from './seams.mjs';
import { unrecordModule } from './registry.mjs';
import { loadKit } from './load-kit.mjs';

export function runUninstall({ kitRoot, checkout, yes = false } = {}) {
  if (!yes) {
    throw new Error('Refusing to uninstall without --yes');
  }
  const { moduleJson, seams } = loadKit(kitRoot);

  for (const rel of moduleJson.ownedFiles) {
    const abs = join(checkout, rel);
    if (existsSync(abs)) rmSync(abs, { force: true });
  }

  for (const rule of seams.uninstall?.stripLines ?? []) {
    const abs = join(checkout, rule.file);
    const src = readText(abs);
    if (src === null) continue;
    writeText(abs, stripMatchingLines(src, rule.pattern));
  }

  for (const rule of seams.uninstall?.stripPlanFeatures ?? []) {
    const abs = join(checkout, rule.file);
    const src = readText(abs);
    if (src === null) continue;
    writeText(abs, stripPlanFeature(src, rule.key));
  }

  unrecordModule(checkout, moduleJson.name);
  console.log(
    `Removed ${moduleJson.name} owned files and seam spreads. Empty leftover module tables in Convex before the next deploy.`,
  );
  return { ok: true, name: moduleJson.name };
}

export function uninstallFromArgv(kitRoot, argv) {
  const checkout = arg(argv, '--seedly', process.cwd());
  return runUninstall({
    kitRoot,
    checkout,
    yes: argv.includes('--yes'),
  });
}
