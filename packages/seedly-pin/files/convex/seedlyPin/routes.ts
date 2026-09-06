import { makeFunctionReference } from 'convex/server';
import type { ActionCtx } from '../_generated/server';
import type {
  ExtensionApiRequest,
  ExtensionApiResult,
  ExtensionApiRoute,
} from '../extensions/apiRoutes';

const listRef = makeFunctionReference<'query'>('seedlyPin/internal:restListPins');
const getRef = makeFunctionReference<'query'>('seedlyPin/internal:restGetPin');
const filesRef = makeFunctionReference<'query'>('seedlyPin/internal:restListFiles');
const notesRef = makeFunctionReference<'query'>('seedlyPin/internal:restListNotes');
const historyRef = makeFunctionReference<'query'>('seedlyPin/internal:restListHistory');
const exportRef = makeFunctionReference<'query'>('seedlyPin/internal:restExport');
const statsRef = makeFunctionReference<'query'>('seedlyPin/internal:restStats');
const assignableRef = makeFunctionReference<'query'>('seedlyPin/internal:restAssignable');
const createRef = makeFunctionReference<'mutation'>('seedlyPin/internal:restCreatePin');
const updateRef = makeFunctionReference<'mutation'>('seedlyPin/internal:restUpdatePin');
const addNoteRef = makeFunctionReference<'mutation'>('seedlyPin/internal:restAddNote');

function missingAgency(): ExtensionApiResult {
  return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'API key is missing an agency' };
}

function pinIdOf(req: ExtensionApiRequest): string | undefined {
  return req.pathParams?.id ?? req.pathParams?.pinId;
}

function bodyOf(req: ExtensionApiRequest): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};
}

async function handleList(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  return ctx.runQuery(listRef, {
    agencyId: req.agencyId,
    subAccountId: req.subAccountId,
    status: req.query?.status,
    priority: req.query?.priority,
    search: req.query?.search,
  });
}

async function handleCreate(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const body = bodyOf(req);
  const subAccountId = (typeof body.locationId === 'string' ? body.locationId : undefined) ?? req.subAccountId;
  if (!subAccountId) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'locationId is required' };
  }
  if (typeof body.title !== 'string') {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'title is required' };
  }
  return ctx.runMutation(createRef, {
    agencyId: req.agencyId,
    subAccountId,
    title: body.title,
    description: typeof body.description === 'string' ? body.description : undefined,
    priority: typeof body.priority === 'string' ? body.priority : undefined,
    metadata: body.metadata,
  });
}

async function handleGet(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const id = pinIdOf(req);
  if (!id) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'id is required' };
  return ctx.runQuery(getRef, { agencyId: req.agencyId, subAccountId: req.subAccountId, pinId: id });
}

async function handleUpdate(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const id = pinIdOf(req);
  if (!id) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'id is required' };
  const body = bodyOf(req);
  return ctx.runMutation(updateRef, {
    agencyId: req.agencyId,
    subAccountId: req.subAccountId,
    pinId: id,
    title: typeof body.title === 'string' ? body.title : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    status: typeof body.status === 'string' ? body.status : undefined,
    priority: typeof body.priority === 'string' ? body.priority : undefined,
    assignedTo: body.assignedTo === null ? null : typeof body.assignedTo === 'string' ? body.assignedTo : undefined,
  });
}

async function handleFiles(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const id = pinIdOf(req);
  if (!id) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'id is required' };
  return ctx.runQuery(filesRef, { agencyId: req.agencyId, subAccountId: req.subAccountId, pinId: id });
}

async function handleNotes(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const id = pinIdOf(req);
  if (!id) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'id is required' };
  return ctx.runQuery(notesRef, { agencyId: req.agencyId, subAccountId: req.subAccountId, pinId: id });
}

async function handleAddNote(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const id = pinIdOf(req);
  if (!id) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'id is required' };
  const body = bodyOf(req);
  if (typeof body.message !== 'string') {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'message is required' };
  }
  return ctx.runMutation(addNoteRef, {
    agencyId: req.agencyId,
    subAccountId: req.subAccountId,
    pinId: id,
    message: body.message,
  });
}

async function handleHistory(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const id = pinIdOf(req);
  if (!id) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'id is required' };
  return ctx.runQuery(historyRef, { agencyId: req.agencyId, subAccountId: req.subAccountId, pinId: id });
}

async function handleExport(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  const id = pinIdOf(req);
  if (!id) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'id is required' };
  return ctx.runQuery(exportRef, {
    agencyId: req.agencyId,
    subAccountId: req.subAccountId,
    pinId: id,
    format: req.query?.format,
  });
}

async function handleStats(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  return ctx.runQuery(statsRef, { agencyId: req.agencyId, subAccountId: req.subAccountId });
}

async function handleAssignable(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.agencyId) return missingAgency();
  return ctx.runQuery(assignableRef, { agencyId: req.agencyId });
}

function bind(fn: (ctx: ActionCtx, req: ExtensionApiRequest) => Promise<ExtensionApiResult>) {
  return (ctx: unknown, req: ExtensionApiRequest) => fn(ctx as ActionCtx, req);
}

export const seedlyPinRoutes: readonly ExtensionApiRoute[] = [
  {
    namespace: 'seedly-pin',
    path: 'pins',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'List pins',
    handle: bind(handleList),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins',
    method: 'POST',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'write',
    summary: 'Create a manual pin',
    handle: bind(handleCreate),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins/:id',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'Get one pin',
    handle: bind(handleGet),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins/:id',
    method: 'PATCH',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'write',
    summary: 'Update a pin',
    handle: bind(handleUpdate),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins/:id/files',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'List pin files',
    handle: bind(handleFiles),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins/:id/notes',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'List pin notes',
    handle: bind(handleNotes),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins/:id/notes',
    method: 'POST',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'write',
    summary: 'Add a pin note',
    handle: bind(handleAddNote),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins/:id/history',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'Pin history',
    handle: bind(handleHistory),
  },
  {
    namespace: 'seedly-pin',
    path: 'pins/:id/export',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'Export pin diagnostics',
    handle: bind(handleExport),
  },
  {
    namespace: 'seedly-pin',
    path: 'stats',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'Pin stats',
    handle: bind(handleStats),
  },
  {
    namespace: 'seedly-pin',
    path: 'assignable-users',
    method: 'GET',
    scope: 'any',
    resource: 'pins',
    rateLimit: 'read',
    summary: 'Assignable users',
    handle: bind(handleAssignable),
  },
];
