import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const seedlyMcpTables = {
  seedlyMcpClients: defineTable({
    clientId: v.string(),
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    tokenEndpointAuthMethod: v.string(),
    createdAt: v.number(),
  }).index('by_clientId', ['clientId']),

  seedlyMcpAuthCodes: defineTable({
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    userId: v.id('users'),
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
    apiKeyId: v.id('apiKeys'),
    apiKey: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_codeHash', ['codeHash']),

  seedlyMcpGrants: defineTable({
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
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_accessTokenHash', ['accessTokenHash'])
    .index('by_refreshTokenHash', ['refreshTokenHash'])
    .index('by_user', ['userId'])
    .index('by_subAccount', ['subAccountId']),
};
