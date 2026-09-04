import { ZERO_IMPORT_FILES } from './constants.mjs';

function applyOp(src, op, file) {
  switch (op.kind) {
    case 'ensureImport': {
      if (ZERO_IMPORT_FILES.includes(file)) {
        throw new Error(`Refusing to add an import to zero-import leaf ${file}`);
      }
      const marker = op.marker ?? op.code;
      if (src.includes(marker)) return src;
      if (op.preferAfter && src.includes(op.preferAfter)) {
        return src.replace(op.preferAfter, `${op.preferAfter}\n${op.code}`);
      }
      return `${op.code}\n${src}`;
    }
    case 'insertAfter': {
      if (op.skipIf && src.includes(op.skipIf)) return src;
      if (!src.includes(op.after)) return src;
      return src.replace(op.after, `${op.after}${op.insert}`);
    }
    case 'insertAfterFirstMatch': {
      for (const after of op.candidates ?? []) {
        if (src.includes(after)) {
          return src.replace(after, `${after}${op.insert}`);
        }
      }
      if (op.fallback?.after && src.includes(op.fallback.after)) {
        return src.replace(op.fallback.after, `${op.fallback.after}${op.fallback.insert}`);
      }
      return src;
    }
    case 'insertPlanFeature': {
      const key = op.feature?.key;
      if (!key) throw new Error('insertPlanFeature needs feature.key');
      if (src.includes(`key: '${key}'`) || src.includes(`key: "${key}"`)) return src;
      const group = op.feature.group ?? 'Add-ons';
      const block = `  {
    key: '${key}',
    label: '${op.feature.label}',
    group: '${group}',
  },
];
`;
      return src.replace(/\]\s*;\s*$/, block);
    }
    case 'ensureContains': {
      if (src.includes(op.needle)) return src;
      return `${src.trimEnd()}\n${op.insert}\n`;
    }
    case 'replace': {
      if (!src.includes(op.from)) return src;
      return src.replace(op.from, op.to);
    }
    case 'replaceIfMissing': {
      if (src.includes(op.needle)) return src;
      if (!src.includes(op.from)) return src;
      return src.replace(op.from, op.to);
    }
    default:
      throw new Error(`Unknown seam op ${op.kind}`);
  }
}

export function applySeams(src, merge) {
  if (merge.ifMissing && src.includes(merge.ifMissing)) return src;
  let next = src;
  for (const op of merge.ops ?? []) {
    next = applyOp(next, op, merge.file);
  }
  return next;
}

export function stripMatchingLines(src, pattern) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  return src
    .split('\n')
    .filter((line) => !re.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function stripPlanFeature(src, key) {
  const re = new RegExp(
    `\\s*\\{\\s*key: ['"]${key}['"],[\\s\\S]*?group: ['"][^'"]+['"],\\s*\\},`,
  );
  return src.replace(re, '');
}
