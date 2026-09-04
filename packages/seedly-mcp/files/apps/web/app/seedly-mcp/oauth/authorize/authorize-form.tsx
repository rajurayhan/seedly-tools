'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Button } from '@seedly-crm/ui';
import { SEEDLY_MCP_KEY_SCOPES } from '@/lib/seedly-mcp/oauth-reexport';

const createKeyRef = makeFunctionReference<'mutation'>('apiKeys:create');
const storeAuthRef = makeFunctionReference<'mutation'>('seedlyMcp/api:storeAuthorization');

export function AuthorizeForm({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const createKey = useMutation(createKeyRef);
  const storeAuth = useMutation(storeAuthRef);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function deny() {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  }

  async function allow() {
    setBusy(true);
    setError('');
    try {
      if (clientId.startsWith('https://')) {
        const doc = await fetchCimd(clientId);
        if (!doc.ok) {
          setError(doc.error);
          return;
        }
        if (!doc.redirectUris.includes(redirectUri)) {
          setError('Claude asked for a redirect that is not in its client document.');
          return;
        }
      }

      const key = await createKey({
        name: 'SeedlyMCP (Claude)',
        scopes: [...SEEDLY_MCP_KEY_SCOPES],
      });
      const stored = await storeAuth({
        clientId,
        redirectUri,
        codeChallenge,
        apiKeyId: key.id,
        apiKey: key.rawKey,
      });
      const url = new URL(redirectUri);
      url.searchParams.set('code', stored.code);
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not allow Claude. You need permission to create API keys in this location.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Allow Claude to use SeedlyMCP?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Claude will sign in as you on this Seedly. It can read contacts, conversations,
          calendars, tasks, opportunities, invoices, and estimates, and can create contacts,
          tasks, opportunities, and appointments. It cannot send messages, invoices, or
          estimates.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Asking app: {hostOf(clientId)}
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <Button onClick={allow} disabled={busy}>
          {busy ? 'Allowing…' : 'Allow'}
        </Button>
        <Button variant="outline" onClick={deny} disabled={busy}>
          Deny
        </Button>
      </div>
    </main>
  );
}

function hostOf(clientId: string): string {
  try {
    return new URL(clientId).host;
  } catch {
    return clientId;
  }
}

async function fetchCimd(clientId: string): Promise<
  { ok: true; clientName?: string; redirectUris: string[] } | { ok: false; error: string }
> {
  try {
    const res = await fetch(clientId, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, error: 'Could not load Claude’s client document.' };
    const doc = (await res.json()) as {
      client_id?: string;
      client_name?: string;
      redirect_uris?: string[];
    };
    if (doc.client_id !== clientId) {
      return { ok: false, error: 'Claude’s client document did not match its address.' };
    }
    return {
      ok: true,
      clientName: doc.client_name,
      redirectUris: Array.isArray(doc.redirect_uris) ? doc.redirect_uris : [],
    };
  } catch {
    return { ok: false, error: 'Could not load Claude’s client document.' };
  }
}
