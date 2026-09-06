import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DROP_ROLES,
  DEFAULT_TRIAGE_ROLES,
  DISABLED_MESSAGE,
  canDrop,
  canTriage,
  exportDiagnostics,
  historyEntry,
  isEnabled,
  normalizeSettings,
  sanitizeMetadata,
  storageKeyNamesOnly,
} from '../../files/packages/seedly-pin/src/gates.mjs';
import { insertPinOpenApi, PIN_PATH_MARK } from '../../bin/openapi.mjs';
import { insertPinAllowMap, stripPinAllowMap } from '../../bin/allow-map.mjs';
import { patchLayout, patchSettingsLayout } from '../../bin/patch-host.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(here, '../..');

function readOwned(rel) {
  return readFileSync(join(kitRoot, 'files', rel), 'utf8');
}

test('defaults stay off until the owner enables Pins', () => {
  const settings = normalizeSettings(undefined);
  assert.equal(settings.enabled, false);
  assert.deepEqual(settings.dropRoles, DEFAULT_DROP_ROLES);
  assert.deepEqual(settings.triageRoles, DEFAULT_TRIAGE_ROLES);
  assert.equal(isEnabled({}), false);
});

test('drop vs triage role lists', () => {
  const off = { enabled: false, dropRoles: DEFAULT_DROP_ROLES, triageRoles: DEFAULT_TRIAGE_ROLES };
  assert.equal(canDrop(off, 'agency_owner'), false);
  const on = { enabled: true, dropRoles: ['sub_account_user'], triageRoles: ['agency_owner'] };
  assert.equal(canDrop(on, 'sub_account_user'), true);
  assert.equal(canDrop(on, 'agency_owner'), false);
  assert.equal(canTriage(on, 'agency_owner'), true);
  assert.equal(canTriage(on, 'sub_account_user'), false);
});

test('storage capture keeps key names only', () => {
  const keys = storageKeyNamesOnly({
    cookies: ['session=abc', 'theme'],
    localStorage: ['token'],
    sessionStorage: ['draft=1'],
  });
  assert.deepEqual(keys.cookies, ['session', 'theme']);
  assert.deepEqual(keys.localStorage, ['token']);
  assert.deepEqual(keys.sessionStorage, ['draft']);
  assert.equal(JSON.stringify(keys).includes('abc'), false);
});

test('sanitizeMetadata keeps capture fields and storage keys only', () => {
  const meta = sanitizeMetadata({
    url: 'https://crm.example/location/1?secret=1',
    consoleErrors: [{ type: 'error', message: 'boom', timestamp: 't' }],
    networkErrors: [{ url: '/api', method: 'GET', status: 500, statusText: 'err', timestamp: 't' }],
    userActivity: [{ type: 'button', text: 'Save', timestamp: 't' }],
    storageKeys: { cookies: ['sid=secret'], localStorage: ['k'], sessionStorage: [] },
    pinnedElement: { cssSelector: '#save' },
  });
  assert.equal(meta.consoleErrors.length, 1);
  assert.equal(meta.networkErrors[0].status, 500);
  assert.equal(meta.userActivity[0].type, 'button');
  assert.deepEqual(meta.storageKeys.cookies, ['sid']);
  assert.equal(meta.pinnedElement.cssSelector, '#save');
});

test('history is written for status and assignee changes', () => {
  assert.deepEqual(historyEntry({ action: 'status_changed', oldValue: 'open', newValue: 'resolved' }), {
    action: 'status_changed',
    oldValue: 'open',
    newValue: 'resolved',
  });
  assert.deepEqual(historyEntry({ action: 'assignee_changed', oldValue: 'u1', newValue: 'u2' }), {
    action: 'assignee_changed',
    oldValue: 'u1',
    newValue: 'u2',
  });
  assert.equal(historyEntry({ action: 'nope' }), null);
});

test('export diagnostics redacts query strings for agents', () => {
  const pack = exportDiagnostics(
    {
      _id: 'p1',
      title: 'Broken save',
      status: 'open',
      priority: 'high',
      metadata: {
        url: 'https://crm.example/contacts?token=abc',
        consoleErrors: [{ type: 'error', message: 'x'.repeat(400), timestamp: 't' }],
        storageKeys: { cookies: ['sid=secret'] },
      },
    },
    { format: 'aiPrompt', files: [{ type: 'screenshot', filename: 'a.png', url: '/file' }] },
  );
  assert.equal(pack.format, 'aiPrompt');
  assert.match(pack.text, /Broken save/);
  assert.match(pack.text, /update the pin status/);
  assert.equal(pack.text.includes('token=abc'), false);
  assert.equal(pack.text.includes('sid=secret'), false);
});

test('REST create/list/update/export live in owned routes', () => {
  const routes = readOwned('convex/seedlyPin/routes.ts');
  assert.match(routes, /namespace: 'seedly-pin'/);
  assert.match(routes, /path: 'pins'/);
  assert.match(routes, /path: 'pins\/:id\/export'/);
  assert.match(routes, /exportPinDiagnostics|handleExport/);
  const api = readOwned('convex/seedlyPin/api.ts');
  assert.match(api, /DISABLED_MESSAGE/);
  assert.match(api, /agency\.settings/);
  assert.equal(api.includes("key: 'seedly_pin'"), false);
});

test('FAB stays hidden unless canDrop; overlay captures collectors', () => {
  const fab = readOwned('apps/web/lib/seedly-pin/fab.tsx');
  assert.match(fab, /canDrop/);
  assert.match(fab, /SeedlyPinOverlay/);
  const overlay = readOwned('apps/web/lib/seedly-pin/overlay.tsx');
  assert.match(overlay, /createCaptureSession/);
  assert.match(overlay, /captureViewport/);
  assert.match(overlay, /pickElement/);
  const collectors = readOwned('apps/web/lib/seedly-pin/capture/collectors.ts');
  assert.match(collectors, /storageKeyNamesFromWindow/);
  assert.match(collectors, /Object\.keys\(win\.localStorage/);
});

test('layout and settings patches are idempotent', () => {
  const layout = `import { InitialDataProvider } from '@/components/providers/initial-data-provider';
export default function L() {
  return (
        <InitialDataProvider>
          <CommandPalette />
        </InitialDataProvider>
  );
}
`;
  const once = patchLayout(layout);
  const twice = patchLayout(once.src);
  assert.equal(once.ok, true);
  assert.equal(twice.ok, true);
  assert.equal(once.src, twice.src);
  assert.match(once.src, /SeedlyPinFab/);

  const settings = `const settingsTabs = [
  { label: 'Access', href: '/settings/access' },
  { label: 'Audit Log', href: '/settings/audit-log' },
];
`;
  const s1 = patchSettingsLayout(settings);
  const s2 = patchSettingsLayout(s1.src);
  assert.equal(s1.ok && s2.ok, true);
  assert.equal(s1.src, s2.src);
  assert.match(s1.src, /\/settings\/pins/);
});

test('OpenAPI insert is idempotent and includes export operationId', () => {
  const yaml = 'paths:\n  /x: {}\n\ncomponents:\n  schemas: {}\n';
  const first = insertPinOpenApi(yaml);
  const second = insertPinOpenApi(first.yaml);
  assert.equal(first.inserted, true);
  assert.equal(second.inserted, false);
  assert.match(first.yaml, new RegExp(PIN_PATH_MARK.replace('/', '\\/')));
  assert.match(first.yaml, /operationId: exportPinDiagnostics/);
  assert.match(first.yaml, /operationId: listPins/);
});

test('allow-map insert is no-op when missing and idempotent when present', () => {
  const src = `export const ALLOW_MAP = [
  { operationId: 'getMe', name: 'get_me' },
];
`;
  const first = insertPinAllowMap(src);
  const second = insertPinAllowMap(first.src);
  assert.equal(first.inserted, true);
  assert.equal(second.inserted, false);
  assert.match(first.src, /list_pins/);
  assert.match(first.src, /export_pin_diagnostics/);
  const stripped = stripPinAllowMap(first.src);
  assert.equal(stripped.includes('list_pins'), false);
});

test('disabled message is the REST 403 copy', () => {
  assert.equal(DISABLED_MESSAGE, 'SeedlyPin is turned off for this agency.');
  const internal = readOwned('convex/seedlyPin/internal.ts');
  assert.match(internal, /FEATURE_DISABLED/);
  assert.match(internal, /DISABLED_MESSAGE/);
});
