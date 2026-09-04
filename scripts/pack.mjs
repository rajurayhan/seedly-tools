#!/usr/bin/env node
/**
 * Pack a buyer zip. Vendors the toolkit. Never deploys.
 * Usage: node scripts/pack.mjs [ghl-import]
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPack } from '../packages/toolkit/src/pack.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const name = process.argv[2] ?? 'ghl-import';
const kitRoot = join(repoRoot, 'packages', name);
const toolkitRoot = join(repoRoot, 'packages/toolkit');
const distDir = join(repoRoot, 'dist');

const result = runPack({ kitRoot, toolkitRoot, distDir });
console.log(`Packed ${result.name}. Give the buyer ${result.zipPath}.`);
