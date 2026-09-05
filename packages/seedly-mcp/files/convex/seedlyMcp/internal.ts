import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { sha256Hex } from './crypto';

export const clientById = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('seedlyMcpClients')
      .withIndex('by_clientId', (q) => q.eq('clientId', args.clientId))
      .unique();
  },
});

export const authCodeByHash = internalQuery({
  args: { codeHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('seedlyMcpAuthCodes')
      .withIndex('by_codeHash', (q) => q.eq('codeHash', args.codeHash))
      .unique();
  },
});

export const grantByAccessHash = internalQuery({
  args: { accessTokenHash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('seedlyMcpGrants')
      .withIndex('by_accessTokenHash', (q) => q.eq('accessTokenHash', args.accessTokenHash))
      .unique();
    if (!row || row.revokedAt || row.expiresAt <= Date.now()) return null;
    return row;
  },
});

export const grantByRefreshHash = internalQuery({
  args: { refreshTokenHash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('seedlyMcpGrants')
      .withIndex('by_refreshTokenHash', (q) => q.eq('refreshTokenHash', args.refreshTokenHash))
      .unique();
    if (!row || row.revokedAt || row.refreshExpiresAt <= Date.now()) return null;
    return row;
  },
});

export const markCodeUsed = internalMutation({
  args: { id: v.id('seedlyMcpAuthCodes') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { usedAt: Date.now() });
  },
});

export const insertGrant = internalMutation({
  args: {
    accessTokenHash: v.string(),
    refreshTokenHash: v.string(),
    clientId: v.string(),
    userId: v.id('users'),
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
    apiKeyId: v.id('apiKeys'),
    apiKey: v.string(),
    expiresAt: v.number(),
    refreshExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('seedlyMcpGrants', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const rotateGrantTokens = internalMutation({
  args: {
    id: v.id('seedlyMcpGrants'),
    accessTokenHash: v.string(),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
    refreshExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const revokeGrantById = internalMutation({
  args: { id: v.id('seedlyMcpGrants') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { revokedAt: Date.now() });
  },
});

export const upsertClient = internalMutation({
  args: {
    clientId: v.string(),
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    tokenEndpointAuthMethod: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('seedlyMcpClients')
      .withIndex('by_clientId', (q) => q.eq('clientId', args.clientId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        clientName: args.clientName,
        redirectUris: args.redirectUris,
        tokenEndpointAuthMethod: args.tokenEndpointAuthMethod,
      });
      return existing._id;
    }
    return await ctx.db.insert('seedlyMcpClients', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export async function hashToken(value: string): Promise<string> {
  return sha256Hex(value);
}
