'use client';

import { ChevronDown } from 'lucide-react';
import { CopyButton } from '@/components/shared/copy-button';
import { DataTable, type ColumnDef } from '@/components/shared/data-table';
import {
  MCP_BLOCKED_TOOLS,
  MCP_TOOL_COUNT,
  MCP_TOOL_GROUPS,
  toolFieldLists,
  type SeedlyMcpTool,
  type SeedlyMcpToolMethod,
} from '@/lib/seedly-mcp/tool-catalog';

type ToolRow = {
  id: string;
  name: string;
  method: SeedlyMcpToolMethod;
  path: string;
  description: string;
  fields: string;
};

type BlockedRow = { id: string; name: string; label: string };

const METHOD_VARIANT: Record<SeedlyMcpToolMethod, 'outline' | 'secondary'> = {
  GET: 'outline',
  POST: 'secondary',
  PATCH: 'secondary',
  PUT: 'secondary',
};

const toolColumns: ColumnDef<ToolRow>[] = [
  {
    key: 'name',
    header: 'Tool',
    type: 'custom',
    render: (row) => (
      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs font-medium">{row.name}</p>
          {row.fields ? <p className="truncate text-2xs text-muted-foreground">{row.fields}</p> : null}
        </div>
        <CopyButton value={row.name} label={`Copy ${row.name}`} size="icon" variant="ghost" className="h-6 w-6 shrink-0" />
      </div>
    ),
  },
  {
    key: 'method',
    header: 'Method',
    type: 'badge',
    width: '90px',
    variantMap: METHOD_VARIANT,
  },
  { key: 'path', header: 'Path', type: 'text' },
  { key: 'description', header: 'Description', type: 'text' },
];

const blockedColumns: ColumnDef<BlockedRow>[] = [
  {
    key: 'name',
    header: 'Tool',
    type: 'custom',
    render: (row) => <span className="font-mono text-xs">{row.name}</span>,
  },
  { key: 'label', header: 'Why it is held back', type: 'text' },
];

function toToolRow(tool: SeedlyMcpTool): ToolRow {
  const fields = toolFieldLists(tool);
  const parts = [
    fields.required.length ? `Needs ${fields.required.join(', ')}` : '',
    fields.optional.length ? `Also ${fields.optional.join(', ')}` : '',
  ].filter(Boolean);
  return {
    id: tool.name,
    name: tool.name,
    method: tool.method,
    path: tool.path,
    description: tool.description,
    fields: parts.join('. '),
  };
}

export function McpToolCatalog() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Available tools</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cursor and Claude get these {MCP_TOOL_COUNT} tools. Each one calls one route on this
          Seedly. They cannot send messages, move money, or change webhooks. Open a group to see
          the definitions.
        </p>
      </div>

      <div className="space-y-3">
        {MCP_TOOL_GROUPS.map((group) => (
          <details key={group.title} className="group">
            <summary className="mb-2 flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>
                {group.title}{' '}
                <span className="font-normal text-muted-foreground">({group.tools.length})</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <DataTable tableLabel={group.title} data={group.tools.map(toToolRow)} columns={toolColumns} />
          </details>
        ))}

        <details className="group">
          <summary className="mb-2 flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>
              Not in this version{' '}
              <span className="font-normal text-muted-foreground">({MCP_BLOCKED_TOOLS.length})</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <p className="mb-2 text-sm text-muted-foreground">
            Held back on purpose so an assistant cannot email a customer or charge a card by
            accident.
          </p>
          <DataTable
            tableLabel="Blocked MCP tools"
            data={MCP_BLOCKED_TOOLS.map((row) => ({ id: row.name, name: row.name, label: row.label }))}
            columns={blockedColumns}
          />
        </details>
      </div>
    </section>
  );
}
