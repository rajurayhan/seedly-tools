'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  MessageSquare,
  Receipt,
  MapPin,
  ShieldCheck,
  Target,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { Alert, Badge } from '@seedly-crm/ui';
import { CopyButton } from '@/components/shared/copy-button';
import {
  MCP_BLOCKED_TOOLS,
  MCP_TOOL_COUNT,
  MCP_TOOL_GROUPS,
  toolFieldLists,
  type SeedlyMcpTool,
  type SeedlyMcpToolMethod,
} from '@/lib/seedly-mcp/tool-catalog';

const METHOD_VARIANT: Record<SeedlyMcpToolMethod, 'outline' | 'secondary' | 'info'> = {
  GET: 'outline',
  POST: 'info',
  PATCH: 'secondary',
  PUT: 'secondary',
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  Account: User,
  Contacts: Users,
  Conversations: MessageSquare,
  Calendars: Calendar,
  Tasks: CheckSquare,
  Opportunities: Target,
  'Invoices & estimates': Receipt,
  Locations: Building2,
  Pins: MapPin,
};

export function McpToolCatalog() {
  return (
    <section className="overflow-hidden rounded-lg border border-border-strong bg-card shadow-[var(--shadow-panel)]">
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
        style={{
          backgroundColor: 'hsl(var(--sidebar))',
          color: 'hsl(var(--sidebar-foreground))',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Wrench className="h-4 w-4 shrink-0" />
          <h2 className="truncate text-sm font-semibold tracking-tight">Available tools</h2>
        </div>
        <Badge variant="secondary" size="sm" className="shrink-0 bg-sidebar-foreground/10 text-sidebar-foreground">
          {MCP_TOOL_COUNT}
        </Badge>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">
          Cursor and Claude get these {MCP_TOOL_COUNT} tools. Each one calls one route on this
          Seedly. Open a group to see the definitions.
        </p>

        <Alert variant="info">
          <ShieldCheck />
          They cannot send messages, move money, or change webhooks.
        </Alert>

        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {MCP_TOOL_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.title] ?? Wrench;
            return (
              <details key={group.title} className="group bg-card">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 text-sm font-medium hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{group.title}</span>
                  <Badge variant="outline" size="sm">
                    {group.tools.length}
                  </Badge>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <ul className="divide-y divide-border border-t border-border bg-muted/20">
                  {group.tools.map((tool) => (
                    <ToolRow key={tool.name} tool={tool} />
                  ))}
                </ul>
              </details>
            );
          })}

          <details className="group bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 text-sm font-medium hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                <Ban className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">Not in this version</span>
              <Badge variant="warning" size="sm">
                {MCP_BLOCKED_TOOLS.length}
              </Badge>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3">
              <p className="text-sm text-muted-foreground">
                Held back on purpose so an assistant cannot email a customer or charge a card by
                accident.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
                {MCP_BLOCKED_TOOLS.map((row) => (
                  <li key={row.name} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium">{row.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{row.label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function ToolRow({ tool }: { tool: SeedlyMcpTool }) {
  const fields = toolFieldLists(tool);
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <Badge variant={METHOD_VARIANT[tool.method]} size="sm" className="mt-0.5 shrink-0 font-mono">
        {tool.method}
      </Badge>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1">
          <p className="min-w-0 truncate font-mono text-xs font-medium">{tool.name}</p>
          <CopyButton
            value={tool.name}
            label={`Copy ${tool.name}`}
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
          />
        </div>
        <p className="text-sm leading-snug text-muted-foreground">{tool.description}</p>
        <p className="font-mono text-2xs text-muted-foreground">{tool.path}</p>
        {fields.required.length || fields.optional.length ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {fields.required.map((name) => (
              <Badge key={`need-${name}`} variant="secondary" size="sm">
                {name}
              </Badge>
            ))}
            {fields.optional.map((name) => (
              <Badge key={`also-${name}`} variant="outline" size="sm">
                {name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}
