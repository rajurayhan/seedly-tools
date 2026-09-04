import { BLOCKED_V1_TOOLS, TOOLS } from '../../../../packages/seedly-mcp/lib/tools.mjs';
import { blockedToolRows, groupedCatalog } from '../../../../packages/seedly-mcp/lib/tool-groups.mjs';

export type SeedlyMcpToolMethod = 'GET' | 'POST' | 'PATCH' | 'PUT';

export type SeedlyMcpTool = {
  name: string;
  method: SeedlyMcpToolMethod;
  path: string;
  description: string;
  pathParams?: string[];
  queryParams?: string[];
  bodyParams?: string[];
  required?: string[];
};

export type SeedlyMcpToolGroup = {
  title: string;
  tools: SeedlyMcpTool[];
};

export const MCP_TOOL_COUNT = TOOLS.length;

export const MCP_TOOL_GROUPS = groupedCatalog(TOOLS) as SeedlyMcpToolGroup[];

export const MCP_BLOCKED_TOOLS = blockedToolRows(BLOCKED_V1_TOOLS);

export function toolFieldLists(tool: SeedlyMcpTool) {
  const required = new Set(tool.required ?? []);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of [...(tool.pathParams ?? []), ...(tool.queryParams ?? []), ...(tool.bodyParams ?? [])]) {
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return {
    required: names.filter((name) => required.has(name)),
    optional: names.filter((name) => !required.has(name)),
  };
}
