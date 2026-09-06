import { overlayEffectiveUser } from '../../packages/login-as/src/gates.mjs';

type DbUser = {
  _id: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

/**
 * Swap the real caller for the open login-as target.
 * Fail closed to the real user if the target is gone or inactive.
 */
export async function applyAddonLoginAsOverlay(
  ctx: { db: { query: Function; get: Function } },
  realUser: DbUser,
) {
  let session = null;
  try {
    session = await ctx.db
      .query('loginAsSessions')
      .withIndex('by_realUser_active', (q: { eq: Function }) =>
        q.eq('realUserId', realUser._id).eq('endedAt', undefined),
      )
      .first();
  } catch {
    return { user: realUser, loginAs: undefined };
  }
  if (!session) return { user: realUser, loginAs: undefined };

  const targetUser = await ctx.db.get(session.targetUserId);
  return overlayEffectiveUser(realUser, session, targetUser);
}
