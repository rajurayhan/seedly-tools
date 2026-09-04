import { mutation, query } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import { getAuthContext, requirePermission, requireSubAccount } from '../_helpers';
import { sha256Hex, randomToken } from './crypto';
import { isAllowedRedirectUri } from './oauthMetadata';

const CODE_TTL_MS = 10 * 60 * 1000;

export const listGrants = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const authCtx = await getAuthContext(ctx);
    const subAccountId = requireSubAccount(authCtx);
    const rows = await ctx.db
      .query('seedlyMcpGrants')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .collect();
    return rows
      .filter((row) => !row.revokedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        _id: row._id,
        clientId: row.clientId,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      }));
  },
});

export const revokeGrant = mutation({
  args: { grantId: v.id('seedlyMcpGrants') },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'settings', 'update');
    const subAccountId = requireSubAccount(authCtx);
    const row = await ctx.db.get(args.grantId);
    if (!row || row.subAccountId !== subAccountId) {
      throw new ConvexError('Grant not found');
    }
    await ctx.db.patch(args.grantId, { revokedAt: Date.now() });
    if (row.apiKeyId) {
      const key = await ctx.db.get(row.apiKeyId);
      if (key && key.isActive) {
        await ctx.db.patch(row.apiKeyId, {
          isActive: false,
          revokedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const storeAuthorization = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    apiKeyId: v.id('apiKeys'),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'settings', 'update');
    const subAccountId = requireSubAccount(authCtx);
    if (!isAllowedRedirectUri(args.redirectUri)) {
      throw new ConvexError('This redirect is not allowed for SeedlyMCP');
    }
    if (!args.apiKey.startsWith('sk_')) {
      throw new ConvexError('API key format looks wrong');
    }
    const key = await ctx.db.get(args.apiKeyId);
    if (!key || key.subAccountId !== subAccountId) {
      throw new ConvexError('API key not found in this location');
    }
    const code = randomToken('smc_');
    await ctx.db.insert('seedlyMcpAuthCodes', {
      codeHash: await sha256Hex(code),
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      userId: authCtx.userId,
      agencyId: authCtx.agencyId,
      subAccountId,
      apiKeyId: args.apiKeyId,
      apiKey: args.apiKey,
      expiresAt: Date.now() + CODE_TTL_MS,
      createdAt: Date.now(),
    });
    return { code };
  },
});
