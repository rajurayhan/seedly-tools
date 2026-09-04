'use node';

import { action, internalAction } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import { requireActionAuth } from '../_actionAuth';
import { internal } from '../_generated/api';
import { encrypt, decrypt } from '../lib/encryption';
import { GhlApiError, GhlClient } from '../../packages/ghl-import/src/client';
import { GHL_IMPORT_ORDER, type GhlEntityId } from '../../packages/ghl-import/src/entities';
import type { Id } from '../_generated/dataModel';

const BATCH = 25;

const saveConnectionRef = makeFunctionReference<'mutation'>('ghlImport/api:saveConnection');
const getConnectionRef = makeFunctionReference<'query'>('ghlImport/api:getConnection');
const getJobInternalRef = makeFunctionReference<'query'>('ghlImport/internal:getJobInternal');
const getConnectionInternalRef = makeFunctionReference<'query'>(
  'ghlImport/internal:getConnectionInternal',
);
const importBatchRef = makeFunctionReference<'mutation'>('ghlImport/internal:importBatch');
const patchJobRef = makeFunctionReference<'mutation'>('ghlImport/internal:patchJob');
const markJobFailedRef = makeFunctionReference<'mutation'>('ghlImport/internal:markJobFailed');
const listMappedContactIdsRef = makeFunctionReference<'query'>(
  'ghlImport/internal:listMappedContactIds',
);
const listMappedIdsRef = makeFunctionReference<'query'>('ghlImport/internal:listMappedIds');
const processImportBatchRef = makeFunctionReference<'action'>('actions/ghl:processImportBatch');
const processDryRunBatchRef = makeFunctionReference<'action'>('actions/ghl:processDryRunBatch');

export const validateToken = action({
  args: {
    token: v.string(),
    locationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireActionAuth(ctx, { permission: { module: 'ghl_import', action: 'update' } });
    const token = args.token.trim();
    if (token.length < 10) throw new ConvexError('Paste a Private Integration Token');
    const client = new GhlClient({ token, locationId: args.locationId });
    try {
      return await client.validate(args.locationId);
    } catch (e) {
      if (e instanceof GhlApiError) {
        throw new ConvexError(`GoHighLevel rejected the token: ${e.message}`);
      }
      throw e;
    }
  },
});

export const connect = action({
  args: {
    token: v.string(),
    locationId: v.string(),
    locationName: v.optional(v.string()),
    tokenKind: v.union(v.literal('location'), v.literal('agency')),
  },
  handler: async (ctx, args) => {
    const auth = await requireActionAuth(ctx, {
      permission: { module: 'ghl_import', action: 'update' },
    });
    const requires2fa = await ctx.runQuery(internal._helpers.requiresTwoFactor, {
      userId: auth.userId,
    });
    if (requires2fa) {
      throw new ConvexError(
        'Two-factor authentication is required for this operation. Enable 2FA in your account settings before connecting GoHighLevel.',
      );
    }
    const token = args.token.trim();
    const locationId = args.locationId.trim();
    if (!locationId) throw new ConvexError('Choose a GoHighLevel location');
    const client = new GhlClient({ token, locationId });
    let name = args.locationName;
    try {
      const loc = await client.getLocation(locationId);
      name = loc.name;
    } catch {
      // keep provided name
    }
    const encryptedToken = encrypt(token);
    return await ctx.runMutation(saveConnectionRef, {
      encryptedToken,
      tokenKind: args.tokenKind,
      ghlLocationId: locationId,
      ghlLocationName: name,
    });
  },
});

export const preflight = action({
  args: {},
  handler: async (ctx) => {
    const auth = await requireActionAuth(ctx, {
      permission: { module: 'ghl_import', action: 'read' },
    });
    if (!auth.subAccountId) throw new ConvexError('Select a location first');
    const connection = await ctx.runQuery(getConnectionRef, {});
    if (!connection) throw new ConvexError('Connect GoHighLevel first');
    const stored = await ctx.runQuery(getConnectionInternalRef, {
      connectionId: connection._id,
    });
    if (!stored?.encryptedToken) throw new ConvexError('Reconnect GoHighLevel — the token is missing');
    const client = new GhlClient({
      token: decrypt(stored.encryptedToken),
      locationId: stored.ghlLocationId,
    });
    const counts: Record<string, number | string> = {};
    const missing: string[] = [];

    async function tryCount(entity: string, fn: () => Promise<number>) {
      try {
        counts[entity] = await fn();
      } catch (e) {
        missing.push(entity);
        counts[entity] = e instanceof GhlApiError ? `missing scope (${e.status})` : 'error';
      }
    }

    await tryCount('users', async () => (await client.listUsers()).length);
    await tryCount('tags', async () => (await client.listTags()).length);
    await tryCount('customFields', async () => (await client.listCustomFields()).length);
    await tryCount('companies', async () => (await client.listBusinesses()).length);
    await tryCount('pipelines', async () => (await client.listPipelines()).length);
    await tryCount('calendars', async () => (await client.listCalendars()).length);
    await tryCount('forms', async () => (await client.listForms()).length);
    await tryCount('campaigns', async () => (await client.listCampaigns()).length);
    await tryCount('workflows', async () => (await client.listWorkflows()).length);
    await tryCount('products', async () => (await client.listProducts()).length);
    await tryCount('invoices', async () => (await client.listInvoices()).length);
    await tryCount('estimates', async () => (await client.listEstimates()).length);
    await tryCount('contacts', async () => {
      const page = await client.searchContacts({ limit: 1 });
      return page.contacts.length > 0 ? -1 : 0;
    });
    await tryCount('tasks', async () => (await client.listTasks()).length);
    await tryCount('reviews', async () => (await client.listReviews()).length);
    return { counts, missing, locationName: stored.ghlLocationName };
  },
});

export const processImportBatch = internalAction({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(getJobInternalRef, { jobId: args.jobId });
    if (!job || job.status !== 'running') return;
    const connection = await ctx.runQuery(getConnectionInternalRef, {
      connectionId: job.connectionId,
    });
    if (!connection?.encryptedToken) {
      await ctx.runMutation(markJobFailedRef, {
        jobId: job._id,
        error: 'GHL connection is missing or disconnected',
      });
      return;
    }

    const selectedEntities = job.selectedEntities as string[];
    const selected = selectedEntities.filter((id: string): id is GhlEntityId =>
      (GHL_IMPORT_ORDER as readonly string[]).includes(id),
    );
    let entityIndex = job.entityIndex;
    if (entityIndex >= selected.length) {
      await ctx.runMutation(patchJobRef, {
        jobId: job._id,
        completed: true,
      });
      return;
    }
    const entity = selected[entityIndex]!;
    const client = new GhlClient({
      token: decrypt(connection.encryptedToken),
      locationId: connection.ghlLocationId,
    });

    try {
      const { records, nextCursor, done } = await fetchEntityPage(
        client,
        entity,
        job.cursor,
        ctx as BatchQueryCtx,
        job.subAccountId,
      );
      const result = await ctx.runMutation(importBatchRef, {
        jobId: job._id,
        entity,
        records,
        dryRun: false,
      });
      for (const err of result.errors) {
        await ctx.runMutation(patchJobRef, {
          jobId: job._id,
          error: err,
        });
      }

      if (done) {
        entityIndex += 1;
        const nextEntity = selected[entityIndex];
        await ctx.runMutation(patchJobRef, {
          jobId: job._id,
          currentEntity: nextEntity,
          cursor: null,
          entityIndex,
          processedDelta: records.length,
          importedDelta: result.imported,
          skippedDelta: result.skipped,
          updatedDelta: result.updated,
          rejectedDelta: result.rejected,
          completed: entityIndex >= selected.length,
        });
      } else {
        await ctx.runMutation(patchJobRef, {
          jobId: job._id,
          currentEntity: entity,
          cursor: nextCursor,
          entityIndex,
          processedDelta: records.length,
          importedDelta: result.imported,
          skippedDelta: result.skipped,
          updatedDelta: result.updated,
          rejectedDelta: result.rejected,
        });
      }

      if (entityIndex < selected.length) {
        await ctx.scheduler.runAfter(0, processImportBatchRef, { jobId: job._id });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(markJobFailedRef, {
        jobId: job._id,
        error: `${entity}: ${message}`,
      });
    }
  },
});

export const processDryRunBatch = internalAction({
  args: { jobId: v.id('ghlImportJobs') },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(getJobInternalRef, { jobId: args.jobId });
    if (!job || job.status !== 'reviewing') return;
    const connection = await ctx.runQuery(getConnectionInternalRef, {
      connectionId: job.connectionId,
    });
    if (!connection?.encryptedToken) {
      await ctx.runMutation(markJobFailedRef, {
        jobId: job._id,
        error: 'GHL connection is missing or disconnected',
      });
      return;
    }

    const selectedEntities = job.selectedEntities as string[];
    const selected = selectedEntities.filter((id: string): id is GhlEntityId =>
      (GHL_IMPORT_ORDER as readonly string[]).includes(id),
    );
    let entityIndex = job.entityIndex;
    if (entityIndex >= selected.length) {
      await ctx.runMutation(patchJobRef, {
        jobId: job._id,
        completed: true,
        planSummary: {
          create: job.imported,
          link: job.skipped,
          update: job.updated,
          reject: job.rejected ?? 0,
          blockers: job.rejected ?? 0,
        },
      });
      return;
    }
    const entity = selected[entityIndex]!;
    const client = new GhlClient({
      token: decrypt(connection.encryptedToken),
      locationId: connection.ghlLocationId,
    });

    try {
      const { records, nextCursor, done } = await fetchEntityPage(
        client,
        entity,
        job.cursor,
        ctx as BatchQueryCtx,
        job.subAccountId,
      );
      const result = await ctx.runMutation(importBatchRef, {
        jobId: job._id,
        entity,
        records,
        dryRun: true,
      });
      for (const err of result.errors) {
        await ctx.runMutation(patchJobRef, {
          jobId: job._id,
          error: err,
        });
      }

      if (done) {
        entityIndex += 1;
        const nextEntity = selected[entityIndex];
        const imported = job.imported + result.imported;
        const skipped = job.skipped + result.skipped;
        const updated = job.updated + result.updated;
        const rejected = (job.rejected ?? 0) + result.rejected;
        await ctx.runMutation(patchJobRef, {
          jobId: job._id,
          currentEntity: nextEntity,
          cursor: null,
          entityIndex,
          processedDelta: records.length,
          importedDelta: result.imported,
          skippedDelta: result.skipped,
          updatedDelta: result.updated,
          rejectedDelta: result.rejected,
          completed: entityIndex >= selected.length,
          planSummary: {
            create: imported,
            link: skipped,
            update: updated,
            reject: rejected,
            blockers: rejected,
          },
        });
      } else {
        await ctx.runMutation(patchJobRef, {
          jobId: job._id,
          currentEntity: entity,
          cursor: nextCursor,
          entityIndex,
          processedDelta: records.length,
          importedDelta: result.imported,
          skippedDelta: result.skipped,
          updatedDelta: result.updated,
          rejectedDelta: result.rejected,
        });
      }

      if (entityIndex < selected.length) {
        await ctx.scheduler.runAfter(0, processDryRunBatchRef, { jobId: job._id });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(markJobFailedRef, {
        jobId: job._id,
        error: `${entity}: ${message}`,
      });
    }
  },
});

type MappedRow = { ghlId: string };

type BatchQueryCtx = {
  // Convex ActionCtx.runQuery is generic; keep this wrapper loose so the
  // batch runner can pass the live action ctx without a generated api type.
  runQuery: (ref: unknown, args?: unknown) => Promise<unknown>;
};

async function fetchEntityPage(
  client: GhlClient,
  entity: GhlEntityId,
  cursor: string | undefined,
  ctx: BatchQueryCtx,
  subAccountId: Id<'subAccounts'>,
): Promise<{ records: Record<string, unknown>[]; nextCursor?: string; done: boolean }> {
  switch (entity) {
    case 'users': {
      const offset = cursor ? Number(String(cursor).split(':')[0]) : 0;
      const prevFirst = cursor?.includes(':') ? cursor.slice(cursor.indexOf(':') + 1) : undefined;
      const page = await client.searchUsers({ offset, limit: BATCH });
      const firstId = typeof page.users[0]?.id === 'string' ? page.users[0].id : undefined;
      if (offset > 0 && firstId && prevFirst && firstId === prevFirst) {
        return { records: [], done: true };
      }
      return {
        records: page.users as unknown as Record<string, unknown>[],
        nextCursor: page.next ? `${page.next}:${firstId ?? ''}` : undefined,
        done: page.next === undefined,
      };
    }
    case 'tags':
      return { records: (await client.listTags()) as unknown as Record<string, unknown>[], done: true };
    case 'customFields':
      return {
        records: (await client.listCustomFields()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'companies':
      return {
        records: (await client.listBusinesses()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'contacts': {
      const page = await client.searchContacts({ after: cursor, limit: BATCH });
      return {
        records: page.contacts as unknown as Record<string, unknown>[],
        nextCursor: page.next,
        done: page.contacts.length < BATCH,
      };
    }
    case 'tasks':
      return { records: (await client.listTasks()) as unknown as Record<string, unknown>[], done: true };
    case 'contactNotes': {
      const mapped = (await ctx.runQuery(listMappedContactIdsRef, {
        subAccountId,
        after: cursor,
        limit: 5,
      })) as MappedRow[];
      const records: Record<string, unknown>[] = [];
      for (const row of mapped) {
        const notes = await client.listContactNotes(row.ghlId);
        for (const note of notes) {
          records.push({ ...note, contactId: row.ghlId });
        }
      }
      const last = mapped[mapped.length - 1];
      return { records, nextCursor: last?.ghlId, done: mapped.length < 5 };
    }
    case 'pipelines':
      return {
        records: (await client.listPipelines()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'deals': {
      const page = await client.searchOpportunities({ after: cursor });
      return {
        records: page.opportunities as unknown as Record<string, unknown>[],
        nextCursor: page.next,
        done: page.opportunities.length < BATCH,
      };
    }
    case 'calendars':
      return {
        records: (await client.listCalendars()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'appointments': {
      const start = cursor ? Number(cursor) : Date.now() - 365 * 24 * 60 * 60 * 1000;
      const end = start + 30 * 24 * 60 * 60 * 1000;
      const events = await client.listAppointments(start, end);
      const horizon = Date.now() + 180 * 24 * 60 * 60 * 1000;
      return {
        records: events as unknown as Record<string, unknown>[],
        nextCursor: String(end),
        done: end >= horizon,
      };
    }
    case 'conversations': {
      const page = await client.searchConversations({ startAfterDate: cursor });
      return {
        records: page.conversations as unknown as Record<string, unknown>[],
        nextCursor: page.next,
        done: page.conversations.length === 0,
      };
    }
    case 'messages': {
      const mapped = (await ctx.runQuery(listMappedIdsRef, {
        subAccountId,
        entityType: 'conversations',
        after: cursor,
        limit: 3,
      })) as MappedRow[];
      const records: Record<string, unknown>[] = [];
      for (const row of mapped) {
        const messages = await client.listMessages(row.ghlId);
        records.push(...(messages as unknown as Record<string, unknown>[]));
      }
      const last = mapped[mapped.length - 1];
      return { records, nextCursor: last?.ghlId, done: mapped.length < 3 };
    }
    case 'lists':
    case 'segments': {
      const tags = await client.listTags();
      return { records: tags as unknown as Record<string, unknown>[], done: true };
    }
    case 'listMemberships': {
      const page = await client.searchContacts({ after: cursor, limit: BATCH });
      const records: Record<string, unknown>[] = [];
      for (const c of page.contacts) {
        for (const tag of c.tags ?? []) {
          records.push({ id: `${c.id}:${tag}`, contactId: c.id, listId: tag, name: tag });
        }
      }
      return {
        records,
        nextCursor: page.next,
        done: page.contacts.length < BATCH,
      };
    }
    case 'forms':
      return { records: (await client.listForms()) as unknown as Record<string, unknown>[], done: true };
    case 'formSubmissions':
      return {
        records: (await client.listFormSubmissions()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'campaigns':
      return {
        records: (await client.listCampaigns()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'workflows':
      return {
        records: (await client.listWorkflows()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'products':
      return {
        records: (await client.listProducts()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'invoices':
      return {
        records: (await client.listInvoices()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'estimates':
      return {
        records: (await client.listEstimates()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'callLogs': {
      const page = await client.searchConversations({ startAfterDate: cursor });
      const calls = page.conversations.filter((c) => (c.type ?? '').toLowerCase().includes('call'));
      return {
        records: calls.map((c) => ({
          id: c.id,
          contactId: c.contactId,
          direction: 'inbound',
          outcome: 'answered',
        })),
        nextCursor: page.next,
        done: page.conversations.length === 0,
      };
    }
    case 'socialPosts':
      return {
        records: (await client.listSocialPosts()) as unknown as Record<string, unknown>[],
        done: true,
      };
    case 'reviews':
      return {
        records: (await client.listReviews()) as unknown as Record<string, unknown>[],
        done: true,
      };
    default:
      return { records: [], done: true };
  }
}
