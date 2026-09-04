import { internalMutation, internalQuery, type MutationCtx } from '../_generated/server';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { makeFunctionReference } from 'convex/server';
import { addManualMember } from '../listsHelpers';
import { incrementContactCountForSubAccount } from '../_helpers';
import { normalizeEmail } from '../../packages/shared/src/validators/email';
import { normalizePhone } from '../../packages/shared/src/validators/phone';
import {
  customFieldOptions,
  customFieldValues,
  mapAppointmentStatus,
  mapCustomFieldType,
  mapDealStatus,
  mapMessageChannel,
  mapMessageDirection,
  parseEpoch,
  remapCustomFieldKeys,
  slugify,
  mapHlDnd,
  mapInertMessageStatus,
} from '../../packages/ghl-import/src/transformers';
import { GHL_IMPORT_ORDER, type GhlEntityId } from '../../packages/ghl-import/src/entities';

const ERROR_CAP = 50;
const ROLLBACK_BATCH = 40;

const rollbackBatchRef = makeFunctionReference<'mutation'>('ghlImport/internal:rollbackBatch');

export const getJobInternal = internalQuery({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => ctx.db.get(args.jobId),
});

export const getConnectionInternal = internalQuery({
  args: { connectionId: v.id('ghlConnections') },
  handler: async (ctx, args) => ctx.db.get(args.connectionId),
});

export const getUsersForAgency = internalQuery({
  args: { agencyId: v.id('agencies') },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_agency', (q) => q.eq('agencyId', args.agencyId))
      .collect();
    const users = [];
    const seen = new Set<string>();
    for (const m of memberships) {
      if (seen.has(m.userId)) continue;
      seen.add(m.userId);
      const user = await ctx.db.get(m.userId);
      if (user) users.push({ _id: user._id, email: user.email });
    }
    return users;
  },
});

export const lookupMapping = internalQuery({
  args: {
    subAccountId: v.id('subAccounts'),
    entityType: v.string(),
    ghlId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('ghlIdMappings')
      .withIndex('by_subAccount_entity_ghlId', (q) =>
        q
          .eq('subAccountId', args.subAccountId)
          .eq('entityType', args.entityType)
          .eq('ghlId', args.ghlId),
      )
      .first();
  },
});

export const patchJob = internalMutation({
  args: {
    jobId: v.id('ghlImportJobs'),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('mapping'),
        v.literal('reviewing'),
        v.literal('awaiting_approval'),
        v.literal('running'),
        v.literal('paused'),
        v.literal('completed'),
        v.literal('failed'),
        v.literal('cancelled'),
      ),
    ),
    currentEntity: v.optional(v.string()),
    cursor: v.optional(v.union(v.string(), v.null())),
    entityIndex: v.optional(v.number()),
    processedDelta: v.optional(v.number()),
    importedDelta: v.optional(v.number()),
    skippedDelta: v.optional(v.number()),
    updatedDelta: v.optional(v.number()),
    rejectedDelta: v.optional(v.number()),
    planSummary: v.optional(v.any()),
    error: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    if (job.status === 'cancelled' || job.status === 'paused') return job.status;
    const errors = [...job.errors];
    if (args.error && errors.length < ERROR_CAP) errors.push(args.error);
    const nextStatus = args.completed
      ? job.status === 'reviewing'
        ? 'awaiting_approval'
        : 'completed'
      : (args.status ?? job.status);
    await ctx.db.patch(args.jobId, {
      status: nextStatus,
      currentEntity: args.currentEntity ?? job.currentEntity,
      cursor: args.cursor === null ? undefined : (args.cursor ?? job.cursor),
      entityIndex: args.entityIndex ?? job.entityIndex,
      processed: job.processed + (args.processedDelta ?? 0),
      imported: job.imported + (args.importedDelta ?? 0),
      skipped: job.skipped + (args.skippedDelta ?? 0),
      updated: job.updated + (args.updatedDelta ?? 0),
      rejected: (job.rejected ?? 0) + (args.rejectedDelta ?? 0),
      planSummary: args.planSummary ?? job.planSummary,
      errors,
      updatedAt: Date.now(),
      completedAt: args.completed && nextStatus === 'completed' ? Date.now() : job.completedAt,
    });
    return nextStatus;
  },
});

export const markJobFailed = internalMutation({
  args: { jobId: v.id('ghlImportJobs'), error: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    const errors = [...job.errors];
    if (errors.length < ERROR_CAP) errors.push(args.error);
    await ctx.db.patch(args.jobId, {
      status: 'failed',
      errors,
      updatedAt: Date.now(),
      completedAt: Date.now(),
    });
  },
});

async function putMapping(
  ctx: MutationCtx,
  args: {
    agencyId: Id<'agencies'>;
    subAccountId: Id<'subAccounts'>;
    jobId: Id<'ghlImportJobs'>;
    entityType: string;
    ghlId: string;
    seedlyId: string;
  },
) {
  const existing = await ctx.db
    .query('ghlIdMappings')
    .withIndex('by_subAccount_entity_ghlId', (q) =>
      q.eq('subAccountId', args.subAccountId).eq('entityType', args.entityType).eq('ghlId', args.ghlId),
    )
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert('ghlIdMappings', {
    agencyId: args.agencyId,
    subAccountId: args.subAccountId,
    jobId: args.jobId,
    entityType: args.entityType,
    ghlId: args.ghlId,
    seedlyId: args.seedlyId,
    createdAt: Date.now(),
  });
}

async function mappedId(
  ctx: MutationCtx,
  subAccountId: Id<'subAccounts'>,
  entityType: string,
  ghlId: string | undefined,
): Promise<string | undefined> {
  if (!ghlId) return undefined;
  const row = await ctx.db
    .query('ghlIdMappings')
    .withIndex('by_subAccount_entity_ghlId', (q) =>
      q.eq('subAccountId', subAccountId).eq('entityType', entityType).eq('ghlId', ghlId),
    )
    .first();
  return row?.seedlyId;
}

export const importBatch = internalMutation({
  args: {
    jobId: v.id('ghlImportJobs'),
    entity: v.string(),
    records: v.array(v.any()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    const dryRun = args.dryRun === true;
    if (!job) {
      return { imported: 0, skipped: 0, updated: 0, rejected: 0, errors: [] as string[] };
    }
    if (!dryRun && job.status !== 'running') {
      return { imported: 0, skipped: 0, updated: 0, rejected: 0, errors: [] as string[] };
    }
    if (dryRun && job.status !== 'reviewing') {
      return { imported: 0, skipped: 0, updated: 0, rejected: 0, errors: [] as string[] };
    }
    const now = Date.now();
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    let rejected = 0;
    const errors: string[] = [];
    const mapping = (job.mapping ?? {}) as Record<string, unknown>;
    const userMap = (job.userMap ?? {}) as Record<string, string>;
    const stageMap = (job.stageMap ?? {}) as Record<string, { pipelineId: string; stageId: string }>;
    const policies = (job.policies ?? {}) as { updateExisting?: boolean; unassignOverdue?: boolean };
    const updateExisting = policies.updateExisting === true;

    const remember = async (entityType: string, ghlId: string, seedlyId: string) => {
      if (dryRun) return;
      await putMapping(ctx, {
        agencyId: job.agencyId,
        subAccountId: job.subAccountId,
        jobId: job._id,
        entityType,
        ghlId,
        seedlyId,
      });
    };

    for (const raw of args.records) {
      const rec = raw as Record<string, unknown>;
      const ghlId = typeof rec.id === 'string' ? rec.id : undefined;
      if (!ghlId) {
        skipped++;
        continue;
      }
      try {
        const already = await mappedId(ctx, job.subAccountId, args.entity, ghlId);
        if (already && args.entity !== 'listMemberships') {
          skipped++;
          continue;
        }
        const CORE_PLAN = new Set([
          'tags',
          'customFields',
          'contacts',
          'pipelines',
          'deals',
          'contactNotes',
          'tasks',
          'conversations',
          'messages',
        ]);
        if (dryRun && !CORE_PLAN.has(args.entity)) {
          imported++;
          continue;
        }

        switch (args.entity as GhlEntityId) {
          case 'users': {
            const email = typeof rec.email === 'string' ? rec.email.toLowerCase().trim() : '';
            if (!email) {
              skipped++;
              break;
            }
            const user = await ctx.db
              .query('users')
              .withIndex('by_email', (q) => q.eq('email', email))
              .first();
            if (user) {
              await remember('users', ghlId, user._id);
              imported++;
            } else {
              skipped++;
            }
            break;
          }
          case 'tags': {
            const name = String(rec.name ?? '').trim();
            if (!name) {
              skipped++;
              break;
            }
            const existing = await ctx.db
              .query('tags')
              .withIndex('by_subAccount_name', (q) =>
                q.eq('subAccountId', job.subAccountId).eq('name', name),
              )
              .first();
            if (existing) {
              await remember('tags', ghlId, existing._id);
              skipped++;
              break;
            }
            if (dryRun) {
              imported++;
              break;
            }
            const id = await ctx.db.insert('tags', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name,
              createdAt: now,
              updatedAt: now,
            });
            await remember('tags', ghlId, id);
            imported++;
            break;
          }
          case 'customFields': {
            const label = String(rec.name ?? 'Field');
            const fieldType = mapCustomFieldType(
              typeof rec.dataType === 'string' ? rec.dataType : undefined,
            ) as
              | 'text'
              | 'number'
              | 'date'
              | 'select'
              | 'boolean'
              | 'url'
              | 'email'
              | 'phone'
              | 'monetary'
              | 'file'
              | 'signature'
              | 'radio'
              | 'textbox_list';
            const options = customFieldOptions(rec as never);
            const existingFields = await ctx.db
              .query('contactCustomFields')
              .withIndex('by_subAccount', (q) => q.eq('subAccountId', job.subAccountId))
              .collect();
            const reuse = existingFields.find(
              (f) => f.label.toLowerCase() === label.toLowerCase() && f.fieldType === fieldType,
            );
            if (reuse) {
              await remember('customFields', ghlId, reuse._id);
              skipped++;
              break;
            }
            if (dryRun) {
              imported++;
              break;
            }
            const id = await ctx.db.insert('contactCustomFields', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name: slugify(label).replace(/-/g, '_'),
              label,
              fieldType,
              options,
              isRequired: false,
              sortOrder: typeof rec.position === 'number' ? rec.position : 0,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            });
            await remember('customFields', ghlId, id);
            imported++;
            break;
          }
          case 'companies': {
            const name = String(rec.name ?? 'Imported company');
            const existing = await ctx.db
              .query('companies')
              .withIndex('by_subAccount_name', (q) =>
                q.eq('subAccountId', job.subAccountId).eq('name', name),
              )
              .first();
            if (existing) {
              await remember('companies', ghlId, existing._id);
              skipped++;
              break;
            }
            const id = await ctx.db.insert('companies', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name,
              phone: typeof rec.phone === 'string' ? rec.phone : undefined,
              email: typeof rec.email === 'string' ? rec.email : undefined,
              website: typeof rec.website === 'string' ? rec.website : undefined,
              addressLine1: typeof rec.address === 'string' ? rec.address : undefined,
              city: typeof rec.city === 'string' ? rec.city : undefined,
              state: typeof rec.state === 'string' ? rec.state : undefined,
              postalCode: typeof rec.postalCode === 'string' ? rec.postalCode : undefined,
              country: typeof rec.country === 'string' ? rec.country : undefined,
              createdAt: now,
              updatedAt: now,
            });
            await remember('companies', ghlId, id);
            imported++;
            break;
          }
          case 'contacts': {
            let email: string | undefined;
            if (typeof rec.email === 'string' && rec.email.trim()) {
              try {
                email = normalizeEmail(rec.email);
              } catch {
                email = undefined;
              }
            }
            let phone: string | undefined;
            if (typeof rec.phone === 'string' && rec.phone.trim()) {
              try {
                phone = normalizePhone(rec.phone);
              } catch {
                phone = rec.phone;
              }
            }
            if (!email && !phone) {
              skipped++;
              break;
            }
            let existing = email
              ? await ctx.db
                  .query('contacts')
                  .withIndex('by_subAccount_email', (q) =>
                    q.eq('subAccountId', job.subAccountId).eq('email', email),
                  )
                  .first()
              : null;
            if (!existing && phone) {
              existing = await ctx.db
                .query('contacts')
                .withIndex('by_subAccount_phone', (q) =>
                  q.eq('subAccountId', job.subAccountId).eq('phone', phone),
                )
                .first();
            }
            const companyGhlId = typeof rec.companyId === 'string' ? rec.companyId : undefined;
            const companySeedly = await mappedId(ctx, job.subAccountId, 'companies', companyGhlId);
            const tags = Array.isArray(rec.tags)
              ? rec.tags.filter((t): t is string => typeof t === 'string')
              : undefined;
            const dndResult = mapHlDnd(rec.dnd, rec.dndSettings);
            if (!dndResult.ok) {
              rejected++;
              if (errors.length < ERROR_CAP) errors.push(`contact ${ghlId}: ${dndResult.reason}`);
              break;
            }
            const createdAt = parseEpoch(
              typeof rec.dateAdded === 'string' ? rec.dateAdded : undefined,
              now,
            );
            const assignedGhlId = typeof rec.assignedTo === 'string' ? rec.assignedTo : undefined;
            const mappedOwner =
              (assignedGhlId ? userMap[assignedGhlId] : undefined) ??
              (await mappedId(ctx, job.subAccountId, 'users', assignedGhlId)) ??
              job.fallbackUserId;
            if (existing) {
              await remember('contacts', ghlId, existing._id);
              if (updateExisting && !dryRun) {
                await ctx.db.patch(existing._id, {
                  firstName: typeof rec.firstName === 'string' ? rec.firstName : existing.firstName,
                  lastName: typeof rec.lastName === 'string' ? rec.lastName : existing.lastName,
                  dndSettings:
                    Object.keys(dndResult.settings).length > 0
                      ? dndResult.settings
                      : existing.dndSettings,
                  updatedAt: now,
                });
                updated++;
              } else {
                skipped++;
              }
              break;
            }
            if (dryRun) {
              imported++;
              break;
            }
            const id = await ctx.db.insert('contacts', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              email,
              phone,
              firstName: typeof rec.firstName === 'string' ? rec.firstName : undefined,
              lastName: typeof rec.lastName === 'string' ? rec.lastName : undefined,
              company: typeof rec.companyName === 'string' ? rec.companyName : undefined,
              companyId: companySeedly as Id<'companies'> | undefined,
              website: typeof rec.website === 'string' ? rec.website : undefined,
              addressLine1: typeof rec.address1 === 'string' ? rec.address1 : undefined,
              city: typeof rec.city === 'string' ? rec.city : undefined,
              state: typeof rec.state === 'string' ? rec.state : undefined,
              postalCode: typeof rec.postalCode === 'string' ? rec.postalCode : undefined,
              country: typeof rec.country === 'string' ? rec.country : undefined,
              timezone: typeof rec.timezone === 'string' ? rec.timezone : undefined,
              tags,
              customFields: remapCustomFieldKeys(
                customFieldValues(rec as never),
                mapping as Record<string, string>,
              ),
              assignedTo: mappedOwner as Id<'users'> | undefined,
              dndSettings: Object.keys(dndResult.settings).length > 0 ? dndResult.settings : undefined,
              isActive: true,
              source: 'ghl-import',
              createdAt,
              updatedAt: now,
            });
            await remember('contacts', ghlId, id);
            await incrementContactCountForSubAccount(ctx, job.subAccountId);
            for (const channel of dndResult.suppressions) {
              if (channel === 'email' && email) {
                await ctx.db.insert('suppressions', {
                  agencyId: job.agencyId,
                  subAccountId: job.subAccountId,
                  email,
                  reason: 'manual',
                  channel: 'email',
                  contactId: id,
                  createdAt: now,
                });
              }
              if (channel === 'sms' && email) {
                await ctx.db.insert('suppressions', {
                  agencyId: job.agencyId,
                  subAccountId: job.subAccountId,
                  email,
                  phone,
                  reason: 'manual',
                  channel: 'sms',
                  contactId: id,
                  createdAt: now,
                });
              }
            }
            const sub = await ctx.db.get(job.subAccountId);
            const settings = (sub?.settings as Record<string, unknown> | undefined) ?? {};
            const defaultTransactionalListId = settings.defaultTransactionalListId as
              | Id<'emailCategories'>
              | undefined;
            if (defaultTransactionalListId) {
              const list = await ctx.db.get(defaultTransactionalListId);
              if (list && !list.archivedAt) {
                await addManualMember(ctx, defaultTransactionalListId, id, 'import');
              }
            }
            imported++;
            break;
          }
          case 'contactNotes': {
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            if (!contactId || typeof rec.body !== 'string' || !rec.body.trim()) {
              skipped++;
              break;
            }
            if (dryRun) {
              imported++;
              break;
            }
            const id = await ctx.db.insert('contactNotes', {
              contactId: contactId as Id<'contacts'>,
              content: rec.body,
              createdBy: job.userId,
              subAccountId: job.subAccountId,
              agencyId: job.agencyId,
              createdAt: parseEpoch(typeof rec.dateAdded === 'string' ? rec.dateAdded : undefined, now),
              updatedAt: now,
            });
            await remember('contactNotes', ghlId, id);
            imported++;
            break;
          }
          case 'tasks': {
            const title = typeof rec.title === 'string' && rec.title.trim() ? rec.title : 'Imported task';
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            const dueDate = rec.dueDate
              ? parseEpoch(typeof rec.dueDate === 'string' ? rec.dueDate : undefined, now)
              : undefined;
            const completed = rec.completed === true;
            const overdueOpen = !completed && dueDate !== undefined && dueDate < now;
            if (dryRun) {
              imported++;
              break;
            }
            let project = await ctx.db
              .query('pmProjects')
              .withIndex('by_subAccount', (q) => q.eq('subAccountId', job.subAccountId))
              .collect()
              .then((rows) => rows.find((p) => p.name === 'Imported from HighLevel'));
            if (!project) {
              const projectId = await ctx.db.insert('pmProjects', {
                agencyId: job.agencyId,
                subAccountId: job.subAccountId,
                name: 'Imported from HighLevel',
                status: 'active',
                createdBy: job.fallbackUserId ?? job.userId,
                createdAt: now,
                updatedAt: now,
              });
              project = (await ctx.db.get(projectId)) ?? undefined;
            }
            if (!project) {
              skipped++;
              break;
            }
            const taskId = await ctx.db.insert('pmTasks', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              projectId: project._id,
              title,
              description: typeof rec.body === 'string' ? rec.body : undefined,
              status: completed ? 'completed' : 'todo',
              priority: 'medium',
              dueDate,
              contactId: contactId as Id<'contacts'> | undefined,
              createdBy: job.fallbackUserId ?? job.userId,
              createdAt: parseEpoch(
                typeof rec.dateAdded === 'string' ? rec.dateAdded : undefined,
                now,
              ),
              updatedAt: completed ? parseEpoch(
                typeof rec.dateUpdated === 'string' ? rec.dateUpdated : undefined,
                now,
              ) : now,
            });
            const assigneeGhl = typeof rec.assignedTo === 'string' ? rec.assignedTo : undefined;
            const assignee =
              (assigneeGhl ? userMap[assigneeGhl] : undefined) ??
              (await mappedId(ctx, job.subAccountId, 'users', assigneeGhl));
            if (assignee && !(overdueOpen && policies.unassignOverdue !== false)) {
              await ctx.db.insert('pmAssignees', {
                agencyId: job.agencyId,
                subAccountId: job.subAccountId,
                taskId,
                userId: assignee as Id<'users'>,
                assignedAt: now,
              });
            }
            await remember('tasks', ghlId, taskId);
            imported++;
            break;
          }
          case 'pipelines': {
            const name = String(rec.name ?? 'Imported pipeline');
            const stages = Array.isArray(rec.stages) ? rec.stages : [];
            const existingPipes = await ctx.db
              .query('pipelines')
              .withIndex('by_subAccount', (q) => q.eq('subAccountId', job.subAccountId))
              .collect();
            const reusePipe = existingPipes.find((p) => p.name.toLowerCase() === name.toLowerCase());
            if (reusePipe) {
              await remember('pipelines', ghlId, reusePipe._id);
              const existingStages = await ctx.db
                .query('pipelineStages')
                .withIndex('by_pipeline', (q) => q.eq('pipelineId', reusePipe._id))
                .collect();
              let appended = 0;
              let pos = existingStages.reduce((acc, s) => (s.position > acc ? s.position : acc), 'a0');
              for (const stageRaw of stages) {
                const stage = stageRaw as Record<string, unknown>;
                const stageIdGhl = typeof stage.id === 'string' ? stage.id : undefined;
                if (!stageIdGhl) continue;
                const stageName = String(stage.name ?? 'Stage');
                const found = existingStages.find(
                  (s) => s.name.toLowerCase() === stageName.toLowerCase(),
                );
                if (found) {
                  await remember('pipelineStages', stageIdGhl, found._id);
                  continue;
                }
                if (dryRun) {
                  imported++;
                  appended += 1;
                  continue;
                }
                pos = `${pos}V`;
                const stageId = await ctx.db.insert('pipelineStages', {
                  agencyId: job.agencyId,
                  subAccountId: job.subAccountId,
                  pipelineId: reusePipe._id,
                  name: stageName,
                  position: pos,
                  createdAt: now,
                  updatedAt: now,
                });
                await remember('pipelineStages', stageIdGhl, stageId);
                appended += 1;
              }
              if (appended === 0) skipped++;
              else if (!dryRun) imported++;
              break;
            }
            if (dryRun) {
              imported++;
              break;
            }
            const pipelineId = await ctx.db.insert('pipelines', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name,
              isDefault: false,
              createdAt: now,
              updatedAt: now,
            });
            await remember('pipelines', ghlId, pipelineId);
            let pos = 'a0';
            for (const stageRaw of stages) {
              const stage = stageRaw as Record<string, unknown>;
              const stageIdGhl = typeof stage.id === 'string' ? stage.id : undefined;
              if (!stageIdGhl) continue;
              const stageId = await ctx.db.insert('pipelineStages', {
                agencyId: job.agencyId,
                subAccountId: job.subAccountId,
                pipelineId,
                name: String(stage.name ?? 'Stage'),
                position: pos,
                createdAt: now,
                updatedAt: now,
              });
              pos = `${pos}V`;
              await remember('pipelineStages', stageIdGhl, stageId);
            }
            imported++;
            break;
          }
          case 'deals': {
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            const pipelineId = await mappedId(
              ctx,
              job.subAccountId,
              'pipelines',
              typeof rec.pipelineId === 'string' ? rec.pipelineId : undefined,
            );
            const stageId = await mappedId(
              ctx,
              job.subAccountId,
              'pipelineStages',
              typeof rec.pipelineStageId === 'string' ? rec.pipelineStageId : undefined,
            );
            const mappedStage = typeof rec.pipelineStageId === 'string'
              ? stageMap[rec.pipelineStageId]
              : undefined;
            const resolvedPipeline = mappedStage?.pipelineId ?? pipelineId;
            const resolvedStage = mappedStage?.stageId ?? stageId;
            if (!contactId || !resolvedPipeline || !resolvedStage) {
              skipped++;
              break;
            }
            const assigned =
              (typeof rec.assignedTo === 'string' ? userMap[rec.assignedTo] : undefined) ??
              (await mappedId(
                ctx,
                job.subAccountId,
                'users',
                typeof rec.assignedTo === 'string' ? rec.assignedTo : undefined,
              )) ??
              job.fallbackUserId;
            const status = mapDealStatus(typeof rec.status === 'string' ? rec.status : undefined);
            const createdAt = parseEpoch(
              typeof rec.dateAdded === 'string' ? rec.dateAdded : undefined,
              now,
            );
            if (dryRun) {
              imported++;
              break;
            }
            const id = await ctx.db.insert('deals', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              pipelineId: resolvedPipeline as Id<'pipelines'>,
              stageId: resolvedStage as Id<'pipelineStages'>,
              contactId: contactId as Id<'contacts'>,
              name: String(rec.name ?? 'Imported opportunity'),
              value: typeof rec.monetaryValue === 'number' ? rec.monetaryValue : undefined,
              currency: 'USD',
              assignedTo: assigned as Id<'users'> | undefined,
              status,
              source: 'ghl-import',
              createdAt,
              updatedAt: status === 'open' ? now : createdAt,
            });
            await remember('deals', ghlId, id);
            imported++;
            break;
          }
          case 'calendars': {
            const name = String(rec.name ?? 'Imported calendar');
            const slugBase = slugify(name);
            const slug = `${slugBase}-${ghlId.slice(-6)}`;
            const assigned = await mappedId(
              ctx,
              job.subAccountId,
              'users',
              typeof rec.userId === 'string' ? rec.userId : undefined,
            );
            const id = await ctx.db.insert('calendars', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              userId: assigned as Id<'users'> | undefined,
              name,
              description: typeof rec.description === 'string' ? rec.description : undefined,
              slug,
              timezone: typeof rec.timezone === 'string' ? rec.timezone : 'America/New_York',
              isActive: true,
              type: typeof rec.calendarType === 'string' ? rec.calendarType : 'personal',
              googleSyncEnabled: false,
              createdAt: now,
              updatedAt: now,
            });
            await remember('calendars', ghlId, id);
            imported++;
            break;
          }
          case 'appointments': {
            const calendarId = await mappedId(
              ctx,
              job.subAccountId,
              'calendars',
              typeof rec.calendarId === 'string' ? rec.calendarId : undefined,
            );
            if (!calendarId) {
              skipped++;
              break;
            }
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            const assigned = await mappedId(
              ctx,
              job.subAccountId,
              'users',
              typeof rec.assignedUserId === 'string' ? rec.assignedUserId : undefined,
            );
            const start = parseEpoch(
              typeof rec.startTime === 'string' ? rec.startTime : undefined,
              now,
            );
            const end = parseEpoch(typeof rec.endTime === 'string' ? rec.endTime : undefined, start + 30 * 60_000);
            const id = await ctx.db.insert('appointments', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              calendarId: calendarId as Id<'calendars'>,
              contactId: contactId as Id<'contacts'> | undefined,
              title: String(rec.title ?? 'Imported appointment'),
              startTime: start,
              endTime: end,
              status: mapAppointmentStatus(
                typeof rec.appointmentStatus === 'string' ? rec.appointmentStatus : undefined,
              ),
              notes: typeof rec.notes === 'string' ? rec.notes : undefined,
              assignedTo: assigned as Id<'users'> | undefined,
              createdAt: now,
              updatedAt: now,
            });
            await remember('appointments', ghlId, id);
            imported++;
            break;
          }
          case 'conversations': {
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            if (!contactId) {
              skipped++;
              break;
            }
            if (dryRun) {
              imported++;
              break;
            }
            const channel = mapMessageChannel(typeof rec.type === 'string' ? rec.type : undefined);
            const assigned = await mappedId(
              ctx,
              job.subAccountId,
              'users',
              typeof rec.assignedTo === 'string' ? rec.assignedTo : undefined,
            );
            const id = await ctx.db.insert('conversations', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              contactId: contactId as Id<'contacts'>,
              channel,
              status: 'open',
              assignedTo: assigned as Id<'users'> | undefined,
              lastMessageAt: rec.lastMessageDate
                ? parseEpoch(String(rec.lastMessageDate), now)
                : undefined,
              lastMessagePreview:
                typeof rec.lastMessageBody === 'string' ? rec.lastMessageBody.slice(0, 240) : undefined,
              unreadCount: typeof rec.unreadCount === 'number' ? rec.unreadCount : 0,
              createdAt: now,
              updatedAt: now,
            });
            await remember('conversations', ghlId, id);
            imported++;
            break;
          }
          case 'messages': {
            const conversationId = await mappedId(
              ctx,
              job.subAccountId,
              'conversations',
              typeof rec.conversationId === 'string' ? rec.conversationId : undefined,
            );
            if (!conversationId) {
              skipped++;
              break;
            }
            if (dryRun) {
              imported++;
              break;
            }
            const conv = await ctx.db.get(conversationId as Id<'conversations'>);
            if (!conv) {
              skipped++;
              break;
            }
            const id = await ctx.db.insert('messages', {
              conversationId: conversationId as Id<'conversations'>,
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              direction: mapMessageDirection(
                typeof rec.direction === 'string' ? rec.direction : undefined,
              ),
              channel: conv.channel,
              bodyText: typeof rec.body === 'string' ? rec.body : undefined,
              status: mapInertMessageStatus(
                typeof rec.status === 'string' ? rec.status : undefined,
              ),
              externalId: `ghl:${ghlId}`,
              sentAt: parseEpoch(typeof rec.dateAdded === 'string' ? rec.dateAdded : undefined, now),
              createdAt: now,
              updatedAt: now,
            });
            await remember('messages', ghlId, id);
            imported++;
            break;
          }
          case 'lists': {
            const name = String(rec.name ?? '').trim();
            if (!name) {
              skipped++;
              break;
            }
            const existing = await ctx.db
              .query('emailCategories')
              .withIndex('by_subAccount', (q) => q.eq('subAccountId', job.subAccountId))
              .collect();
            const match = existing.find((l) => l.name.toLowerCase() === name.toLowerCase());
            if (match) {
              if (match.membershipMode !== 'manual') {
                await ctx.db.patch(match._id, { membershipMode: 'manual', updatedAt: now });
              }
              await remember('lists', ghlId, match._id);
              skipped++;
              break;
            }
            const id = await ctx.db.insert('emailCategories', {
              subAccountId: job.subAccountId,
              name,
              sortOrder: existing.length,
              membershipMode: 'manual',
              createdAt: now,
              updatedAt: now,
            });
            await remember('lists', ghlId, id);
            imported++;
            break;
          }
          case 'listMemberships': {
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            let listId = await mappedId(
              ctx,
              job.subAccountId,
              'lists',
              typeof rec.listId === 'string' ? rec.listId : undefined,
            );
            const listName = typeof rec.name === 'string' ? rec.name : '';
            if (!listId && listName) {
              const lists = await ctx.db
                .query('emailCategories')
                .withIndex('by_subAccount', (q) => q.eq('subAccountId', job.subAccountId))
                .collect();
              const match = lists.find((l) => l.name.toLowerCase() === listName.toLowerCase());
              listId = match?._id;
            }
            if (!contactId || !listId) {
              skipped++;
              break;
            }
            await addManualMember(
              ctx,
              listId as Id<'emailCategories'>,
              contactId as Id<'contacts'>,
              'import',
            );
            imported++;
            break;
          }
          case 'segments': {
            const name = String(rec.name ?? '').trim();
            if (!name) {
              skipped++;
              break;
            }
            const existing = await ctx.db
              .query('segments')
              .withIndex('by_subAccount', (q) => q.eq('subAccountId', job.subAccountId))
              .collect();
            const match = existing.find((s) => s.name.toLowerCase() === name.toLowerCase());
            if (match) {
              await remember('segments', ghlId, match._id);
              skipped++;
              break;
            }
            const id = await ctx.db.insert('segments', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name,
              description: 'Imported from a GoHighLevel tag. Rebuild the filter in Seedly.',
              filterCriteria: [{ field: 'tags', operator: 'contains', value: name }],
              contactCount: 0,
              createdAt: now,
              updatedAt: now,
            });
            await remember('segments', ghlId, id);
            imported++;
            break;
          }
          case 'forms': {
            const fields = Array.isArray(rec.fields) ? rec.fields : [];
            const schema = fields.map((f, i) => {
              const field = f as Record<string, unknown>;
              return {
                id: typeof field.id === 'string' ? field.id : `field_${i}`,
                type: typeof field.type === 'string' ? field.type : 'text',
                label: typeof field.name === 'string' ? field.name : `Field ${i + 1}`,
                required: field.required === true,
              };
            });
            const id = await ctx.db.insert('forms', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name: String(rec.name ?? 'Imported form'),
              schema,
              status: 'draft',
              submissionCount: 0,
              createdAt: now,
              updatedAt: now,
            });
            await remember('forms', ghlId, id);
            imported++;
            break;
          }
          case 'formSubmissions': {
            const formId = await mappedId(
              ctx,
              job.subAccountId,
              'forms',
              typeof rec.formId === 'string' ? rec.formId : undefined,
            );
            if (!formId) {
              skipped++;
              break;
            }
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            const id = await ctx.db.insert('formSubmissions', {
              formId: formId as Id<'forms'>,
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              contactId: contactId as Id<'contacts'> | undefined,
              data: rec.others ?? rec,
              submittedAt: parseEpoch(typeof rec.createdAt === 'string' ? rec.createdAt : undefined, now),
            });
            await remember('formSubmissions', ghlId, id);
            imported++;
            break;
          }
          case 'campaigns': {
            const id = await ctx.db.insert('campaigns', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name: String(rec.name ?? 'Imported campaign'),
              type: 'broadcast',
              status: 'sent',
              totalRecipients: 0,
              sentCount: 0,
              deliveredCount: 0,
              openCount: 0,
              clickCount: 0,
              bounceCount: 0,
              unsubscribeCount: 0,
              createdAt: now,
              updatedAt: now,
            });
            await remember('campaigns', ghlId, id);
            imported++;
            break;
          }
          case 'workflows': {
            const name = String(rec.name ?? 'Imported workflow');
            const id = await ctx.db.insert('workflows', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name,
              description:
                `Imported from GoHighLevel as a draft. Rebuild this automation in Seedly. GHL id: ${ghlId}.`,
              status: 'draft',
              dag: { nodes: [], edges: [] },
              allowReEntry: false,
              createdAt: now,
              updatedAt: now,
            });
            await remember('workflows', ghlId, id);
            imported++;
            break;
          }
          case 'products': {
            const prices = Array.isArray(rec.prices) ? rec.prices : [];
            const first = (prices[0] ?? {}) as Record<string, unknown>;
            const id = await ctx.db.insert('products', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              name: String(rec.name ?? 'Imported product'),
              description: typeof rec.description === 'string' ? rec.description : undefined,
              price: typeof first.amount === 'number' ? first.amount : 0,
              currency: typeof first.currency === 'string' ? first.currency : 'USD',
              isActive: rec.availableInStore !== false,
              createdAt: now,
              updatedAt: now,
            });
            await remember('products', ghlId, id);
            imported++;
            break;
          }
          case 'invoices':
          case 'estimates': {
            // Phase 1 does not mint Seedly invoice/estimate serials. Count only.
            if (dryRun) imported++;
            else skipped++;
            break;
          }
          case 'callLogs': {
            const contactId = await mappedId(
              ctx,
              job.subAccountId,
              'contacts',
              typeof rec.contactId === 'string' ? rec.contactId : undefined,
            );
            if (!contactId) {
              skipped++;
              break;
            }
            const id = await ctx.db.insert('callLogs', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              contactId: contactId as Id<'contacts'>,
              direction: rec.direction === 'inbound' ? 'inbound' : 'outbound',
              duration: typeof rec.duration === 'number' ? rec.duration : undefined,
              outcome: typeof rec.outcome === 'string' ? rec.outcome : 'answered',
              notes: 'Imported from GoHighLevel (metadata only)',
              calledAt: now,
              createdAt: now,
            });
            await remember('callLogs', ghlId, id);
            imported++;
            break;
          }
          case 'socialPosts': {
            const id = await ctx.db.insert('socialPosts', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              platform: 'facebook',
              content: typeof rec.message === 'string' ? rec.message : '',
              status: 'published',
              publishedAt: rec.publishedAt
                ? parseEpoch(String(rec.publishedAt), now)
                : undefined,
              createdAt: now,
              updatedAt: now,
            });
            await remember('socialPosts', ghlId, id);
            imported++;
            break;
          }
          case 'reviews': {
            const rating = typeof rec.rating === 'number' ? rec.rating : 0;
            const reviewDate =
              typeof rec.date === 'string' && rec.date.length > 0
                ? rec.date.slice(0, 10)
                : new Date(now).toISOString().slice(0, 10);
            const reply = typeof rec.reply === 'string' ? rec.reply : undefined;
            const id = await ctx.db.insert('reviews', {
              agencyId: job.agencyId,
              subAccountId: job.subAccountId,
              platform: typeof rec.platform === 'string' ? rec.platform : 'google',
              externalId: ghlId,
              reviewerName: typeof rec.reviewerName === 'string' ? rec.reviewerName : 'Reviewer',
              rating,
              content: typeof rec.content === 'string' ? rec.content : undefined,
              reviewDate,
              responseContent: reply,
              responseStatus: reply ? 'posted' : undefined,
              status: reply ? 'responded' : 'new',
              createdAt: now,
            });
            await remember('reviews', ghlId, id);
            imported++;
            break;
          }
          default:
            skipped++;
        }
      } catch (e) {
        errors.push(`${args.entity} ${ghlId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { imported, skipped, updated, rejected, errors };
  },
});

const ROLLBACK_TABLES: Record<string, string> = {
  contacts: 'contacts',
  companies: 'companies',
  tags: 'tags',
  customFields: 'contactCustomFields',
  contactNotes: 'contactNotes',
  tasks: 'pmTasks',
  pipelines: 'pipelines',
  pipelineStages: 'pipelineStages',
  deals: 'deals',
  calendars: 'calendars',
  appointments: 'appointments',
  conversations: 'conversations',
  messages: 'messages',
  lists: 'emailCategories',
  segments: 'segments',
  forms: 'forms',
  formSubmissions: 'formSubmissions',
  campaigns: 'campaigns',
  workflows: 'workflows',
  products: 'products',
  invoices: 'invoices',
  estimates: 'estimates',
  callLogs: 'callLogs',
  socialPosts: 'socialPosts',
  reviews: 'reviews',
};

export const rollbackBatch = internalMutation({
  args: {
    jobId: v.id('ghlImportJobs'),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mappings = await ctx.db
      .query('ghlIdMappings')
      .withIndex('by_job', (q) => q.eq('jobId', args.jobId))
      .take(ROLLBACK_BATCH);
    for (const row of mappings) {
      const table = ROLLBACK_TABLES[row.entityType];
      if (table) {
        try {
          await ctx.db.delete(row.seedlyId as Id<never>);
        } catch {
          // already gone
        }
      }
      await ctx.db.delete(row._id);
    }
    if (mappings.length === ROLLBACK_BATCH) {
      await ctx.scheduler.runAfter(0, rollbackBatchRef, {
        jobId: args.jobId,
        cursor: mappings[mappings.length - 1]?._id,
      });
    }
    return { deleted: mappings.length, more: mappings.length === ROLLBACK_BATCH };
  },
});

export const listMappedIds = internalQuery({
  args: {
    subAccountId: v.id('subAccounts'),
    entityType: v.string(),
    after: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('ghlIdMappings')
      .withIndex('by_subAccount_entity_ghlId', (q) =>
        q.eq('subAccountId', args.subAccountId).eq('entityType', args.entityType),
      )
      .take(args.limit + 200);
    const filtered = args.after ? rows.filter((r) => r.ghlId > args.after!) : rows;
    return filtered.slice(0, args.limit).map((r) => ({ ghlId: r.ghlId, seedlyId: r.seedlyId }));
  },
});

export const listMappedContactIds = internalQuery({
  args: { subAccountId: v.id('subAccounts'), after: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('ghlIdMappings')
      .withIndex('by_subAccount_entity_ghlId', (q) =>
        q.eq('subAccountId', args.subAccountId).eq('entityType', 'contacts'),
      )
      .take(args.limit + 200);
    const filtered = args.after ? rows.filter((r) => r.ghlId > args.after!) : rows;
    return filtered.slice(0, args.limit);
  },
});

void GHL_IMPORT_ORDER;
