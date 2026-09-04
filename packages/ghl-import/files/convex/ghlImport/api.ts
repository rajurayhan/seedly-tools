import { mutation, query } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import {
  getAuthContext,
  requirePermission,
  requireSubAccount,
  type AuthContext,
} from '../_helpers';
import type { MutationCtx } from '../_generated/server';
import type { Id, Doc } from '../_generated/dataModel';
import { makeFunctionReference } from 'convex/server';
import {
  defaultSelectedEntities,
  GHL_IMPORT_ORDER,
  MANUAL_FOLLOW_UPS,
  type GhlEntityId,
} from '../../packages/ghl-import/src/entities';

const ERROR_CAP = 50;

const processImportBatchRef = makeFunctionReference<'action'>(
  'actions/ghl:processImportBatch',
);
const processDryRunBatchRef = makeFunctionReference<'action'>(
  'actions/ghl:processDryRunBatch',
);
const rollbackBatchRef = makeFunctionReference<'mutation'>(
  'ghlImport/internal:rollbackBatch',
);

export const getConnection = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const authCtx = await getAuthContext(ctx);
    const subAccountId = requireSubAccount(authCtx);
    const row = await ctx.db
      .query('ghlConnections')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .first();
    if (!row || row.status === 'disconnected') return null;
    return {
      _id: row._id,
      tokenKind: row.tokenKind,
      ghlLocationId: row.ghlLocationId,
      ghlLocationName: row.ghlLocationName,
      status: row.status,
      lastValidatedAt: row.lastValidatedAt,
      createdAt: row.createdAt,
    };
  },
});

export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const authCtx = await getAuthContext(ctx);
    const subAccountId = requireSubAccount(authCtx);
    const rows = await ctx.db
      .query('ghlImportJobs')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  },
});

export const getJob = query({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const authCtx = await getAuthContext(ctx);
    const subAccountId = requireSubAccount(authCtx);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.subAccountId !== subAccountId) return null;
    return job;
  },
});

export const listDestinationUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const authCtx = await getAuthContext(ctx);
    requireSubAccount(authCtx);
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_agency', (q) => q.eq('agencyId', authCtx.agencyId))
      .collect();
    const users = [];
    const seen = new Set<string>();
    for (const m of memberships) {
      if (seen.has(m.userId)) continue;
      seen.add(m.userId);
      const user = await ctx.db.get(m.userId);
      if (user?.isActive !== false) {
        const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email;
        users.push({ _id: user!._id, email: user!.email, name });
      }
    }
    return users;
  },
});

export const listDestinationPipelines = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const authCtx = await getAuthContext(ctx);
    const subAccountId = requireSubAccount(authCtx);
    const pipelines = await ctx.db
      .query('pipelines')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .collect();
    const out = [];
    for (const p of pipelines) {
      const stages = await ctx.db
        .query('pipelineStages')
        .withIndex('by_pipeline', (q) => q.eq('pipelineId', p._id))
        .collect();
      out.push({
        _id: p._id,
        name: p.name,
        stages: stages.map((s) => ({ _id: s._id, name: s.name })),
      });
    }
    return out;
  },
});

export const catalog = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      order: [...GHL_IMPORT_ORDER],
      defaultSelected: defaultSelectedEntities(),
      followUps: [...MANUAL_FOLLOW_UPS],
    };
  },
});

export const saveConnection = mutation({
  args: {
    encryptedToken: v.string(),
    tokenKind: v.union(v.literal('location'), v.literal('agency')),
    ghlLocationId: v.string(),
    ghlLocationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const subAccountId = requireSubAccount(authCtx);
    const now = Date.now();
    const existing = await ctx.db
      .query('ghlConnections')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .first();
    const fields = {
      agencyId: authCtx.agencyId,
      subAccountId,
      encryptedToken: args.encryptedToken,
      tokenKind: args.tokenKind,
      ghlLocationId: args.ghlLocationId.trim(),
      ghlLocationName: args.ghlLocationName,
      status: 'active' as const,
      lastValidatedAt: now,
      connectedBy: authCtx.userId,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert('ghlConnections', { ...fields, createdAt: now });
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const subAccountId = requireSubAccount(authCtx);
    const existing = await ctx.db
      .query('ghlConnections')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      status: 'disconnected',
      encryptedToken: '',
      updatedAt: Date.now(),
    });
    const jobs = await ctx.db
      .query('ghlImportJobs')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .collect();
    for (const job of jobs) {
      if (
        job.status === 'running' ||
        job.status === 'pending' ||
        job.status === 'paused' ||
        job.status === 'reviewing' ||
        job.status === 'awaiting_approval'
      ) {
        await ctx.db.patch(job._id, { status: 'cancelled', updatedAt: Date.now() });
      }
    }
  },
});

export const prepareReview = mutation({
  args: {
    selectedEntities: v.array(v.string()),
    mapping: v.optional(v.any()),
    entityCounts: v.optional(v.any()),
    userMap: v.optional(v.any()),
    stageMap: v.optional(v.any()),
    fallbackUserId: v.optional(v.id('users')),
    policies: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const subAccountId = requireSubAccount(authCtx);
    const connection = await ctx.db
      .query('ghlConnections')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .first();
    if (!connection || connection.status !== 'active') {
      throw new ConvexError('Connect GoHighLevel before starting an import');
    }
    const allowed = new Set(GHL_IMPORT_ORDER);
    const selected = args.selectedEntities.filter((id): id is GhlEntityId =>
      allowed.has(id as GhlEntityId),
    );
    if (selected.length === 0) throw new ConvexError('Select at least one entity to import');

    const running = await ctx.db
      .query('ghlImportJobs')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .collect();
    if (
      running.some((j) =>
        ['running', 'pending', 'reviewing', 'awaiting_approval'].includes(j.status),
      )
    ) {
      throw new ConvexError('An import is already in progress for this location');
    }

    const now = Date.now();
    const jobId = await ctx.db.insert('ghlImportJobs', {
      agencyId: authCtx.agencyId,
      subAccountId,
      connectionId: connection._id,
      userId: authCtx.userId,
      status: 'reviewing',
      selectedEntities: selected,
      currentEntity: selected[0],
      entityIndex: 0,
      mapping: args.mapping,
      userMap: args.userMap,
      stageMap: args.stageMap,
      fallbackUserId: args.fallbackUserId ?? authCtx.userId,
      policies: args.policies ?? { updateExisting: false, unassignOverdue: true },
      processed: 0,
      imported: 0,
      skipped: 0,
      updated: 0,
      rejected: 0,
      errors: [],
      entityCounts: args.entityCounts,
      followUps: MANUAL_FOLLOW_UPS.map((f) => f.id),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, processDryRunBatchRef, { jobId });
    return jobId;
  },
});

export const approveImport = mutation({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const job = await requireOwnedJob(ctx, authCtx, args.jobId);
    if (job.status !== 'awaiting_approval') {
      throw new ConvexError('Approve the dry-run before importing');
    }
    const summary = (job.planSummary ?? {}) as { blockers?: number };
    if ((summary.blockers ?? 0) > 0) {
      throw new ConvexError('Resolve dry-run blockers before importing');
    }
    await ctx.db.patch(job._id, {
      status: 'running',
      approvedAt: Date.now(),
      entityIndex: 0,
      cursor: undefined,
      currentEntity: job.selectedEntities[0],
      processed: 0,
      imported: 0,
      skipped: 0,
      updated: 0,
      rejected: 0,
      errors: [],
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, processImportBatchRef, { jobId: job._id });
    return job._id;
  },
});

export const startImport = mutation({
  args: {
    selectedEntities: v.array(v.string()),
    mapping: v.optional(v.any()),
    entityCounts: v.optional(v.any()),
  },
  handler: async () => {
    throw new ConvexError('Review and approve a dry-run before importing');
  },
});

export const pauseJob = mutation({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const job = await requireOwnedJob(ctx, authCtx, args.jobId);
    if (job.status !== 'running') throw new ConvexError('Only a running import can be paused');
    await ctx.db.patch(job._id, { status: 'paused', updatedAt: Date.now() });
  },
});

export const resumeJob = mutation({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const job = await requireOwnedJob(ctx, authCtx, args.jobId);
    if (job.status !== 'paused') throw new ConvexError('Only a paused import can be resumed');
    await ctx.db.patch(job._id, { status: 'running', updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, processImportBatchRef, { jobId: job._id });
  },
});

export const cancelJob = mutation({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const job = await requireOwnedJob(ctx, authCtx, args.jobId);
    if (job.status === 'completed') throw new ConvexError('This import already finished');
    await ctx.db.patch(job._id, { status: 'cancelled', updatedAt: Date.now(), completedAt: Date.now() });
  },
});

export const rollbackJob = mutation({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const authCtx = await getAuthContext(ctx);
    await requirePermission(ctx, authCtx, 'ghl_import', 'update');
    const job = await requireOwnedJob(ctx, authCtx, args.jobId);
    await ctx.scheduler.runAfter(0, rollbackBatchRef, {
      jobId: job._id,
      cursor: undefined,
    });
    return { started: true };
  },
});

async function requireOwnedJob(
  ctx: MutationCtx,
  authCtx: AuthContext,
  jobId: Id<'ghlImportJobs'>,
): Promise<Doc<'ghlImportJobs'>> {
  const job = await ctx.db.get(jobId);
  const subAccountId = requireSubAccount(authCtx);
  if (!job || job.subAccountId !== subAccountId) {
    throw new ConvexError('Import job not found');
  }
  return job;
}

export { ERROR_CAP };
