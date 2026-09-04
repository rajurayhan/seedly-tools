import { describe, expect, it } from 'vitest';
import { GHL_API_COVERAGE, apiBackedEntities, coverageForEntity } from '../coverage';
import { GHL_IMPORT_ORDER, GHL_ENTITIES } from '../entities';
import { GHL_READ_SCOPES, formatScopeChecklist } from '../scopes';

describe('coverage matrix', () => {
  it('covers every importable entity', () => {
    for (const entity of GHL_ENTITIES) {
      expect(coverageForEntity(entity.id), entity.id).toBeDefined();
    }
  });

  it('lists API-backed rows for the spike', () => {
    expect(apiBackedEntities().length).toBeGreaterThan(10);
    expect(GHL_API_COVERAGE.some((r) => r.level === 'reconnect')).toBe(true);
  });

  it('keeps import order aligned with the catalog', () => {
    expect(new Set(GHL_IMPORT_ORDER).size).toBe(GHL_ENTITIES.length);
  });

  it('prints a copyable scope checklist', () => {
    const text = formatScopeChecklist();
    expect(text).toContain('contacts.readonly');
    expect(text).toContain('Do not tick Write scopes');
    expect(GHL_READ_SCOPES.length).toBeGreaterThan(15);
  });
});
