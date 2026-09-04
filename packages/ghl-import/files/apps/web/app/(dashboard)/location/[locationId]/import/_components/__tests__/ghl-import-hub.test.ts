import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const HUB = readFileSync(join(__dirname, '../ghl-import-hub.tsx'), 'utf-8');
const NAV = readFileSync(
  join(__dirname, '../../../../../../../lib/ghl-import/nav.ts'),
  'utf-8',
);
const EXT = readFileSync(join(__dirname, '../../../../../../../lib/extensions.ts'), 'utf-8');
const PLAN = readFileSync(
  join(__dirname, '../../../../../../../lib/extension-plan-features.ts'),
  'utf-8',
);

describe('GHL import hub', () => {
  it('documents both token paths and read-only scopes', () => {
    expect(HUB).toContain('Private Integration Token');
    expect(HUB).toContain('Location token');
    expect(HUB).toContain('Agency token');
    expect(HUB).toContain('Do not tick Write scopes');
    expect(HUB).toContain('app.gohighlevel.com/v2/location');
    expect(HUB).toContain('Read-only scopes to tick');
    expect(HUB).toContain('CopyButton');
  });

  it('keeps the token-setup instructions behind a disclosure', () => {
    expect(HUB).toContain('open={tokenHelpOpen ?? !connection}');
    expect(HUB).not.toContain('defaultOpen=');
    expect(HUB).toMatch(
      /<summary[^>]*>[\s\S]*Where to get a Private Integration Token/,
    );
  });

  it('requires a dry-run approval before import', () => {
    expect(HUB).toContain('Run dry-run');
    expect(HUB).toContain('Approve and import');
    expect(HUB).toContain('disabled={busy || blockers > 0}');
    expect(HUB).not.toContain('Start import');
  });

  it('registers a sidebar nav item', () => {
    expect(NAV).toContain("label: 'Import'");
    expect(NAV).toContain("href: '/import'");
    expect(NAV).toContain("'/import': 'ghl_import'");
    expect(NAV).toContain("subject: 'Ghl_import'");
    expect(EXT).toContain('./ghl-import/nav');
    expect(PLAN).toContain("key: 'ghl_import'");
    expect(PLAN).toContain("label: 'HighLevel import'");
  });
});
