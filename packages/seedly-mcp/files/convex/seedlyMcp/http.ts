import { action } from '../_generated/server';
import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import { randomToken, sha256Hex } from './crypto';
import { isAllowedRedirectUri } from './oauthMetadata';

const ACCESS_TTL_SEC = 3600;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const clientByIdRef = makeFunctionReference<'query'>('seedlyMcp/internal:clientById');
const upsertClientRef = makeFunctionReference<'mutation'>('seedlyMcp/internal:upsertClient');
const authCodeByHashRef = makeFunctionReference<'query'>('seedlyMcp/internal:authCodeByHash');
const markCodeUsedRef = makeFunctionReference<'mutation'>('seedlyMcp/internal:markCodeUsed');
const insertGrantRef = makeFunctionReference<'mutation'>('seedlyMcp/internal:insertGrant');
const grantByAccessHashRef = makeFunctionReference<'query'>('seedlyMcp/internal:grantByAccessHash');
const grantByRefreshHashRef = makeFunctionReference<'query'>('seedlyMcp/internal:grantByRefreshHash');
const rotateGrantTokensRef = makeFunctionReference<'mutation'>('seedlyMcp/internal:rotateGrantTokens');
const revokeGrantByIdRef = makeFunctionReference<'mutation'>('seedlyMcp/internal:revokeGrantById');

export const registerClient = action({
  args: {
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    tokenEndpointAuthMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowed = args.redirectUris.filter((uri) => isAllowedRedirectUri(uri));
    if (allowed.length === 0) {
      return { ok: false as const, status: 400, error: 'redirect_uri is not allowed' };
    }
    const clientId = randomToken('scli_');
    await ctx.runMutation(upsertClientRef, {
      clientId,
      clientName: args.clientName,
      redirectUris: allowed,
      tokenEndpointAuthMethod: args.tokenEndpointAuthMethod ?? 'none',
    });
    return {
      ok: true as const,
      client_id: clientId,
      redirect_uris: allowed,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
  },
});

export const exchangeToken = action({
  args: {
    grantType: v.string(),
    code: v.optional(v.string()),
    redirectUri: v.optional(v.string()),
    clientId: v.optional(v.string()),
    codeVerifier: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.grantType === 'refresh_token') {
      if (!args.refreshToken) return oauthError('invalid_request', 'refresh_token required');
      const refreshHash = await sha256Hex(args.refreshToken);
      const grant = await ctx.runQuery(grantByRefreshHashRef, { refreshTokenHash: refreshHash });
      if (!grant) return oauthError('invalid_grant', 'Unknown refresh token');
      const accessToken = randomToken('sma_');
      const nextRefresh = randomToken('smr_');
      await ctx.runMutation(rotateGrantTokensRef, {
        id: grant._id,
        accessTokenHash: await sha256Hex(accessToken),
        refreshTokenHash: await sha256Hex(nextRefresh),
        expiresAt: Date.now() + ACCESS_TTL_SEC * 1000,
        refreshExpiresAt: Date.now() + REFRESH_TTL_MS,
      });
      return tokenResponse(accessToken, nextRefresh);
    }

    if (args.grantType !== 'authorization_code') {
      return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token');
    }
    if (!args.code || !args.redirectUri || !args.clientId || !args.codeVerifier) {
      return oauthError('invalid_request', 'code, redirect_uri, client_id, and code_verifier are required');
    }
    const codeHash = await sha256Hex(args.code);
    const row = await ctx.runQuery(authCodeByHashRef, { codeHash });
    if (!row || row.usedAt || row.expiresAt <= Date.now()) {
      return oauthError('invalid_grant', 'Code is unknown or expired');
    }
    if (row.clientId !== args.clientId || row.redirectUri !== args.redirectUri) {
      return oauthError('invalid_grant', 'Code does not match this client');
    }
    const challenge = await pkceS256Web(args.codeVerifier);
    if (challenge !== row.codeChallenge) {
      return oauthError('invalid_grant', 'PKCE verification failed');
    }
    await ctx.runMutation(markCodeUsedRef, { id: row._id });
    const accessToken = randomToken('sma_');
    const refreshToken = randomToken('smr_');
    await ctx.runMutation(insertGrantRef, {
      accessTokenHash: await sha256Hex(accessToken),
      refreshTokenHash: await sha256Hex(refreshToken),
      clientId: row.clientId,
      userId: row.userId,
      agencyId: row.agencyId,
      subAccountId: row.subAccountId,
      apiKeyId: row.apiKeyId,
      apiKey: row.apiKey,
      expiresAt: Date.now() + ACCESS_TTL_SEC * 1000,
      refreshExpiresAt: Date.now() + REFRESH_TTL_MS,
    });
    return tokenResponse(accessToken, refreshToken);
  },
});

export const resolveBearer = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (token.startsWith('sk_')) {
      return { ok: true as const, apiKey: token, kind: 'api_key' as const };
    }
    const grant = await ctx.runQuery(grantByAccessHashRef, {
      accessTokenHash: await sha256Hex(token),
    });
    if (!grant) return { ok: false as const, error: 'invalid_token' };
    return { ok: true as const, apiKey: grant.apiKey, kind: 'oauth' as const };
  },
});

export const revokeToken = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const hash = await sha256Hex(args.token.trim());
    const byAccess = await ctx.runQuery(grantByAccessHashRef, { accessTokenHash: hash });
    const grant =
      byAccess ?? (await ctx.runQuery(grantByRefreshHashRef, { refreshTokenHash: hash }));
    if (grant) await ctx.runMutation(revokeGrantByIdRef, { id: grant._id });
    return { ok: true as const };
  },
});

export const rememberCimdClient = action({
  args: {
    clientId: v.string(),
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(upsertClientRef, {
      clientId: args.clientId,
      clientName: args.clientName,
      redirectUris: args.redirectUris.filter((uri) => isAllowedRedirectUri(uri)),
      tokenEndpointAuthMethod: 'none',
    });
    return { ok: true as const };
  },
});

function tokenResponse(accessToken: string, refreshToken: string) {
  return {
    ok: true as const,
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SEC,
    refresh_token: refreshToken,
    scope: 'seedly_mcp',
  };
}

function oauthError(error: string, description: string) {
  return { ok: false as const, error, error_description: description };
}

async function pkceS256Web(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  let binary = '';
  for (const byte of new Uint8Array(hash)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
