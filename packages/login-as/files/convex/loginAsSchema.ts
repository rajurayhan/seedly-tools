import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const loginAsEndedReasonValidator = v.union(v.literal('manual'), v.literal('signout'));

export const loginAsTables = {
  loginAsSessions: defineTable({
    realUserId: v.id('users'),
    targetUserId: v.id('users'),
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    endedReason: v.optional(loginAsEndedReasonValidator),
  }).index('by_realUser_active', ['realUserId', 'endedAt']),

  loginAsAudit: defineTable({
    sessionId: v.id('loginAsSessions'),
    realUserId: v.id('users'),
    targetUserId: v.id('users'),
    agencyId: v.id('agencies'),
    action: v.union(v.literal('started'), v.literal('stopped')),
    at: v.number(),
    endedReason: v.optional(loginAsEndedReasonValidator),
  }).index('by_session', ['sessionId']),
};
