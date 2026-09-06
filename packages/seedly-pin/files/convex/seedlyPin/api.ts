import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from '../_generated/server';
import { getAuthContext, requireSubAccount } from '../_helpers';
import {
  DISABLED_MESSAGE,
  DROP_FORBIDDEN_MESSAGE,
  PIN_PRIORITIES,
  PIN_STATUSES,
  TRIAGE_FORBIDDEN_MESSAGE,
  canDrop,
  canTriage,
  exportDiagnostics,
  historyEntry,
  isValidPriority,
  isValidStatus,
  normalizeSettings,
  sanitizeMetadata,
} from '../../packages/seedly-pin/src/gates.mjs';

const pinId = v.id('seedlyPins');

async function agencySettings(ctx: { db: { get: Function } }, agencyId: string) {
  const agency = await ctx.db.get(agencyId);
  const settings = agency?.settings && typeof agency.settings === 'object' ? agency.settings : {};
  return normalizeSettings(settings.seedlyPin);
}

async function requireAuth(ctx: { auth: { getUserIdentity: Function } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Not authenticated');
  return getAuthContext(ctx);
}

function assertDrop(settings: ReturnType<typeof normalizeSettings>, roleSlug: string) {
  if (!settings.enabled) throw new ConvexError(DISABLED_MESSAGE);
  if (!canDrop(settings, roleSlug)) throw new ConvexError(DROP_FORBIDDEN_MESSAGE);
}

function assertTriage(settings: ReturnType<typeof normalizeSettings>, roleSlug: string) {
  if (!settings.enabled) throw new ConvexError(DISABLED_MESSAGE);
  if (!canTriage(settings, roleSlug)) throw new ConvexError(TRIAGE_FORBIDDEN_MESSAGE);
}

async function writeHistory(
  ctx: { db: { insert: Function } },
  args: {
    pinId: string;
    agencyId: string;
    userId?: string;
    action: string;
    oldValue?: string;
    newValue?: string;
  },
) {
  const entry = historyEntry(args);
  if (!entry) return;
  await ctx.db.insert('seedlyPinHistory', {
    pinId: args.pinId,
    agencyId: args.agencyId,
    userId: args.userId,
    action: entry.action,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    createdAt: Date.now(),
  });
}

async function pinInScope(
  ctx: { db: { get: Function } },
  pinIdValue: string,
  agencyId: string,
  subAccountId?: string,
) {
  const pin = await ctx.db.get(pinIdValue);
  if (!pin || String(pin.agencyId) !== String(agencyId)) return null;
  if (subAccountId && String(pin.subAccountId) !== String(subAccountId)) return null;
  return pin;
}

async function publicUser(ctx: { db: { get: Function } }, userId?: string) {
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return {
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
  };
}

async function filesForPin(ctx: { db: { query: Function }; storage: { getUrl: Function } }, pinIdValue: string) {
  const rows = await ctx.db
    .query('seedlyPinFiles')
    .withIndex('by_pin', (q: { eq: Function }) => q.eq('pinId', pinIdValue))
    .collect();
  const out = [];
  for (const row of rows) {
    out.push({
      _id: row._id,
      type: row.type,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
      url: await ctx.storage.getUrl(row.storageId),
      createdAt: row.createdAt,
    });
  }
  return out;
}

export const getAvailability = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { enabled: false, canDrop: false, canTriage: false, canConfigure: false };
    const auth = await getAuthContext(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    const locationId = auth.subAccountId ?? auth.activeSubAccountId;
    return {
      enabled: settings.enabled,
      canDrop: canDrop(settings, auth.roleSlug) && Boolean(locationId),
      canTriage: canTriage(settings, auth.roleSlug),
      canConfigure: auth.roleSlug === 'agency_owner',
      locationId: locationId ?? null,
      settings,
      roleSlug: auth.roleSlug,
    };
  },
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const auth = await getAuthContext(ctx);
    if (auth.roleSlug !== 'agency_owner') return null;
    return agencySettings(ctx, auth.agencyId);
  },
});

export const updateSettings = mutation({
  args: {
    enabled: v.boolean(),
    dropRoles: v.array(v.string()),
    triageRoles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (auth.roleSlug !== 'agency_owner') {
      throw new ConvexError('Only an agency owner can change SeedlyPin settings.');
    }
    const agency = await ctx.db.get(auth.agencyId);
    if (!agency) throw new ConvexError('Agency not found');
    const current = agency.settings && typeof agency.settings === 'object' ? { ...agency.settings } : {};
    const next = normalizeSettings({
      enabled: args.enabled,
      dropRoles: args.dropRoles,
      triageRoles: args.triageRoles,
    });
    current.seedlyPin = next;
    await ctx.db.patch(auth.agencyId, { settings: current });
    return next;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    assertDrop(settings, auth.roleSlug);
    requireSubAccount(auth);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createPin = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.string()),
    source: v.optional(v.union(v.literal('capture'), v.literal('manual'))),
    metadata: v.optional(v.any()),
    annotations: v.optional(v.any()),
    files: v.optional(
      v.array(
        v.object({
          storageId: v.id('_storage'),
          type: v.union(v.literal('screenshot'), v.literal('video'), v.literal('attachment')),
          filename: v.string(),
          mimeType: v.string(),
          sizeBytes: v.number(),
          width: v.optional(v.number()),
          height: v.optional(v.number()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    assertDrop(settings, auth.roleSlug);
    const subAccountId = requireSubAccount(auth);
    const title = args.title.trim();
    if (title.length < 4) throw new ConvexError('Title must be at least 4 characters.');
    const priority = isValidPriority(args.priority) ? args.priority : 'medium';
    const now = Date.now();
    const pinIdValue = await ctx.db.insert('seedlyPins', {
      agencyId: auth.agencyId,
      subAccountId,
      createdBy: auth.userId,
      title,
      description: args.description?.trim() || undefined,
      status: 'open',
      priority,
      source: args.source ?? 'capture',
      annotations: args.annotations,
      metadata: sanitizeMetadata(args.metadata),
      createdAt: now,
      updatedAt: now,
    });
    for (const file of args.files ?? []) {
      await ctx.db.insert('seedlyPinFiles', {
        pinId: pinIdValue,
        agencyId: auth.agencyId,
        type: file.type,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        storageId: file.storageId,
        width: file.width,
        height: file.height,
        createdAt: now,
      });
    }
    await writeHistory(ctx, {
      pinId: pinIdValue,
      agencyId: auth.agencyId,
      userId: auth.userId,
      action: 'created',
      newValue: title,
    });
    return pinIdValue;
  },
});

export const listPins = query({
  args: {
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const auth = await getAuthContext(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    if (!canTriage(settings, auth.roleSlug)) return [];
    const subAccountId = requireSubAccount(auth);
    let rows = await ctx.db
      .query('seedlyPins')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .collect();
    if (args.status && isValidStatus(args.status)) {
      rows = rows.filter((row) => row.status === args.status);
    }
    if (args.priority && isValidPriority(args.priority)) {
      rows = rows.filter((row) => row.priority === args.priority);
    }
    const q = args.search?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (row) =>
          row.title.toLowerCase().includes(q) ||
          (row.description ?? '').toLowerCase().includes(q) ||
          String(row.metadata?.url ?? '').toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const row of rows.slice(0, 200)) {
      out.push({
        ...row,
        reporter: await publicUser(ctx, row.createdBy),
        assignee: await publicUser(ctx, row.assignedTo),
      });
    }
    return out;
  },
});

export const getPin = query({
  args: { pinId },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const auth = await getAuthContext(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    if (!canTriage(settings, auth.roleSlug) && !canDrop(settings, auth.roleSlug)) return null;
    const pin = await pinInScope(ctx, args.pinId, auth.agencyId, auth.subAccountId ?? auth.activeSubAccountId);
    if (!pin) return null;
    const notes = await ctx.db
      .query('seedlyPinNotes')
      .withIndex('by_pin', (q) => q.eq('pinId', args.pinId))
      .collect();
    const history = await ctx.db
      .query('seedlyPinHistory')
      .withIndex('by_pin', (q) => q.eq('pinId', args.pinId))
      .collect();
    const noteUsers = [];
    for (const note of notes.sort((a, b) => a.createdAt - b.createdAt)) {
      noteUsers.push({ ...note, user: await publicUser(ctx, note.userId) });
    }
    return {
      ...pin,
      reporter: await publicUser(ctx, pin.createdBy),
      assignee: await publicUser(ctx, pin.assignedTo),
      files: await filesForPin(ctx, args.pinId),
      notes: noteUsers,
      history: history.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

export const updatePin = mutation({
  args: {
    pinId,
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedTo: v.optional(v.union(v.id('users'), v.null())),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    assertTriage(settings, auth.roleSlug);
    const pin = await pinInScope(ctx, args.pinId, auth.agencyId, auth.subAccountId ?? auth.activeSubAccountId);
    if (!pin) throw new ConvexError('Pin not found');
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title != null) {
      const title = args.title.trim();
      if (title.length < 4) throw new ConvexError('Title must be at least 4 characters.');
      if (title !== pin.title) {
        patch.title = title;
        await writeHistory(ctx, {
          pinId: args.pinId,
          agencyId: auth.agencyId,
          userId: auth.userId,
          action: 'description_changed',
          oldValue: pin.title,
          newValue: title,
        });
      }
    }
    if (args.description !== undefined && args.description !== pin.description) {
      patch.description = args.description?.trim() || undefined;
      await writeHistory(ctx, {
        pinId: args.pinId,
        agencyId: auth.agencyId,
        userId: auth.userId,
        action: 'description_changed',
        oldValue: pin.description,
        newValue: args.description,
      });
    }
    if (args.status != null) {
      if (!isValidStatus(args.status)) throw new ConvexError('Invalid status');
      if (args.status !== pin.status) {
        patch.status = args.status;
        if (args.status === 'resolved') {
          patch.resolvedAt = Date.now();
          patch.resolvedBy = auth.userId;
        }
        if (args.status === 'closed') patch.closedAt = Date.now();
        await writeHistory(ctx, {
          pinId: args.pinId,
          agencyId: auth.agencyId,
          userId: auth.userId,
          action: 'status_changed',
          oldValue: pin.status,
          newValue: args.status,
        });
      }
    }
    if (args.priority != null) {
      if (!isValidPriority(args.priority)) throw new ConvexError('Invalid priority');
      if (args.priority !== pin.priority) {
        patch.priority = args.priority;
        await writeHistory(ctx, {
          pinId: args.pinId,
          agencyId: auth.agencyId,
          userId: auth.userId,
          action: 'priority_changed',
          oldValue: pin.priority,
          newValue: args.priority,
        });
      }
    }
    if (args.assignedTo !== undefined) {
      const next = args.assignedTo ?? undefined;
      if (String(next ?? '') !== String(pin.assignedTo ?? '')) {
        patch.assignedTo = next;
        await writeHistory(ctx, {
          pinId: args.pinId,
          agencyId: auth.agencyId,
          userId: auth.userId,
          action: 'assignee_changed',
          oldValue: pin.assignedTo,
          newValue: next,
        });
      }
    }
    await ctx.db.patch(args.pinId, patch);
    return args.pinId;
  },
});

export const addNote = mutation({
  args: { pinId, message: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    assertTriage(settings, auth.roleSlug);
    const pin = await pinInScope(ctx, args.pinId, auth.agencyId, auth.subAccountId ?? auth.activeSubAccountId);
    if (!pin) throw new ConvexError('Pin not found');
    const message = args.message.trim();
    if (!message) throw new ConvexError('Note cannot be empty');
    const noteId = await ctx.db.insert('seedlyPinNotes', {
      pinId: args.pinId,
      agencyId: auth.agencyId,
      userId: auth.userId,
      message,
      createdAt: Date.now(),
    });
    await writeHistory(ctx, {
      pinId: args.pinId,
      agencyId: auth.agencyId,
      userId: auth.userId,
      action: 'note_added',
      newValue: message.slice(0, 80),
    });
    return noteId;
  },
});

export const listAssignableUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const auth = await getAuthContext(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    if (!canTriage(settings, auth.roleSlug)) return [];
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_agency', (q) => q.eq('agencyId', auth.agencyId))
      .collect();
    const seen = new Set<string>();
    const users = [];
    for (const membership of memberships) {
      if (!membership.isActive || seen.has(String(membership.userId))) continue;
      seen.add(String(membership.userId));
      const user = await publicUser(ctx, membership.userId);
      if (user) users.push(user);
    }
    return users;
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { byStatus: {}, byPriority: {}, total: 0 };
    const auth = await getAuthContext(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    if (!canTriage(settings, auth.roleSlug)) return { byStatus: {}, byPriority: {}, total: 0 };
    const subAccountId = requireSubAccount(auth);
    const rows = await ctx.db
      .query('seedlyPins')
      .withIndex('by_subAccount', (q) => q.eq('subAccountId', subAccountId))
      .collect();
    const byStatus: Record<string, number> = Object.fromEntries(PIN_STATUSES.map((s) => [s, 0]));
    const byPriority: Record<string, number> = Object.fromEntries(PIN_PRIORITIES.map((s) => [s, 0]));
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      byPriority[row.priority] = (byPriority[row.priority] ?? 0) + 1;
    }
    return { byStatus, byPriority, total: rows.length };
  },
});

export const exportPin = query({
  args: { pinId, format: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const auth = await getAuthContext(ctx);
    const settings = await agencySettings(ctx, auth.agencyId);
    if (!canTriage(settings, auth.roleSlug)) return null;
    const pin = await pinInScope(ctx, args.pinId, auth.agencyId, auth.subAccountId ?? auth.activeSubAccountId);
    if (!pin) return null;
    const files = await filesForPin(ctx, args.pinId);
    return exportDiagnostics(pin, { format: args.format ?? 'aiPrompt', files });
  },
});
