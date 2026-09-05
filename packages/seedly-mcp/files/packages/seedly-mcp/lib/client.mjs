const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 1_000_000;

export function assertLocalEnv(env = process.env) {
  const baseUrl = (env.SEEDLY_BASE_URL ?? '').trim().replace(/\/$/, '');
  const apiKey = (env.SEEDLY_API_KEY ?? '').trim();
  if (!baseUrl) {
    throw new Error('SEEDLY_BASE_URL is required (https://YOUR_DEPLOYMENT.convex.site)');
  }
  if (!apiKey) {
    throw new Error('SEEDLY_API_KEY is required. Create one in Settings → Integrations → API Keys.');
  }
  return { baseUrl, apiKey };
}

export function siteUrlFromConvexCloud(convexUrl) {
  if (!convexUrl) return '';
  return convexUrl.replace('.convex.cloud', '.convex.site').replace(/\/$/, '');
}

function redact(value) {
  if (!value) return '';
  if (value.length < 12) return '***';
  return `${value.slice(0, 7)}…`;
}

export async function callSeedlyApi({
  baseUrl,
  apiKey,
  method,
  path,
  query,
  body,
  extraHeaders,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
  const url = new URL(path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    ...(extraHeaders ?? {}),
  };
  const init = { method, headers, signal: AbortSignal.timeout(timeoutMs) };
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetchImpl(url, init);
  const raw = await response.text();
  if (raw.length > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Seedly response exceeded the MCP size cap' },
    };
  }

  let parsed = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        status: response.status,
        error: { code: 'INVALID_JSON', message: 'Seedly did not return JSON' },
      };
    }
  }

  if (!response.ok) {
    const err = parsed?.error ?? {};
    return {
      ok: false,
      status: response.status,
      error: {
        code: typeof err.code === 'string' ? err.code : 'HTTP_ERROR',
        message: typeof err.message === 'string' ? err.message : `Seedly returned ${response.status}`,
      },
    };
  }

  return {
    ok: true,
    status: response.status,
    data: parsed?.data ?? parsed,
    meta: parsed?.meta,
  };
}

export function formatToolResult(result) {
  if (!result.ok) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: result.error }, null, 2),
        },
      ],
    };
  }
  const payload = result.meta === undefined ? { data: result.data } : { data: result.data, meta: result.meta };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

export function describeEnv(env = process.env) {
  const { baseUrl, apiKey } = assertLocalEnv(env);
  return { baseUrl, apiKeyHint: redact(apiKey) };
}
