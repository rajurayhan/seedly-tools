import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const seedlyPinStatusValidator = v.union(
  v.literal('open'),
  v.literal('in_progress'),
  v.literal('resolved'),
  v.literal('closed'),
);

export const seedlyPinPriorityValidator = v.union(
  v.literal('lowest'),
  v.literal('low'),
  v.literal('medium'),
  v.literal('high'),
  v.literal('highest'),
);

export const seedlyPinFileTypeValidator = v.union(
  v.literal('screenshot'),
  v.literal('video'),
  v.literal('attachment'),
);

export const seedlyPinHistoryActionValidator = v.union(
  v.literal('created'),
  v.literal('status_changed'),
  v.literal('priority_changed'),
  v.literal('assignee_changed'),
  v.literal('description_changed'),
  v.literal('note_added'),
);

export const seedlyPinTables = {
  seedlyPins: defineTable({
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
    createdBy: v.id('users'),
    assignedTo: v.optional(v.id('users')),
    title: v.string(),
    description: v.optional(v.string()),
    status: seedlyPinStatusValidator,
    priority: seedlyPinPriorityValidator,
    source: v.union(v.literal('capture'), v.literal('manual')),
    annotations: v.optional(v.any()),
    metadata: v.any(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id('users')),
    closedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_agency', ['agencyId'])
    .index('by_subAccount', ['subAccountId'])
    .index('by_subAccount_status', ['subAccountId', 'status'])
    .index('by_assignee', ['assignedTo']),

  seedlyPinFiles: defineTable({
    pinId: v.id('seedlyPins'),
    agencyId: v.id('agencies'),
    type: seedlyPinFileTypeValidator,
    filename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    storageId: v.id('_storage'),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_pin', ['pinId']),

  seedlyPinNotes: defineTable({
    pinId: v.id('seedlyPins'),
    agencyId: v.id('agencies'),
    userId: v.id('users'),
    message: v.string(),
    createdAt: v.number(),
  }).index('by_pin', ['pinId']),

  seedlyPinHistory: defineTable({
    pinId: v.id('seedlyPins'),
    agencyId: v.id('agencies'),
    userId: v.optional(v.id('users')),
    action: seedlyPinHistoryActionValidator,
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_pin', ['pinId']),
};
