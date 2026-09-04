import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const SCHEMA = readFileSync(join(ROOT, 'ghlImportSchema.ts'), 'utf-8');
const EXT_INDEX = readFileSync(join(ROOT, 'extensions/index.ts'), 'utf-8');
const EXT_SNAP = readFileSync(join(ROOT, 'extensions/snapshot.ts'), 'utf-8');
const INTERNAL = readFileSync(join(ROOT, 'ghlImport/internal.ts'), 'utf-8');
const PUBLIC = readFileSync(join(ROOT, 'ghlImport/api.ts'), 'utf-8');
const ACTION = readFileSync(join(ROOT, 'actions/ghl.ts'), 'utf-8');
const CORE_REGISTRY = readFileSync(join(ROOT, 'lib/snapshot/registry.ts'), 'utf-8');

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('GHL import add-on foundation', () => {
  it('declares the three GHL tables on the extension seam', () => {
    expect(SCHEMA).toContain('ghlConnections: defineTable');
    expect(SCHEMA).toContain('ghlImportJobs: defineTable');
    expect(SCHEMA).toContain('ghlIdMappings: defineTable');
    expect(SCHEMA).toContain('encryptedToken');
    expect(SCHEMA).toContain("index('by_subAccount'");
    expect(SCHEMA).toContain("index('by_subAccount_entity_ghlId'");
    expect(SCHEMA).toContain('reviewing');
    expect(SCHEMA).toContain('awaiting_approval');
    expect(EXT_INDEX).toContain('ghlImportTables');
    expect(EXT_INDEX).toContain('...ghlImportTables');
  });

  it('classifies GHL tables as private on the extension snapshot, not core', () => {
    expect(EXT_SNAP).toContain("'ghlConnections'");
    expect(EXT_SNAP).toContain("'ghlImportJobs'");
    expect(EXT_SNAP).toContain("'ghlIdMappings'");
    const privateBlock = CORE_REGISTRY.slice(CORE_REGISTRY.indexOf('export const PRIVATE_TABLES'));
    expect(privateBlock).not.toContain("'ghlConnections'");
    expect(privateBlock).not.toContain("'ghlImportJobs'");
    expect(privateBlock).not.toContain("'ghlIdMappings'");
  });

  it('does not fabricate marketing consent on contact import', () => {
    expect(INTERNAL).toContain("source: 'ghl-import'");
    expect(INTERNAL).not.toMatch(/emailConsent:\s*'opted_in'/);
    expect(INTERNAL).toContain("addManualMember(ctx, defaultTransactionalListId, id, 'import')");
    expect(INTERNAL).toContain('mapHlDnd');
  });

  it('stores an ID mapping for idempotent re-runs', () => {
    expect(INTERNAL).toContain('ghlIdMappings');
    expect(INTERNAL).toContain('by_subAccount_entity_ghlId');
    expect(INTERNAL).toContain('already && args.entity !==');
  });

  it('supports pause, resume, cancel, rollback, and a dry-run approve gate', () => {
    expect(PUBLIC).toContain('export const pauseJob');
    expect(PUBLIC).toContain('export const resumeJob');
    expect(PUBLIC).toContain('export const cancelJob');
    expect(PUBLIC).toContain('export const rollbackJob');
    expect(PUBLIC).toContain('export const prepareReview');
    expect(PUBLIC).toContain('export const approveImport');
    expect(PUBLIC).toContain('Review and approve a dry-run before importing');
    expect(INTERNAL).toContain('export const rollbackBatch');
    expect(INTERNAL).toContain('dryRun');
    expect(ACTION).toContain('processDryRunBatch');
  });

  it('uses a PAT client and never OAuth', () => {
    expect(ACTION).toContain('GhlClient');
    expect(ACTION).toContain('encrypt(token)');
    expect(ACTION).not.toMatch(/oauth|OAuth|client_secret/i);
  });

  it('pages HighLevel users in small batches instead of one dump', () => {
    expect(ACTION).toContain('searchUsers');
    expect(ACTION).toContain('limit: BATCH');
    const usersCase = ACTION.slice(ACTION.indexOf("case 'users':"));
    expect(usersCase).not.toMatch(/listUsers\(\)/);
  });

  it('imports segments, reviews, tasks, and walks conversation messages', () => {
    expect(INTERNAL).toContain("case 'segments'");
    expect(INTERNAL).toContain("case 'reviews'");
    expect(INTERNAL).toContain("case 'tasks'");
    expect(INTERNAL).toContain('Imported from HighLevel');
    expect(INTERNAL).toContain('remapCustomFieldKeys');
    expect(INTERNAL).toContain('mapInertMessageStatus');
    expect(INTERNAL).toContain('externalId: `ghl:${ghlId}`');
    expect(ACTION).toContain("entityType: 'conversations'");
    expect(ACTION).toContain('listMessages');
    expect(ACTION).toContain('listTasks');
  });

  it('does not import GoSeedly writers, tables, or scopes', () => {
    const files = [
      ...walkTs(join(ROOT, 'ghlImport')),
      join(ROOT, 'ghlImportSchema.ts'),
      join(ROOT, 'actions/ghl.ts'),
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      expect(src, file).not.toMatch(/goseedly/i);
    }
  });
});
