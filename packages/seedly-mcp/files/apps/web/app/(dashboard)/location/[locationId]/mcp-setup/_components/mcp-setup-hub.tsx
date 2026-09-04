'use client';

import { useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Button } from '@seedly-crm/ui';
import { McpToolCatalog } from './mcp-tool-catalog';

const listGrantsRef = makeFunctionReference<'query'>('seedlyMcp/api:listGrants');
const revokeGrantRef = makeFunctionReference<'mutation'>('seedlyMcp/api:revokeGrant');

type GrantRow = { _id: string; clientId: string; createdAt: number; expiresAt: number };

export function McpSetupHub() {
  const grants = useQuery(listGrantsRef) as GrantRow[] | undefined;
  const revoke = useMutation(revokeGrantRef);
  const origin = useMemo(() => (typeof window === 'undefined' ? '' : window.location.origin), []);
  const mcpUrl = origin ? `${origin}/seedly-mcp` : 'https://YOUR_SEEDLY_URL/seedly-mcp';
  const serverPath = 'packages/seedly-mcp/server.mjs';
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">SeedlyMCP</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Point Cursor or Claude at <strong>this</strong> Seedly. Your contact book stays here. There
          is no chat box in the CRM — that is a later add-on.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Cursor / Claude Desktop</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Settings → Integrations → API Keys → Create Key. Copy it once.</li>
          <li>Paste one of the snippets below into Cursor MCP settings.</li>
        </ol>
        <h3 className="text-sm font-medium">Local program</h3>
        <p className="text-sm text-muted-foreground">
          Runs a file on this machine. Put the real path to your Seedly folder.
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
          {`{
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
}`}
        </pre>
        <p className="text-xs text-muted-foreground">
          The key stays in that env file. This page never prints it back.
        </p>
        <h3 className="text-sm font-medium">Live URL</h3>
        <p className="text-sm text-muted-foreground">
          Points Cursor at this website. Replace the placeholder key with the one you copied.
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
          {liveCursorJson}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">claude.ai</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Deploy the website (and Convex if you just installed this add-on).</li>
          <li>In Claude: Settings → Connectors → Add custom connector.</li>
          <li>
            URL: <code className="rounded bg-muted px-1">{mcpUrl}</code>
          </li>
          <li>
            Claude starts Seedly sign-in. After you Allow, tools run as you. Callback we allow:{' '}
            <code className="rounded bg-muted px-1">https://claude.ai/api/mcp/auth_callback</code>
          </li>
        </ol>
        <h3 className="text-sm font-medium">Live URL (static header)</h3>
        <p className="text-sm text-muted-foreground">
          If sign-in fails, add the connector with this URL and request header instead. Replace the
          placeholder key with the one you copied.
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
          {liveHeaderSnippet}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Claude grants</h2>
        {!grants ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Claude connections yet.</p>
        ) : (
          <ul className="space-y-2">
            {grants.map((grant) => (
              <li key={grant._id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="truncate pr-4">{hostOf(grant.clientId)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void revoke({ grantId: grant._id });
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <McpToolCatalog />
    </div>
  );
}

function hostOf(clientId: string): string {
  try {
    return new URL(clientId).host;
  } catch {
    return clientId;
  }
}
