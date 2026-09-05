import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ownedSource } from './fs.mjs';
import { loadKit } from './load-kit.mjs';

function copy(from, to) {
  if (!existsSync(from)) {
    throw new Error(`Missing ${from}`);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

function vendorToolkit(toolkitRoot, stage) {
  const dest = join(stage, 'toolkit');
  mkdirSync(join(dest, 'src'), { recursive: true });
  copy(join(toolkitRoot, 'package.json'), join(dest, 'package.json'));
  for (const name of readdirSync(join(toolkitRoot, 'src'))) {
    if (name === '__tests__') continue;
    copy(join(toolkitRoot, 'src', name), join(dest, 'src', name));
  }
}

export function runPack({
  kitRoot,
  toolkitRoot,
  distDir,
  extraFiles = ['README.md', 'ADDON-LICENSE.md', 'INSTALL.md', 'AGENTS.md', 'OPENAPI.md', 'seams.json'],
} = {}) {
  const { moduleJson } = loadKit(kitRoot);
  const name = `${moduleJson.name}-${moduleJson.version}`;
  const stage = join(distDir, name);
  const zipPath = join(distDir, `${name}.zip`);

  mkdirSync(distDir, { recursive: true });
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  copy(join(kitRoot, 'module.json'), join(stage, 'module.json'));
  copy(join(kitRoot, 'bin'), join(stage, 'bin'));
  for (const rel of extraFiles) {
    const from = join(kitRoot, rel);
    if (existsSync(from)) copy(from, join(stage, rel));
  }
  vendorToolkit(toolkitRoot, stage);
  for (const rel of moduleJson.ownedFiles) {
    copy(ownedSource(kitRoot, rel), join(stage, rel));
  }

  rmSync(zipPath, { force: true });
  const zip = spawnSync('zip', ['-r', '-q', zipPath, name], { cwd: distDir, stdio: 'inherit' });
  if (zip.status !== 0) {
    throw new Error('zip failed');
  }
  console.log(zipPath);
  return { zipPath, stage, name };
}
