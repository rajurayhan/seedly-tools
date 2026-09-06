import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import {
  DISABLED_MESSAGE,
  exportDiagnostics,
  historyEntry,
  isValidPriority,
  isValidStatus,
  normalizeSettings,
  sanitizeMetadata,
} from '../../packages/seedly-pin/src/gates.mjs';

async function loadSettings(ctx: { db: { get: Function } }, agencyId: string) {
  const agency = await ctx.db.get(agencyId);
  const settings = agency?.settings && typeof agency.settings === 'object' ? agency.settings : {};
  return normalizeSettings(settings.seedlyPin);
}

function disabled() {
  return { ok: false as const, status: 403, code: 'FEATURE_DISABLED', message: DISABLED_MESSAGE };
}

async function publicUser(ctx: { db: { get: Function } }, userId?: string) {
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
  };
}

async function filesForPin(ctx: { db: { query: Function }; storage: { getUrl: Function } }, pinId: string) {
  const rows = await ctx.db
    .query('seedlyPinFiles')
    .withIndex('by_pin', (q: { eq: Function }) => q.eq('pinId', pinId))
    .collect();
  const out = [];
  for (const row of rows) {
    out.push({
      id: row._id,
      type: row.type,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      url: await ctx.storage.getUrl(row.storageId),
      createdAt: row.createdAt,
    });
  }
  return out;
}

async function loadPin(ctx: { db: { get: Function } }, pinId: string, agencyId: string, subAccountId?: string) {
  const pin = await ctx.db.get(pinId);
  if (!pin || String(pin.agencyId) !== String(agencyId)) return null;
  if (subAccountId && String(pin.subAccountId) !== String(subAccountId)) return null;
  return pin;
}

export const restListPins = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    let rows = args.subAccountId
      ? await ctx.db
          .query('seedlyPins')
          .withIndex('by_subAccount', (q) => q.eq('subAccountId', args.subAccountId))
          .collect()
      : await ctx.db
          .query('seedlyPins')
          .withIndex('by_agency', (q) => q.eq('agencyId', args.agencyId))
          .collect();
    if (args.status && isValidStatus(args.status)) rows = rows.filter((row) => row.status === args.status);
    if (args.priority && isValidPriority(args.priority)) {
      rows = rows.filter((row) => row.priority === args.priority);
    }
    const q = args.search?.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => row.title.toLowerCase().includes(q));
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const data = [];
    for (const row of rows.slice(0, 200)) {
      data.push({
        id: row._id,
        title: row.title,
        description: row.description ?? null,
        status: row.status,
        priority: row.priority,
        locationId: row.subAccountId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        reporter: await publicUser(ctx, row.createdBy),
        assignee: await publicUser(ctx, row.assignedTo),
      });
    }
    return { ok: true as const, data };
  },
});

export const restGetPin = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    pinId: v.id('seedlyPins'),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const pin = await loadPin(ctx, args.pinId, args.agencyId, args.subAccountId);
    if (!pin) return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Pin not found' };
    const notes = await ctx.db
      .query('seedlyPinNotes')
      .withIndex('by_pin', (q) => q.eq('pinId', args.pinId))
      .collect();
    const history = await ctx.db
      .query('seedlyPinHistory')
      .withIndex('by_pin', (q) => q.eq('pinId', args.pinId))
      .collect();
    const noteRows = [];
    for (const note of notes.sort((a, b) => a.createdAt - b.createdAt)) {
      noteRows.push({
        id: note._id,
        message: note.message,
        createdAt: note.createdAt,
        user: await publicUser(ctx, note.userId),
      });
    }
    return {
      ok: true as const,
      data: {
        id: pin._id,
        title: pin.title,
        description: pin.description ?? null,
        status: pin.status,
        priority: pin.priority,
        source: pin.source,
        metadata: pin.metadata,
        annotations: pin.annotations ?? null,
        locationId: pin.subAccountId,
        createdAt: pin.createdAt,
        updatedAt: pin.updatedAt,
        reporter: await publicUser(ctx, pin.createdBy),
        assignee: await publicUser(ctx, pin.assignedTo),
        files: await filesForPin(ctx, args.pinId),
        notes: noteRows,
        history: history
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((row) => ({
            id: row._id,
            action: row.action,
            oldValue: row.oldValue ?? null,
            newValue: row.newValue ?? null,
            createdAt: row.createdAt,
          })),
      },
    };
  },
});

export const restListFiles = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    pinId: v.id('seedlyPins'),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const pin = await loadPin(ctx, args.pinId, args.agencyId, args.subAccountId);
    if (!pin) return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Pin not found' };
    return { ok: true as const, data: await filesForPin(ctx, args.pinId) };
  },
});

export const restListNotes = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    pinId: v.id('seedlyPins'),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const pin = await loadPin(ctx, args.pinId, args.agencyId, args.subAccountId);
    if (!pin) return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Pin not found' };
    const notes = await ctx.db
      .query('seedlyPinNotes')
      .withIndex('by_pin', (q) => q.eq('pinId', args.pinId))
      .collect();
    const data = [];
    for (const note of notes.sort((a, b) => a.createdAt - b.createdAt)) {
      data.push({
        id: note._id,
        message: note.message,
        createdAt: note.createdAt,
        user: await publicUser(ctx, note.userId),
      });
    }
    return { ok: true as const, data };
  },
});

export const restListHistory = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    pinId: v.id('seedlyPins'),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const pin = await loadPin(ctx, args.pinId, args.agencyId, args.subAccountId);
    if (!pin) return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Pin not found' };
    const history = await ctx.db
      .query('seedlyPinHistory')
      .withIndex('by_pin', (q) => q.eq('pinId', args.pinId))
      .collect();
    return {
      ok: true as const,
      data: history.sort((a, b) => a.createdAt - b.createdAt).map((row) => ({
        id: row._id,
        action: row.action,
        oldValue: row.oldValue ?? null,
        newValue: row.newValue ?? null,
        createdAt: row.createdAt,
      })),
    };
  },
});

export const restExport = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    pinId: v.id('seedlyPins'),
    format: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const pin = await loadPin(ctx, args.pinId, args.agencyId, args.subAccountId);
    if (!pin) return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Pin not found' };
    const files = await filesForPin(ctx, args.pinId);
    return { ok: true as const, data: exportDiagnostics(pin, { format: args.format ?? 'aiPrompt', files }) };
  },
});

export const restStats = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const rows = args.subAccountId
      ? await ctx.db
          .query('seedlyPins')
          .withIndex('by_subAccount', (q) => q.eq('subAccountId', args.subAccountId))
          .collect()
      : await ctx.db
          .query('seedlyPins')
          .withIndex('by_agency', (q) => q.eq('agencyId', args.agencyId))
          .collect();
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      byPriority[row.priority] = (byPriority[row.priority] ?? 0) + 1;
    }
    return { ok: true as const, data: { byStatus, byPriority, total: rows.length } };
  },
});

export const restAssignable = internalQuery({
  args: { agencyId: v.id('agencies') },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_agency', (q) => q.eq('agencyId', args.agencyId))
      .collect();
    const seen = new Set<string>();
    const data = [];
    for (const membership of memberships) {
      if (!membership.isActive || seen.has(String(membership.userId))) continue;
      seen.add(String(membership.userId));
      const user = await publicUser(ctx, membership.userId);
      if (user) data.push(user);
    }
    return { ok: true as const, data };
  },
});

export const restCreatePin = internalMutation({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const location = await ctx.db.get(args.subAccountId);
    if (!location || String(location.agencyId) !== String(args.agencyId)) {
      return { ok: false as const, status: 400, code: 'VALIDATION_ERROR', message: 'Invalid location' };
    }
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_agency', (q) => q.eq('agencyId', args.agencyId))
      .collect();
    let createdBy = memberships.find((row) => row.isActive)?.userId;
    for (const membership of memberships) {
      if (!membership.isActive) continue;
      const role = await ctx.db.get(membership.roleId);
      if (role?.slug === 'agency_owner') {
        createdBy = membership.userId;
        break;
      }
    }
    if (!createdBy) {
      return { ok: false as const, status: 400, code: 'VALIDATION_ERROR', message: 'No agency user to attribute this pin' };
    }
    const title = args.title.trim();
    if (title.length < 4) {
      return { ok: false as const, status: 400, code: 'VALIDATION_ERROR', message: 'Title must be at least 4 characters.' };
    }
    const now = Date.now();
    const pinId = await ctx.db.insert('seedlyPins', {
      agencyId: args.agencyId,
      subAccountId: args.subAccountId,
      createdBy,
      title,
      description: args.description?.trim() || undefined,
      status: 'open',
      priority: isValidPriority(args.priority) ? args.priority : 'medium',
      source: 'manual',
      metadata: sanitizeMetadata(args.metadata),
      createdAt: now,
      updatedAt: now,
    });
    const entry = historyEntry({ action: 'created', newValue: title });
    if (entry) {
      await ctx.db.insert('seedlyPinHistory', {
        pinId,
        agencyId: args.agencyId,
        action: entry.action,
        newValue: entry.newValue,
        createdAt: now,
      });
    }
    return { ok: true as const, data: { id: pinId } };
  },
});

export const restUpdatePin = internalMutation({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    pinId: v.id('seedlyPins'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedTo: v.optional(v.union(v.id('users'), v.null())),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const pin = await loadPin(ctx, args.pinId, args.agencyId, args.subAccountId);
    if (!pin) return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Pin not found' };
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const history: Array<{ action: string; oldValue?: string; newValue?: string }> = [];
    if (args.title != null && args.title.trim() !== pin.title) {
      patch.title = args.title.trim();
      history.push({ action: 'description_changed', oldValue: pin.title, newValue: args.title.trim() });
    }
    if (args.description !== undefined && args.description !== pin.description) {
      patch.description = args.description?.trim() || undefined;
      history.push({ action: 'description_changed', oldValue: pin.description, newValue: args.description });
    }
    if (args.status != null) {
      if (!isValidStatus(args.status)) {
        return { ok: false as const, status: 400, code: 'VALIDATION_ERROR', message: 'Invalid status' };
      }
      if (args.status !== pin.status) {
        patch.status = args.status;
        if (args.status === 'resolved') patch.resolvedAt = Date.now();
        if (args.status === 'closed') patch.closedAt = Date.now();
        history.push({ action: 'status_changed', oldValue: pin.status, newValue: args.status });
      }
    }
    if (args.priority != null) {
      if (!isValidPriority(args.priority)) {
        return { ok: false as const, status: 400, code: 'VALIDATION_ERROR', message: 'Invalid priority' };
      }
      if (args.priority !== pin.priority) {
        patch.priority = args.priority;
        history.push({ action: 'priority_changed', oldValue: pin.priority, newValue: args.priority });
      }
    }
    if (args.assignedTo !== undefined && String(args.assignedTo ?? '') !== String(pin.assignedTo ?? '')) {
      patch.assignedTo = args.assignedTo ?? undefined;
      history.push({
        action: 'assignee_changed',
        oldValue: pin.assignedTo,
        newValue: args.assignedTo ?? undefined,
      });
    }
    await ctx.db.patch(args.pinId, patch);
    for (const row of history) {
      const entry = historyEntry(row);
      if (!entry) continue;
      await ctx.db.insert('seedlyPinHistory', {
        pinId: args.pinId,
        agencyId: args.agencyId,
        action: entry.action,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        createdAt: Date.now(),
      });
    }
    return { ok: true as const, data: { id: args.pinId } };
  },
});

export const restAddNote = internalMutation({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.optional(v.id('subAccounts')),
    pinId: v.id('seedlyPins'),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await loadSettings(ctx, args.agencyId);
    if (!settings.enabled) return disabled();
    const pin = await loadPin(ctx, args.pinId, args.agencyId, args.subAccountId);
    if (!pin) return { ok: false as const, status: 404, code: 'NOT_FOUND', message: 'Pin not found' };
    const message = args.message.trim();
    if (!message) {
      return { ok: false as const, status: 400, code: 'VALIDATION_ERROR', message: 'Note cannot be empty' };
    }
    const noteId = await ctx.db.insert('seedlyPinNotes', {
      pinId: args.pinId,
      agencyId: args.agencyId,
      userId: pin.createdBy,
      message,
      createdAt: Date.now(),
    });
    const entry = historyEntry({ action: 'note_added', newValue: message.slice(0, 80) });
    if (entry) {
      await ctx.db.insert('seedlyPinHistory', {
        pinId: args.pinId,
        agencyId: args.agencyId,
        action: entry.action,
        newValue: entry.newValue,
        createdAt: Date.now(),
      });
    }
    return { ok: true as const, data: { id: noteId } };
  },
});
