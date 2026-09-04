import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function readJson(abs) {
  return JSON.parse(readFileSync(abs, 'utf8'));
}

export function readText(abs) {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

export function writeText(abs, src) {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, src.endsWith('\n') ? src : `${src}\n`);
}

export function writeJson(abs, value) {
  writeText(abs, `${JSON.stringify(value, null, 2)}\n`);
}

export function ownedSource(kitRoot, rel) {
  const nested = join(kitRoot, 'files', rel);
  if (existsSync(nested)) return nested;
  return join(kitRoot, rel);
}

export function copyOwnedFile(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

export function arg(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
}
