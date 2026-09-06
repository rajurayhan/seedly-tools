'use client';

import { useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Plug } from 'lucide-react';
import { CopyButton } from '@/components/shared/copy-button';
import { DataTable, type ColumnDef, type RowAction } from '@/components/shared/data-table';
import { ListPageLayout } from '@/components/shared/list-page-layout';
import { McpToolCatalog } from './mcp-tool-catalog';

const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

const listGrantsRef = makeFunctionReference<'query'>('seedlyMcp/api:listGrants');
const revokeGrantRef = makeFunctionReference<'mutation'>('seedlyMcp/api:revokeGrant');

type GrantRow = { id: string; host: string; createdAt: number; expiresAt: number };

const grantColumns: ColumnDef<GrantRow>[] = [
  { key: 'host', header: 'Client', type: 'text' },
  { key: 'createdAt', header: 'Created', type: 'date', width: '140px' },
  { key: 'expiresAt', header: 'Expires', type: 'date', width: '140px' },
];

export function McpSetupHub() {
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
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cursor / Claude Desktop</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Settings → Integrations → API Keys → Create Key. Copy it once.</li>
            <li>Paste one of the snippets below into Cursor MCP settings.</li>
          </ol>
          <h3 className="text-sm font-medium">Local program</h3>
          <p className="text-sm text-muted-foreground">
            Runs a file on this machine. Put the real path to your Seedly folder.
          </p>
          <CopyBlock value={localCursorJson} label="Copy local snippet" />
          <p className="text-xs text-muted-foreground">The key stays in that env file. This page never prints it back.</p>
          <h3 className="text-sm font-medium">Live URL</h3>
          <p className="text-sm text-muted-foreground">
            Points Cursor at this website. Replace the placeholder key with the one you copied.
          </p>
          <CopyBlock value={liveCursorJson} label="Copy live snippet" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">claude.ai</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Deploy the website (and Convex if you just installed this add-on).</li>
            <li>In Claude: Settings → Connectors → Add custom connector.</li>
            <li>
              URL: <CopyInline value={mcpUrl} label="Copy MCP URL" />
            </li>
            <li>
              Claude starts Seedly sign-in. After you Allow, tools run as you. Callback we allow:{' '}
              <CopyInline value={CLAUDE_CALLBACK} label="Copy callback URL" />
            </li>
          </ol>
          <h3 className="text-sm font-medium">Live URL (static header)</h3>
          <p className="text-sm text-muted-foreground">
            If sign-in fails, add the connector with this URL and request header instead. Replace the
            placeholder key with the one you copied.
          </p>
          <CopyBlock value={liveHeaderSnippet} label="Copy header snippet" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Claude grants</h2>
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

        <McpToolCatalog />
      </div>
    </ListPageLayout>
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
      <div className="flex justify-end border-b border-border px-2 py-1.5">
        <CopyButton value={value} label={label} size="xs" />
      </div>
      <pre className="overflow-x-auto p-4 text-xs">{value}</pre>
    </div>
  );
}

function CopyInline({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <code className="rounded bg-muted px-1">{value}</code>
      <CopyButton value={value} label={label} size="icon" className="h-6 w-6" />
    </span>
  );
}
