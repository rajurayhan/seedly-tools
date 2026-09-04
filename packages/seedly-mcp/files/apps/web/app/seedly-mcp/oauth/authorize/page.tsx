import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth-server';
import { isAllowedRedirectUri } from '@/lib/seedly-mcp/oauth-reexport';
import { AuthorizeForm } from './authorize-form';

export const dynamic = 'force-dynamic';

export default async function SeedlyMcpAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const clientId = str(q.client_id);
  const redirectUri = str(q.redirect_uri);
  const state = str(q.state);
  const codeChallenge = str(q.code_challenge);
  const codeChallengeMethod = str(q.code_challenge_method) || 'S256';
  const responseType = str(q.response_type) || 'code';

  const next = `/seedly-mcp/oauth/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    response_type: responseType,
  }).toString()}`;

  const token = await getToken();
  if (!token) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(next)}`);
  }

  if (responseType !== 'code') {
    return <p className="p-8">SeedlyMCP only supports the authorization code flow.</p>;
  }
  if (codeChallengeMethod !== 'S256') {
    return <p className="p-8">SeedlyMCP requires PKCE S256.</p>;
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return <p className="p-8">This Claude sign-in link is missing required fields.</p>;
  }
  if (!isAllowedRedirectUri(redirectUri)) {
    return <p className="p-8">That redirect is not on the SeedlyMCP allow-list.</p>;
  }

  return (
    <AuthorizeForm
      clientId={clientId}
      redirectUri={redirectUri}
      state={state}
      codeChallenge={codeChallenge}
    />
  );
}

function str(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}
