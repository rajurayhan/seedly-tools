import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SHARED_SEAMS } from './constants.mjs';
import { arg, readText } from './fs.mjs';
import { readRegistry } from './registry.mjs';
import { loadKit } from './load-kit.mjs';

export function runDoctor({ kitRoot, checkout, log = console } = {}) {
  const { moduleJson, seams } = loadKit(kitRoot);
  const checks = [];

  function check(ok, message) {
    checks.push({ ok, message });
    if (ok) log.log('ok ', message);
    else log.error('ERR', message);
  }

  const registry = readRegistry(checkout);
  const hasRegistry = existsSync(join(checkout, '.modules.json'));
  check(hasRegistry, '.modules.json exists');
  const entry = registry.modules.find((m) => m.name === moduleJson.name);
  check(!!entry, `${moduleJson.name} is recorded in .modules.json`);
  if (entry) {
    const shared = (entry.ownedFiles ?? []).filter((f) => SHARED_SEAMS.includes(f));
    check(shared.length === 0, `${moduleJson.name} does not claim exclusive ownership of shared seams`);
  }

  for (const rel of moduleJson.ownedFiles) {
    check(existsSync(join(checkout, rel)), rel);
  }

  for (const rule of seams.doctor?.contains ?? []) {
    const src = readText(join(checkout, rule.file)) ?? '';
    check(src.includes(rule.needle), rule.message ?? `${rule.file} includes ${rule.needle}`);
  }

  for (const file of seams.doctor?.zeroImport ?? []) {
    const src = readText(join(checkout, file)) ?? '';
    check(!/^\s*import\s/m.test(src), `${file} stays zero-import`);
  }

  const noImport = seams.doctor?.noImportOf;
  if (noImport?.pattern && Array.isArray(noImport.files)) {
    const re = new RegExp(noImport.pattern, 'i');
    const sources = noImport.files.map((rel) => readText(join(checkout, rel)) ?? '');
    check(
      sources.every((src) => !re.test(src)),
      noImport.message ?? `add-on sources do not match ${noImport.pattern}`,
    );
  }

  const problems = checks.filter((c) => !c.ok).length;
  return { ok: problems === 0, problems, checks };
}

export function doctorFromArgv(kitRoot, argv) {
  const checkout = arg(argv, '--seedly', process.cwd());
  const result = runDoctor({ kitRoot, checkout });
  if (!result.ok) process.exitCode = 1;
  return result;
}
