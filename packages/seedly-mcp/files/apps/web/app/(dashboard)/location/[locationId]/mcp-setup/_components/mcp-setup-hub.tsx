'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Globe, KeyRound, Monitor, Plug, Shield } from 'lucide-react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, SegmentedTabs } from '@seedly-crm/ui';
import { CopyButton } from '@/components/shared/copy-button';
import { DataTable, type ColumnDef, type RowAction } from '@/components/shared/data-table';
import { ListPageLayout } from '@/components/shared/list-page-layout';
import { McpToolCatalog } from './mcp-tool-catalog';

const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const SETUP_TABS = ['cursor', 'claude', 'grants'] as const;
const SETUP_LABELS = {
  cursor: 'Cursor / Desktop',
  claude: 'claude.ai',
  grants: 'Claude grants',
};

const listGrantsRef = makeFunctionReference<'query'>('seedlyMcp/api:listGrants');
const revokeGrantRef = makeFunctionReference<'mutation'>('seedlyMcp/api:revokeGrant');

type GrantRow = { id: string; host: string; createdAt: number; expiresAt: number };
type SetupTab = (typeof SETUP_TABS)[number];

const grantColumns: ColumnDef<GrantRow>[] = [
  { key: 'host', header: 'Client', type: 'text' },
  { key: 'createdAt', header: 'Created', type: 'date', width: '140px' },
  { key: 'expiresAt', header: 'Expires', type: 'date', width: '140px' },
];

export function McpSetupHub() {
  const [setupTab, setSetupTab] = useState<SetupTab>('cursor');
  const grants = useQuery(listGrantsRef) as { _id: string; clientId: string; createdAt: number; expiresAt: number }[] | undefined;
  const revoke = useMutation(revokeGrantRef);
  const origin = useMemo(() => (typeof window === 'undefined' ? '' : window.location.origin), []);
  const mcpUrl = origin ? `${origin}/seedly-mcp` : 'https://YOUR_SEEDLY_URL/seedly-mcp';
  const serverPath = 'packages/seedly-mcp/server.mjs';
  const localCursorJson = `{
  "mcpServers": {
    "seedly": {
      "command": "node",
      "args": ["/path/to/their-seedly/${serverPath}"],
      "env": {
        "SEEDLY_BASE_URL": "https://THEIR_DEPLOYMENT.convex.site",
        "SEEDLY_API_KEY": "sk_live_..."
      }
    }
  }
}`;
  const liveCursorJson = `{
  "mcpServers": {
    "seedly": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer sk_live_..."
      }
    }
  }
}`;
  const liveHeaderSnippet = `URL: ${mcpUrl}
Authorization: Bearer sk_live_...`;

  const rows: GrantRow[] = (grants ?? []).map((grant) => ({
    id: grant._id,
    host: hostOf(grant.clientId),
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
  }));

  const rowActions: RowAction<GrantRow>[] = [
    {
      label: 'Revoke',
      variant: 'destructive',
      onClick: (row) => {
        void revoke({ grantId: row.id });
      },
    },
  ];

  return (
    <ListPageLayout
      icon={Plug}
      title="MCP"
      description="Point Cursor or Claude at this Seedly. Your contact book stays here."
      hideSearch
    >
      <div className="space-y-6">
        <McpToolCatalog />

        <Card className="border-border-strong shadow-[var(--shadow-panel)]">
          <CardHeader className="gap-4 space-y-0 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Connect an assistant</CardTitle>
              <CardDescription>
                Create an API key once, then paste a snippet. This page never prints the key back.
              </CardDescription>
            </div>
            <SegmentedTabs
              tabs={SETUP_TABS}
              labels={SETUP_LABELS}
              value={setupTab}
              onValueChange={(value) => setSetupTab(value as SetupTab)}
              size="md"
              aria-label="MCP connection method"
              className="shrink-0"
            />
          </CardHeader>
          <CardContent className="space-y-5 p-4 pt-0 sm:p-5 sm:pt-0">
            {setupTab === 'cursor' ? (
              <CursorSetup localCursorJson={localCursorJson} liveCursorJson={liveCursorJson} />
            ) : null}
            {setupTab === 'claude' ? (
              <ClaudeSetup mcpUrl={mcpUrl} liveHeaderSnippet={liveHeaderSnippet} />
            ) : null}
            {setupTab === 'grants' ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Claude grants</h2>
                  {grants !== undefined ? (
                    <Badge variant="outline" size="sm">
                      {rows.length}
                    </Badge>
                  ) : null}
                </div>
                <DataTable
                  tableLabel="Claude grants"
                  data={rows}
                  columns={grantColumns}
                  isLoading={grants === undefined}
                  rowActions={rowActions}
                  emptyState={{
                    icon: Plug,
                    title: 'No Claude connections yet',
                    description: 'A grant appears here after someone Allow-s Seedly in Claude.',
                  }}
                />
              </section>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </ListPageLayout>
  );
}

function CursorSetup({
  localCursorJson,
  liveCursorJson,
}: {
  localCursorJson: string;
  liveCursorJson: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="sr-only">Cursor / Claude Desktop</h2>
      <StepList
        steps={[
          'Settings → Integrations → API Keys → Create Key. Copy it once.',
          'Paste one of the snippets below into Cursor MCP settings.',
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SnippetCard
          icon={Monitor}
          title="Local program"
          description="Runs a file on this machine. Put the real path to your Seedly folder."
        >
          <CopyBlock value={localCursorJson} label="Copy local snippet" />
          <p className="text-xs text-muted-foreground">The key stays in that env file. This page never prints it back.</p>
        </SnippetCard>
        <SnippetCard
          icon={Globe}
          title="Live URL"
          description="Points Cursor at this website. Replace the placeholder key with the one you copied."
        >
          <CopyBlock value={liveCursorJson} label="Copy live snippet" />
        </SnippetCard>
      </div>
    </section>
  );
}

function ClaudeSetup({
  mcpUrl,
  liveHeaderSnippet,
}: {
  mcpUrl: string;
  liveHeaderSnippet: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="sr-only">claude.ai</h2>
      <StepList
        steps={[
          'Deploy the website (and Convex if you just installed this add-on).',
          'In Claude: Settings → Connectors → Add custom connector.',
          <>
            URL: <CopyInline value={mcpUrl} label="Copy MCP URL" />
          </>,
          <>
            Claude starts Seedly sign-in. After you Allow, tools run as you. Callback we allow:{' '}
            <CopyInline value={CLAUDE_CALLBACK} label="Copy callback URL" />
          </>,
        ]}
      />
      <SnippetCard
        icon={KeyRound}
        title="Live URL (static header)"
        description="If sign-in fails, add the connector with this URL and request header instead. Replace the placeholder key with the one you copied."
      >
        <CopyBlock value={liveHeaderSnippet} label="Copy header snippet" />
      </SnippetCard>
    </section>
  );
}

function SnippetCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Monitor;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function StepList({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold text-sidebar-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 pt-px">{step}</div>
        </li>
      ))}
    </ol>
  );
}

function hostOf(clientId: string): string {
  try {
    return new URL(clientId).host;
  } catch {
    return clientId;
  }
}

function CopyBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
          <Shield className="h-3 w-3" />
          Placeholder key only
        </span>
        <CopyButton value={value} label={label} size="xs" />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">{value}</pre>
    </div>
  );
}

function CopyInline({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
      <CopyButton value={value} label={label} size="icon" className="h-6 w-6" />
    </span>
  );
}
