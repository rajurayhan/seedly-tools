import { ConvexError } from 'convex/values';

/** Fixture stub — markers match Seedly 5.8.0 getAuthContext. */
export async function resolveUserBySubject(ctx, subject) {
  return ctx.db
    .query('users')
    .withIndex('by_betterAuthId', (q) => q.eq('betterAuthId', subject))
    .first();
}

export async function getAuthContext(ctx, opts) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('Not authenticated');
  }

  const user = await resolveUserBySubject(ctx, identity.subject);

  if (!user) {
    throw new ConvexError('Not authenticated');
  }

  if (!user.isActive) {
    throw new ConvexError('Not authenticated');
  }

  return { user, userId: user._id, opts };
}
