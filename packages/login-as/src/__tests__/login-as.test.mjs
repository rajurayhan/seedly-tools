import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TWO_FACTOR_REQUIRED_MESSAGE,
  anyPlanAllowsLoginAs,
  callerScope,
  canStartAgainstTarget,
  isSuperAdminUser,
  overlayEffectiveUser,
  planAllowsLoginAs,
} from '../../files/packages/login-as/src/gates.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(here, '../..');

function readOwned(rel) {
  return readFileSync(join(kitRoot, 'files', rel), 'utf8');
}

test('optional isSuperAdmin is a strict true check', () => {
  assert.equal(isSuperAdminUser({ isSuperAdmin: true }), true);
  assert.equal(isSuperAdminUser({}), false);
  assert.equal(isSuperAdminUser({ isSuperAdmin: false }), false);
  assert.equal(isSuperAdminUser(null), false);
});

test('plan toggle: empty or missing enabledFeatures means on', () => {
  assert.equal(planAllowsLoginAs({}), true);
  assert.equal(planAllowsLoginAs({ enabledFeatures: [] }), true);
  assert.equal(planAllowsLoginAs({ enabledFeatures: ['contacts', 'login_as'] }), true);
  assert.equal(planAllowsLoginAs({ enabledFeatures: ['contacts'] }), false);
  assert.equal(anyPlanAllowsLoginAs([]), true);
  assert.equal(anyPlanAllowsLoginAs([{ enabledFeatures: ['contacts'] }]), false);
  assert.equal(
    anyPlanAllowsLoginAs([{ enabledFeatures: ['contacts'] }, { enabledFeatures: ['login_as'] }]),
    true,
  );
});

test('caller scope: Super Admin ignores plan; agency owner needs plan', () => {
  assert.equal(callerScope({ isSuperAdmin: true, isAgencyOwner: false, planAllows: false }), 'all');
  assert.equal(callerScope({ isSuperAdmin: false, isAgencyOwner: true, planAllows: true }), 'agency');
  assert.equal(callerScope({ isSuperAdmin: false, isAgencyOwner: true, planAllows: false }), null);
  assert.equal(callerScope({ isSuperAdmin: false, isAgencyOwner: false, planAllows: true }), null);
});

test('agency owner cannot target self, other agency, or Super Admin', () => {
  const target = { _id: 'u2', isActive: true };
  assert.equal(
    canStartAgainstTarget({
      scope: 'agency',
      realUserId: 'u1',
      target,
      sharedAgency: true,
      targetIsSuperAdmin: false,
    }),
    true,
  );
  assert.equal(
    canStartAgainstTarget({
      scope: 'agency',
      realUserId: 'u2',
      target,
      sharedAgency: true,
      targetIsSuperAdmin: false,
    }),
    false,
  );
  assert.equal(
    canStartAgainstTarget({
      scope: 'agency',
      realUserId: 'u1',
      target,
      sharedAgency: false,
      targetIsSuperAdmin: false,
    }),
    false,
  );
  assert.equal(
    canStartAgainstTarget({
      scope: 'agency',
      realUserId: 'u1',
      target,
      sharedAgency: true,
      targetIsSuperAdmin: true,
    }),
    false,
  );
  assert.equal(
    canStartAgainstTarget({
      scope: 'all',
      realUserId: 'u1',
      target: { _id: 'u9', isActive: true },
      sharedAgency: false,
      targetIsSuperAdmin: false,
    }),
    true,
  );
  assert.equal(
    canStartAgainstTarget({
      scope: 'agency',
      realUserId: 'u1',
      target: { _id: 'u2', isActive: false },
      sharedAgency: true,
      targetIsSuperAdmin: false,
    }),
    false,
  );
});

test('overlay fails closed when the target is missing or inactive', () => {
  const real = { _id: 'real', isActive: true };
  const session = { _id: 's1', startedAt: 1, targetUserId: 't1' };
  assert.deepEqual(overlayEffectiveUser(real, null, null).user, real);
  assert.equal(overlayEffectiveUser(real, session, null).loginAs, undefined);
  assert.equal(overlayEffectiveUser(real, session, { _id: 't1', isActive: false }).loginAs, undefined);
  const live = overlayEffectiveUser(real, session, { _id: 't1', isActive: true });
  assert.equal(live.user._id, 't1');
  assert.equal(live.loginAs.realUserId, 'real');
});

test('2FA denial copy is distinct', () => {
  assert.match(TWO_FACTOR_REQUIRED_MESSAGE, /two-factor/i);
});

test('picker never queries searchTargets when 2FA is off', () => {
  const src = readOwned('apps/web/lib/login-as/picker.tsx');
  assert.match(src, /open && twoFactorEnrolled/);
  assert.match(src, /Enable two-factor authentication on your own account/);
  assert.match(src, /if \(!twoFactorEnrolled\) return/);
});

test('bar does not navigate when stop fails', () => {
  const src = readOwned('apps/web/lib/login-as/bar.tsx');
  assert.match(src, /setSwitching\(false\)/);
  assert.match(src, /window\.location\.assign\('\/'\)/);
  assert.match(src, /role="alert"/);
  const catchBlock = src.match(/catch \(err\) \{([\s\S]*?)\n    \}/);
  assert.ok(catchBlock);
  assert.match(catchBlock[1], /return;/);
  assert.equal(catchBlock[1].includes('window.location'), false);
});

test('start/stop/search resolve the real identity, not getAuthContext', () => {
  const src = readOwned('convex/loginAs/api.ts');
  assert.match(src, /resolveUserBySubject/);
  assert.equal(src.includes('getAuthContext('), false);
  assert.match(src, /agency_owner/);
  assert.match(src, /isSuperAdminUser/);
});
