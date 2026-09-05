/** Client ID Metadata Document (CIMD) checks. Fetch this on the server — Claude does not send CORS headers. */

const CIMD_TIMEOUT_MS = 5_000;
const CLAUDE_CIMD_HOSTS = new Set(['claude.ai', 'claude.com']);

export function isHttpsClientId(clientId) {
  try {
    return new URL(clientId).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isClaudeCimdHost(clientId) {
  try {
    return CLAUDE_CIMD_HOSTS.has(new URL(clientId).hostname);
  } catch {
    return false;
  }
}

export function parseCimdDocument(doc, clientId) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, error: 'Could not load Claude’s client document.' };
  }
  if (doc.client_id !== clientId) {
    return { ok: false, error: 'Claude’s client document did not match its address.' };
  }
  const redirectUris = Array.isArray(doc.redirect_uris)
    ? doc.redirect_uris.filter((uri) => typeof uri === 'string')
    : [];
  return {
    ok: true,
    clientName: typeof doc.client_name === 'string' ? doc.client_name : undefined,
    redirectUris,
  };
}

export async function fetchCimdDocument(clientId, fetchImpl = globalThis.fetch) {
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
