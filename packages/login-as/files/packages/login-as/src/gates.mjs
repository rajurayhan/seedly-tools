/** Pure gates for Login as location user. No Convex imports. */

export const LOGIN_AS_PLAN_KEY = 'login_as';

export const TWO_FACTOR_REQUIRED_MESSAGE =
  'Enable two-factor authentication on your own account before using login-as.';

export function isSuperAdminUser(user) {
  return user != null && user.isSuperAdmin === true;
}

export function planAllowsLoginAs(plan) {
  if (!plan) return true;
  const enabled = plan.enabledFeatures;
  if (!enabled || enabled.length === 0) return true;
  return enabled.includes(LOGIN_AS_PLAN_KEY);
}

export function anyPlanAllowsLoginAs(plans) {
  if (!plans || plans.length === 0) return true;
  return plans.some(planAllowsLoginAs);
}

export function callerScope({ isSuperAdmin, isAgencyOwner, planAllows }) {
  if (isSuperAdmin) return 'all';
  if (isAgencyOwner && planAllows) return 'agency';
  return null;
}

export function canStartAgainstTarget({
  scope,
  realUserId,
  target,
  sharedAgency,
  targetIsSuperAdmin,
}) {
  if (!target || !target.isActive) return false;
  if (String(target._id) === String(realUserId)) return false;
  if (scope === 'agency' && targetIsSuperAdmin) return false;
  if (scope === 'agency' && !sharedAgency) return false;
  return scope === 'all' || scope === 'agency';
}

export function overlayEffectiveUser(realUser, session, targetUser) {
  if (!session) return { user: realUser, loginAs: undefined };
  if (!targetUser || !targetUser.isActive) {
    return { user: realUser, loginAs: undefined };
  }
  return {
    user: targetUser,
    loginAs: {
      realUserId: realUser._id,
      sessionId: session._id ?? session.sessionId,
      startedAt: session.startedAt,
    },
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };
}

export function displayName(user) {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || '';
}
