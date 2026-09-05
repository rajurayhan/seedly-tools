import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ALLOW_MAP, ALLOWED_METHODS, BLOCKED_OPERATION_IDS, BLOCKED_V1_TOOLS } from './allow-map.mjs';
import { FALLBACK_TOOLS } from './fallback-tools.mjs';
import { extractOperations, extractSchema } from './parse-openapi.mjs';

const TOOLS_REL = 'packages/seedly-mcp/lib/tools.mjs';
const OPENAPI_REL = 'docs/openapi.yaml';

const HELPERS = `
export function getTool(name) {
  return TOOLS.find((t) => t.name === name) ?? null;
}

export function toolRoute(name) {
  const tool = getTool(name);
  if (!tool) return null;
  return { method: tool.method, path: tool.path };
}

function stringProp(description) {
  return { type: 'string', description };
}

export function inputSchemaFor(tool) {
  /** @type {Record<string, { type: string, description?: string }>} */
  const properties = {};
  const required = [...(tool.required ?? [])];
  for (const name of tool.pathParams ?? []) {
    properties[name] = stringProp(\`Path id for \${tool.path}\`);
  }
  for (const name of tool.queryParams ?? []) {
    properties[name] = stringProp(\`Query \${name}\`);
  }
  for (const name of tool.bodyParams ?? []) {
    properties[name] = { description: \`Body field \${name}\` };
  }
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: true,
  };
}

export function mcpToolsList() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: inputSchemaFor(tool),
  }));
}

export function resolveRequest(tool, args = {}) {
  const params = args && typeof args === 'object' ? { ...args } : {};
  let path = tool.path;
  for (const name of tool.pathParams ?? []) {
    const value = params[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(\`Missing path parameter: \${name}\`);
    }
    path = path.replace(\`{\${name}}\`, encodeURIComponent(String(value)));
    delete params[name];
  }
  /** @type {Record<string, string>} */
  const query = {};
  for (const name of tool.queryParams ?? []) {
    if (params[name] !== undefined && params[name] !== null && params[name] !== '') {
      query[name] = String(params[name]);
    }
    delete params[name];
  }
  const body = tool.method === 'GET' ? undefined : params;
  return { method: tool.method, path, query, body };
}
`;

function oneLine(text, fallback) {
  const cleaned = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function cloneTool(tool) {
  return JSON.parse(JSON.stringify(tool));
}

export function catalogSignature(tools) {
  return JSON.stringify(
    (tools ?? []).map((t) => ({
      name: t.name,
      method: t.method,
      path: t.path,
      pathParams: t.pathParams ?? [],
      queryParams: t.queryParams ?? [],
      bodyParams: t.bodyParams ?? [],
      required: t.required ?? [],
    })),
  );
}

function toolFromOperation(entry, op, yaml, fallback) {
  if (BLOCKED_OPERATION_IDS.has(entry.operationId) || BLOCKED_V1_TOOLS.includes(entry.name)) {
    throw new Error(
      `OpenAPI operation ${entry.operationId} is blocked from becoming an MCP tool`,
    );
  }
  if (!ALLOWED_METHODS.has(op.method)) {
    throw new Error(
      `OpenAPI operation ${entry.operationId} uses ${op.method}, which SeedlyMCP does not expose`,
    );
  }
  if (!op.path.startsWith('/api/v1/')) {
    throw new Error(`OpenAPI operation ${entry.operationId} is not under /api/v1`);
  }

  const schema = op.bodyRef ? extractSchema(yaml, op.bodyRef) : { properties: [], required: [] };
  const bodyParams = op.method === 'GET' ? [] : schema.properties;
  const required = [
    ...op.pathParams,
    ...op.requiredQuery,
    ...(op.method === 'GET' ? [] : schema.required),
  ].filter((name, i, all) => all.indexOf(name) === i);

  return {
    name: entry.name,
    method: op.method,
    path: op.path,
    description: oneLine(op.summary || op.description, fallback.description),
    ...(op.pathParams.length ? { pathParams: op.pathParams } : {}),
    ...(op.queryParams.length ? { queryParams: op.queryParams } : {}),
    ...(bodyParams.length ? { bodyParams } : {}),
    ...(required.length ? { required } : {}),
  };
}

export function resolveOpenApiPath(checkout) {
  return join(checkout, OPENAPI_REL);
}

export function openApiPresence(checkout) {
  const file = resolveOpenApiPath(checkout);
  const docsDir = join(checkout, 'docs');
  return {
    file,
    hasFile: existsSync(file),
    hasDocsDir: existsSync(docsDir),
  };
}

export function buildCatalog(yaml, fallbacks = FALLBACK_TOOLS) {
  const ops = extractOperations(yaml);
  const byName = new Map(fallbacks.map((t) => [t.name, t]));
  const tools = [];
  const warnings = [];

  for (const entry of ALLOW_MAP) {
    const fallback = byName.get(entry.name);
    if (!fallback) {
      throw new Error(`Allow list names ${entry.name} but fallback-tools.mjs has no row`);
    }
    const op = ops.get(entry.operationId);
    if (!op) {
      tools.push(cloneTool(fallback));
      warnings.push(
        `${entry.name}: docs/openapi.yaml has no ${entry.operationId} — kept the shipped row`,
      );
      continue;
    }
    tools.push(toolFromOperation(entry, op, yaml, fallback));
  }

  const blockedSeen = [...ops.keys()].filter((id) => BLOCKED_OPERATION_IDS.has(id));
  if (blockedSeen.length && tools.some((t) => BLOCKED_V1_TOOLS.includes(t.name))) {
    throw new Error('Generated catalog included a blocked tool');
  }

  return { tools, warnings };
}

export function renderToolsModule(tools) {
  const json = JSON.stringify(tools, null, 2);
  return `/**
 * SeedlyMCP v1 tool catalog. Generated from docs/openapi.yaml.
 * Refresh with: node /path/to/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly .
 */

/** @typedef {{ name: string, method: 'GET'|'POST'|'PATCH'|'PUT', path: string, description: string, pathParams?: string[], queryParams?: string[], bodyParams?: string[], required?: string[] }} SeedlyMcpTool */

/** @type {readonly SeedlyMcpTool[]} */
export const TOOLS = ${json};

export { BLOCKED_V1_TOOLS } from './allow-map.mjs';
${HELPERS}`;
}

/**
 * @param {{ checkout: string, dryRun?: boolean, requireOpenApi?: boolean, log?: { log: Function, warn: Function, error: Function } }} opts
 */
export function syncTools({
  checkout,
  dryRun = false,
  requireOpenApi,
  log = console,
} = {}) {
  const presence = openApiPresence(checkout);
  const mustHave = requireOpenApi ?? presence.hasDocsDir;
  if (!presence.hasFile) {
    if (mustHave) {
      throw new Error(
        'docs/openapi.yaml is missing. Stock Seedly 5.8 should have this file in your Seedly folder. Restore it, then run sync-tools again.',
      );
    }
    log.warn?.(
      'docs/openapi.yaml not found — keeping the shipped tool list. Buyer Seedly folders should have this file.',
    );
    return { ok: true, skipped: true, warnings: [], wrote: false };
  }

  const yaml = readFileSync(presence.file, 'utf8');
  const { tools, warnings } = buildCatalog(yaml);
  const dest = join(checkout, TOOLS_REL);
  const next = renderToolsModule(tools);

  for (const warning of warnings) {
    log.warn?.(warning);
  }

  if (dryRun) {
    log.log?.(`Would write ${TOOLS_REL} (${tools.length} tools)`);
    return { ok: true, skipped: false, warnings, wrote: false, tools };
  }

  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, next.endsWith('\n') ? next : `${next}\n`);
  log.log?.(`Wrote ${TOOLS_REL} from docs/openapi.yaml`);
  return { ok: true, skipped: false, warnings, wrote: true, tools };
}

export function checkCatalog({ checkout, log = console } = {}) {
  const presence = openApiPresence(checkout);
  if (!presence.hasFile) {
    if (presence.hasDocsDir) {
      log.error?.(
        'ERR docs/openapi.yaml is missing. Restore it, then run: node /path/to/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly .',
      );
      return { ok: false, skipped: false };
    }
    log.log?.('ok  tool catalog (no docs/openapi.yaml — shipped list)');
    return { ok: true, skipped: true };
  }

  const yaml = readFileSync(presence.file, 'utf8');
  const { tools, warnings } = buildCatalog(yaml);
  const dest = join(checkout, TOOLS_REL);
  if (!existsSync(dest)) {
    log.error?.(
      `ERR ${TOOLS_REL} is missing. Run: node /path/to/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly .`,
    );
    return { ok: false, skipped: false, warnings };
  }

  const onDisk = readFileSync(dest, 'utf8');
  const expected = renderToolsModule(tools);
  const extracted = extractToolsLiteral(onDisk);
  const same =
    (extracted != null && catalogSignature(extracted) === catalogSignature(tools)) ||
    onDisk === expected;

  for (const warning of warnings) {
    log.warn?.(warning);
  }

  if (!same) {
    log.error?.(
      'ERR packages/seedly-mcp/lib/tools.mjs does not match docs/openapi.yaml. Run: node /path/to/seedly-mcp-0.1.0/bin/sync-tools.mjs --seedly .',
    );
    return { ok: false, skipped: false, warnings };
  }
  log.log?.('ok  tool catalog matches docs/openapi.yaml');
  return { ok: true, skipped: false, warnings };
}

function extractToolsLiteral(source) {
  const match = source.match(/export const TOOLS = (\[[\s\S]*?\n\]);/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
