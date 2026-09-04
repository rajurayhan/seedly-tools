import { getTool, mcpToolsList, resolveRequest } from './tools.mjs';
import { callSeedlyApi, formatToolResult } from './client.mjs';

export const PROTOCOL_VERSION = '2025-03-26';
export const SERVER_INFO = { name: 'seedly-mcp', version: '0.1.0' };

export function initializeResult() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: SERVER_INFO,
  };
}

export async function handleJsonRpc(message, exec) {
  if (message?.jsonrpc !== '2.0') {
    return error(message?.id ?? null, -32600, 'Invalid Request');
  }
  if (message.method && String(message.method).startsWith('notifications/')) {
    return null;
  }
  if (message.id === undefined) return null;

  try {
    if (message.method === 'initialize') {
      return ok(message.id, initializeResult());
    }
    if (message.method === 'ping') {
      return ok(message.id, {});
    }
    if (message.method === 'tools/list') {
      return ok(message.id, { tools: mcpToolsList() });
    }
    if (message.method === 'tools/call') {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      const tool = getTool(name);
      if (!tool) {
        return ok(message.id, {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` } }) }],
        });
      }
      const request = resolveRequest(tool, args);
      const result = await exec(request);
      return ok(message.id, formatToolResult(result));
    }
    return error(message.id, -32601, `Method not found: ${message.method}`);
  } catch (err) {
    const text = err instanceof Error ? err.message : 'Tool failed';
    if (message.method === 'tools/call') {
      return ok(message.id, {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: { code: 'TOOL_ERROR', message: text } }) }],
      });
    }
    return error(message.id, -32000, text);
  }
}

export function apiExecutor({ baseUrl, apiKey, fetchImpl }) {
  return (request) =>
    callSeedlyApi({
      baseUrl,
      apiKey,
      method: request.method,
      path: request.path,
      query: request.query,
      body: request.body,
      fetchImpl,
    });
}

function ok(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function error(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
