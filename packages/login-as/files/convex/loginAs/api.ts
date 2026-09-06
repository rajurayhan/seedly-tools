import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { mutation, query } from '../_generated/server';
import { components } from '../_generated/api';
import { resolveUserBySubject } from '../_helpers';
import {
  TWO_FACTOR_REQUIRED_MESSAGE,
  anyPlanAllowsLoginAs,
  callerScope,
  canStartAgainstTarget,
  displayName,
  isSuperAdminUser,
  publicUser,
} from '../../packages/login-as/src/gates.mjs';

const hidden = { visible: false, twoFactorEnrolled: false };

async function resolveRealUser(ctx: { auth: { getUserIdentity: Function }; db: unknown }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const realUser = await resolveUserBySubject(ctx, identity.subject);
  if (!realUser || !realUser.isActive) return null;
  return realUser;
}

async function hasTwoFactorEnrolled(
  ctx: { runQuery: Function },
  betterAuthId: string | undefined,
) {
  if (!betterAuthId) return false;
  try {
    const baUserResult = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'user',
      where: [{ field: '_id', value: betterAuthId }],
      paginationOpts: { cursor: null, numItems: 1 },
    });
    return baUserResult?.page?.[0]?.twoFactorEnabled === true;
  } catch {
    return false;
  }
}

async function ownerAgencyIds(ctx: { db: { get: Function; query: Function } }, userId: string) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q: { eq: Function }) => q.eq('userId', userId))
    .collect();
  const agencies: string[] = [];
  for (const m of memberships) {
    if (!m.isActive) continue;
    const role = await ctx.db.get(m.roleId);
    if (role?.slug === 'agency_owner') agencies.push(m.agencyId);
  }
  return agencies;
}

async function agencyPlansAllow(
  ctx: { db: { query: Function } },
  agencyIds: string[],
) {
  const plans = [];
  for (const agencyId of agencyIds) {
    const rows = await ctx.db
      .query('plans')
      .withIndex('by_agency', (q: { eq: Function }) => q.eq('agencyId', agencyId))
      .collect();
    plans.push(...rows.filter((p: { isActive?: boolean }) => p.isActive !== false));
  }
  return anyPlanAllowsLoginAs(plans);
}

async function resolveCaller(ctx: {
  auth: { getUserIdentity: Function };
  db: { get: Function; query: Function };
  runQuery: Function;
}) {
  const realUser = await resolveRealUser(ctx);
  if (!realUser) return null;
  const agencies = await ownerAgencyIds(ctx, realUser._id);
  const scope = callerScope({
    isSuperAdmin: isSuperAdminUser(realUser),
    isAgencyOwner: agencies.length > 0,
    planAllows: agencies.length > 0 ? await agencyPlansAllow(ctx, agencies) : false,
  });
  const twoFactorEnrolled = await hasTwoFactorEnrolled(ctx, realUser.betterAuthId);
  return { realUser, agencies, scope, twoFactorEnrolled };
}

async function openSession(ctx: { db: { query: Function } }, realUserId: string) {
  return ctx.db
    .query('loginAsSessions')
    .withIndex('by_realUser_active', (q: { eq: Function }) =>
      q.eq('realUserId', realUserId).eq('endedAt', undefined),
    )
    .first();
}

async function targetSharesAgency(
  ctx: { db: { query: Function } },
  targetUserId: string,
  agencyIds: string[],
) {
  const agencySet = new Set(agencyIds.map(String));
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q: { eq: Function }) => q.eq('userId', targetUserId))
    .collect();
  for (const m of memberships) {
    if (m.isActive && agencySet.has(String(m.agencyId))) return m;
  }
  return null;
}

export const getAvailability = query({
  args: {},
  handler: async (ctx) => {
    try {
      const caller = await resolveCaller(ctx);
      if (!caller || !caller.scope) return hidden;
      return {
        visible: true,
        twoFactorEnrolled: caller.twoFactorEnrolled,
        scope: caller.scope,
      };
    } catch {
      return hidden;
    }
  },
});

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    try {
      const realUser = await resolveRealUser(ctx);
      if (!realUser) return null;
      const session = await openSession(ctx, realUser._id);
      if (!session) return null;
      const targetUser = await ctx.db.get(session.targetUserId);
      if (!targetUser || !targetUser.isActive) return null;
      return {
        sessionId: session._id,
        startedAt: session.startedAt,
        real: { ...publicUser(realUser), name: displayName(realUser) },
        target: { ...publicUser(targetUser), name: displayName(targetUser) },
      };
    } catch {
      return null;
    }
  },
});

export const start = mutation({
  args: { targetUserId: v.id('users') },
  handler: async (ctx, args) => {
    const caller = await resolveCaller(ctx);
    if (!caller || !caller.scope) throw new ConvexError('Access denied');
    if (!caller.twoFactorEnrolled) throw new ConvexError(TWO_FACTOR_REQUIRED_MESSAGE);

    const targetUser = await ctx.db.get(args.targetUserId);
    const shared = caller.scope === 'agency'
      ? await targetSharesAgency(ctx, args.targetUserId, caller.agencies)
      : true;
    if (
      !canStartAgainstTarget({
        scope: caller.scope,
        realUserId: caller.realUser._id,
        target: targetUser,
        sharedAgency: Boolean(shared),
        targetIsSuperAdmin: isSuperAdminUser(targetUser),
      })
    ) {
      throw new ConvexError(targetUser ? 'Access denied' : 'User not found');
    }

    const existing = await openSession(ctx, caller.realUser._id);
    if (existing) {
      await ctx.db.patch(existing._id, {
        endedAt: Date.now(),
        endedReason: 'manual',
      });
    }

    const membership =
      typeof shared === 'object' && shared
        ? shared
        : await ctx.db
            .query('memberships')
            .withIndex('by_user', (q) => q.eq('userId', targetUser._id))
            .filter((q) => q.eq(q.field('isActive'), true))
            .first();
    if (!membership) throw new ConvexError('Target user has no active membership');

    const sessionId = await ctx.db.insert('loginAsSessions', {
      realUserId: caller.realUser._id,
      targetUserId: targetUser._id,
      agencyId: membership.agencyId,
      subAccountId: membership.subAccountId,
      startedAt: Date.now(),
    });
    await ctx.db.insert('loginAsAudit', {
      sessionId,
      realUserId: caller.realUser._id,
      targetUserId: targetUser._id,
      agencyId: membership.agencyId,
      action: 'started',
      at: Date.now(),
    });
    return { sessionId };
  },
});

export const stop = mutation({
  args: {
    reason: v.optional(v.union(v.literal('manual'), v.literal('signout'))),
  },
  handler: async (ctx, args) => {
    const realUser = await resolveRealUser(ctx);
    if (!realUser) throw new ConvexError('Not authenticated');
    const existing = await openSession(ctx, realUser._id);
    if (!existing) return { stopped: false };
    const endedReason = args.reason ?? 'manual';
    await ctx.db.patch(existing._id, {
      endedAt: Date.now(),
      endedReason,
    });
    await ctx.db.insert('loginAsAudit', {
      sessionId: existing._id,
      realUserId: existing.realUserId,
      targetUserId: existing.targetUserId,
      agencyId: existing.agencyId,
      action: 'stopped',
      at: Date.now(),
      endedReason,
    });
    return { stopped: true };
  },
});

export const searchTargets = query({
  args: {
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const caller = await resolveCaller(ctx);
    if (!caller || !caller.scope) throw new ConvexError('Access denied');
    if (!caller.twoFactorEnrolled) throw new ConvexError(TWO_FACTOR_REQUIRED_MESSAGE);

    const search = args.search?.trim().toLowerCase();
    const match = (u: { isActive: boolean; firstName?: string; lastName?: string; email?: string }) => {
      if (!u.isActive) return false;
      if (!search) return true;
      const haystack = `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email ?? ''}`.toLowerCase();
      return haystack.includes(search);
    };

    if (caller.scope === 'all') {
      const result = await ctx.db.query('users').order('desc').paginate(args.paginationOpts);
      return {
        ...result,
        page: result.page.filter(match).map(publicUser),
      };
    }

    const seen = new Set<string>();
    const users = [];
    for (const agencyId of caller.agencies) {
      const memberships = await ctx.db
        .query('memberships')
        .withIndex('by_agency', (q) => q.eq('agencyId', agencyId))
        .collect();
      for (const m of memberships) {
        if (!m.isActive) continue;
        const id = String(m.userId);
        if (seen.has(id)) continue;
        seen.add(id);
        const u = await ctx.db.get(m.userId);
        if (!u || !match(u) || isSuperAdminUser(u) || String(u._id) === String(caller.realUser._id)) {
          continue;
        }
        users.push(publicUser(u));
      }
    }
    return {
      page: users,
      isDone: true,
      continueCursor: '',
    };
  },
});
