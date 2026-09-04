// Tables owned by the HighLevel import add-on. Declared in a `*Schema.ts` file
// so Seedly's schema coverage checks discover them; `extensions/index.ts`
// spreads them into the schema. Same table names as the former core slots so
// existing rows keep working.

import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const ghlTokenKindValidator = v.union(v.literal('location'), v.literal('agency'));

export const ghlConnectionStatusValidator = v.union(
  v.literal('active'),
  v.literal('invalid'),
  v.literal('disconnected'),
);

export const ghlImportJobStatusValidator = v.union(
  v.literal('pending'),
  v.literal('mapping'),
  v.literal('reviewing'),
  v.literal('awaiting_approval'),
  v.literal('running'),
  v.literal('paused'),
  v.literal('completed'),
  v.literal('failed'),
  v.literal('cancelled'),
);

export const ghlImportTables = {
  ghlConnections: defineTable({
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
    encryptedToken: v.string(),
    tokenKind: ghlTokenKindValidator,
    ghlLocationId: v.string(),
    ghlLocationName: v.optional(v.string()),
    status: ghlConnectionStatusValidator,
    lastValidatedAt: v.optional(v.number()),
    connectedBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_subAccount', ['subAccountId'])
    .index('by_agency', ['agencyId'])
    .index('by_ghlLocationId', ['ghlLocationId']),

  ghlImportJobs: defineTable({
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
    connectionId: v.id('ghlConnections'),
    userId: v.id('users'),
    status: ghlImportJobStatusValidator,
    selectedEntities: v.array(v.string()),
    currentEntity: v.optional(v.string()),
    cursor: v.optional(v.string()),
    entityIndex: v.number(),
    mapping: v.optional(v.any()),
    userMap: v.optional(v.any()),
    stageMap: v.optional(v.any()),
    fallbackUserId: v.optional(v.id('users')),
    policies: v.optional(v.any()),
    planSummary: v.optional(v.any()),
    approvedAt: v.optional(v.number()),
    totalEstimated: v.optional(v.number()),
    processed: v.number(),
    imported: v.number(),
    skipped: v.number(),
    updated: v.number(),
    rejected: v.optional(v.number()),
    errors: v.array(v.string()),
    entityCounts: v.optional(v.any()),
    followUps: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_subAccount', ['subAccountId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),

  ghlIdMappings: defineTable({
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
    jobId: v.optional(v.id('ghlImportJobs')),
    entityType: v.string(),
    ghlId: v.string(),
    seedlyId: v.string(),
    createdAt: v.number(),
  })
    .index('by_subAccount', ['subAccountId'])
    .index('by_subAccount_entity_ghlId', ['subAccountId', 'entityType', 'ghlId'])
    .index('by_job', ['jobId']),
};
