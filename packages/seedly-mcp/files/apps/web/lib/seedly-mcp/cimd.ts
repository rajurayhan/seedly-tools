/** Client ID Metadata Document (CIMD) checks. Fetch this on the server — Claude does not send CORS headers. */

const CIMD_TIMEOUT_MS = 5_000;
const CLAUDE_CIMD_HOSTS = new Set(['claude.ai', 'claude.com']);

export type CimdResult =
  | { ok: true; clientName?: string; redirectUris: string[] }
  | { ok: false; error: string };

export function isHttpsClientId(clientId: string): boolean {
  try {
    return new URL(clientId).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isClaudeCimdHost(clientId: string): boolean {
  try {
    return CLAUDE_CIMD_HOSTS.has(new URL(clientId).hostname);
  } catch {
    return false;
  }
}

export function parseCimdDocument(doc: unknown, clientId: string): CimdResult {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, error: 'Could not load Claude’s client document.' };
  }
  const record = doc as {
    client_id?: string;
    client_name?: string;
    redirect_uris?: unknown;
  };
  if (record.client_id !== clientId) {
    return { ok: false, error: 'Claude’s client document did not match its address.' };
  }
  const redirectUris = Array.isArray(record.redirect_uris)
    ? record.redirect_uris.filter((uri): uri is string => typeof uri === 'string')
    : [];
  return {
    ok: true,
    clientName: typeof record.client_name === 'string' ? record.client_name : undefined,
    redirectUris,
  };
}

export async function fetchCimdDocument(
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CimdResult> {
  if (!isHttpsClientId(clientId)) {
    return { ok: false, error: 'Could not load Claude’s client document.' };
  }
  try {
    const res = await fetchImpl(clientId, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(CIMD_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: 'Could not load Claude’s client document.' };
    return parseCimdDocument(await res.json(), clientId);
  } catch {
    return { ok: false, error: 'Could not load Claude’s client document.' };
  }
}
