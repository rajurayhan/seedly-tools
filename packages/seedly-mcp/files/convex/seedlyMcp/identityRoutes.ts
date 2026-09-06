import { makeFunctionReference } from 'convex/server';
import type { ActionCtx } from '../_generated/server';
import type {
  ExtensionApiRequest,
  ExtensionApiResult,
  ExtensionApiRoute,
} from './apiRouteTypes';

const getMeRef = makeFunctionReference<'query'>('seedlyMcp/identity:getMe');
const getLocationRef = makeFunctionReference<'query'>('seedlyMcp/identity:getLocation');

async function handleMe(ctx: ActionCtx, req: ExtensionApiRequest): Promise<ExtensionApiResult> {
  if (!req.apiKeyId) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'This host does not pass the API key id to extension routes',
    };
  }
  const data = await ctx.runQuery(getMeRef, { apiKeyId: req.apiKeyId });
  if (!data) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'User not found' };
  return { ok: true, data };
}

async function handleLocation(
  ctx: ActionCtx,
  req: ExtensionApiRequest,
): Promise<ExtensionApiResult> {
  const data = await ctx.runQuery(getLocationRef, {
    agencyId: req.agencyId,
    subAccountId: req.subAccountId,
  });
  if (!data) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Location not found' };
  return { ok: true, data };
}

export const seedlyMcpIdentityRoutes: readonly ExtensionApiRoute[] = [
  {
    namespace: 'seedly-mcp',
    path: 'me',
    method: 'GET',
    scope: 'any',
    resource: 'me',
    rateLimit: 'read',
    summary: 'Current user (API key owner)',
    handle: handleMe,
  },
  {
    namespace: 'seedly-mcp',
    path: 'location',
    method: 'GET',
    scope: 'any',
    resource: 'location',
    rateLimit: 'read',
    summary: 'Current authorized location',
    handle: handleLocation,
  },
];
