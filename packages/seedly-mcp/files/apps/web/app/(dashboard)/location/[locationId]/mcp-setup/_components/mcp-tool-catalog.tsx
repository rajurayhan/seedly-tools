import { ChevronDown } from 'lucide-react';
import { Badge } from '@seedly-crm/ui';
import {
  MCP_BLOCKED_TOOLS,
  MCP_TOOL_COUNT,
  MCP_TOOL_GROUPS,
  toolFieldLists,
  type SeedlyMcpTool,
  type SeedlyMcpToolMethod,
} from '@/lib/seedly-mcp/tool-catalog';

const METHOD_VARIANT: Record<SeedlyMcpToolMethod, 'outline' | 'secondary'> = {
  GET: 'outline',
  POST: 'secondary',
  PATCH: 'secondary',
  PUT: 'secondary',
};

export function McpToolCatalog() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Available tools</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cursor and Claude get these {MCP_TOOL_COUNT} tools. Each one calls one route on this
          Seedly. They cannot send messages, move money, or change webhooks. Open a group to see
          the definitions.
        </p>
      </div>

      <div className="space-y-2">
        {MCP_TOOL_GROUPS.map((group) => (
          <details key={group.title} className="group rounded-md border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>
                {group.title}{' '}
                <span className="font-normal text-muted-foreground">({group.tools.length})</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="divide-y border-t">
              {group.tools.map((tool) => (
                <ToolRow key={tool.name} tool={tool} />
              ))}
            </ul>
          </details>
        ))}

        <details className="group rounded-md border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>
              Not in this version{' '}
              <span className="font-normal text-muted-foreground">({MCP_BLOCKED_TOOLS.length})</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">
              Held back on purpose so an assistant cannot email a customer or charge a card by
              accident.
            </p>
            <ul className="space-y-1.5 text-sm">
              {MCP_BLOCKED_TOOLS.map((row) => (
                <li key={row.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <code className="rounded bg-muted px-1 text-xs">{row.name}</code>
                  <span className="text-muted-foreground">{row.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </section>
  );
}

function ToolRow({ tool }: { tool: SeedlyMcpTool }) {
  const fields = toolFieldLists(tool);
  return (
    <li className="space-y-1.5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-sm font-medium">{tool.name}</code>
        <Badge variant={METHOD_VARIANT[tool.method]} size="sm">
          {tool.method}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{tool.description}</p>
      <p className="font-mono text-xs text-muted-foreground">
        {tool.method} {tool.path}
      </p>
      {(fields.required.length > 0 || fields.optional.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {fields.required.length > 0 && (
            <>
              Needs {joinFields(fields.required)}
              {fields.optional.length > 0 ? '. ' : ''}
            </>
          )}
          {fields.optional.length > 0 && <>Also {joinFields(fields.optional)}</>}
        </p>
      )}
    </li>
  );
}

function joinFields(names: string[]) {
  return names.map((name, index) => (
    <span key={name}>
      {index > 0 ? ', ' : ''}
      <code className="rounded bg-muted px-1">{name}</code>
    </span>
  ));
}
