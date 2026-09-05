/**
 * Constrained OpenAPI 3.x YAML reader for Seedly docs/openapi.yaml.
 * Not a general YAML parser — it only pulls /api/v1 operations we need.
 */

const HTTP_METHODS = new Set(['get', 'post', 'patch', 'put', 'delete']);

function indentOf(line) {
  const match = line.match(/^( *)/);
  return match ? match[1].length : 0;
}

function unquote(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function pathParamsFromTemplate(path) {
  return [...String(path).matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

function parseRequiredList(text) {
  const inline = text.match(/required:\s*\[([^\]]*)\]/);
  if (inline) {
    return inline[1]
      .split(',')
      .map((part) => unquote(part.trim()))
      .filter(Boolean);
  }
  const names = [];
  const block = text.match(/required:\s*\n((?:\s+-\s+.+\n?)+)/);
  if (block) {
    for (const line of block[1].split('\n')) {
      const item = line.match(/-\s+(\S+)/);
      if (item) names.push(unquote(item[1]));
    }
  }
  return names;
}

function parsePropertyKeys(schemaText) {
  const body = schemaText.split(/\n      properties:\n/)[1];
  if (!body) return [];
  const names = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^        ([A-Za-z_][A-Za-z0-9_]*):/);
    if (match) names.push(match[1]);
  }
  return names;
}

export function extractSchema(yaml, schemaName) {
  const start = yaml.search(new RegExp(`^    ${schemaName}:\\s*$`, 'm'));
  if (start === -1) return { properties: [], required: [] };
  const rest = yaml.slice(start);
  const next = rest.slice(1).search(/^    [A-Za-z0-9_]+:\s*$/m);
  const block = next === -1 ? rest : rest.slice(0, next + 1);
  return {
    properties: parsePropertyKeys(block),
    required: parseRequiredList(block),
  };
}

function collectParams(block) {
  /** @type {{ in: string, name: string, required: boolean }[]} */
  const params = [];
  const chunks = block.split(/\n\s+-\s+/).slice(1);
  for (const chunk of chunks) {
    const name = chunk.match(/(?:^|\n)\s*name:\s*(.+)/);
    const loc = chunk.match(/(?:^|\n)\s*in:\s*(.+)/);
    if (!name || !loc) continue;
    params.push({
      name: unquote(name[1]),
      in: unquote(loc[1]),
      required: /^\s*required:\s*true\s*$/m.test(chunk) || /\n\s*required:\s*true\s/.test(chunk),
    });
  }
  return params;
}

function firstScalar(block, key) {
  const match = block.match(new RegExp(`^\\s+${key}:\\s*(.+)\\s*$`, 'm'));
  if (!match) return '';
  const value = match[1].trim();
  if (value === '|' || value === '>' || value === '>-') {
    const after = block.slice(block.indexOf(match[0]) + match[0].length);
    const lines = [];
    for (const line of after.split('\n')) {
      if (!line.startsWith('        ') && !line.startsWith('          ')) break;
      lines.push(line.trim());
    }
    return lines.filter(Boolean).join(' ');
  }
  return unquote(value);
}

function bodyRefOf(block) {
  const request = block.split(/\n\s+responses:\s*$/m)[0];
  const scoped = request.includes('requestBody:')
    ? request.slice(request.indexOf('requestBody:'))
    : request;
  const match = scoped.match(/\$ref:\s*["']?#\/components\/schemas\/([^"'\s]+)["']?/);
  return match ? match[1] : '';
}

/**
 * @param {string} yaml
 * @returns {Map<string, {
 *   operationId: string,
 *   method: string,
 *   path: string,
 *   pathParams: string[],
 *   queryParams: string[],
 *   requiredQuery: string[],
 *   bodyRef: string,
 *   summary: string,
 *   description: string,
 * }>}
 */
export function extractOperations(yaml) {
  const ops = new Map();
  const lines = yaml.split(/\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const pathMatch = line.match(/^  (\/api\/v1\/[^:]+):\s*$/);
    if (!pathMatch) {
      i += 1;
      continue;
    }
    const path = pathMatch[1];
    i += 1;
    let pathParamBlock = '';
    while (i < lines.length) {
      const inner = lines[i];
      if (inner.trim() === '') {
        i += 1;
        continue;
      }
      if (inner.match(/^  \//) || inner.match(/^  [A-Za-z]/) || inner.match(/^[A-Za-z]/)) break;
      const methodMatch = inner.match(/^    (get|post|patch|put|delete):\s*$/);
      if (inner.match(/^    parameters:\s*$/)) {
        const start = i;
        i += 1;
        while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 4)) i += 1;
        pathParamBlock = lines.slice(start, i).join('\n');
        continue;
      }
      if (!methodMatch) {
        i += 1;
        continue;
      }
      const method = methodMatch[1];
      const start = i;
      i += 1;
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 4)) i += 1;
      const block = lines.slice(start, i).join('\n');
      const operationId = firstScalar(block, 'operationId');
      if (!operationId || !HTTP_METHODS.has(method)) continue;
      const params = [...collectParams(pathParamBlock), ...collectParams(block)];
      const fromPath = pathParamsFromTemplate(path);
      const pathParams = [...new Set([...fromPath, ...params.filter((p) => p.in === 'path').map((p) => p.name)])];
      const query = params.filter((p) => p.in === 'query');
      ops.set(operationId, {
        operationId,
        method: method.toUpperCase(),
        path,
        pathParams,
        queryParams: query.map((p) => p.name),
        requiredQuery: query.filter((p) => p.required).map((p) => p.name),
        bodyRef: bodyRefOf(block),
        summary: firstScalar(block, 'summary'),
        description: firstScalar(block, 'description'),
      });
    }
  }
  return ops;
}
