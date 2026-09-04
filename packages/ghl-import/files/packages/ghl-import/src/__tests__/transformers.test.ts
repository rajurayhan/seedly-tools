import { describe, expect, it } from 'vitest';
import {
  customFieldValues,
  mapAppointmentStatus,
  mapCustomFieldType,
  mapDealStatus,
  mapHlDnd,
  mapInertMessageStatus,
  mapMessageChannel,
  mapMessageDirection,
  parseEpoch,
  remapCustomFieldKeys,
  slugify,
} from '../transformers';
import contactFixture from '../fixtures/contact.json';

describe('transformers', () => {
  it('maps GHL custom field types', () => {
    expect(mapCustomFieldType('TEXT')).toBe('text');
    expect(mapCustomFieldType('NUMERICAL')).toBe('number');
    expect(mapCustomFieldType('unknown')).toBe('text');
  });

  it('maps opportunity statuses', () => {
    expect(mapDealStatus('won')).toBe('won');
    expect(mapDealStatus('LOST')).toBe('lost');
    expect(mapDealStatus('open')).toBe('open');
  });

  it('maps message channel and direction', () => {
    expect(mapMessageChannel('TYPE_EMAIL')).toBe('email');
    expect(mapMessageDirection('inbound')).toBe('inbound');
    expect(mapMessageDirection('outbound')).toBe('outbound');
  });

  it('slugifies calendar names', () => {
    expect(slugify('Sales Calendar!')).toBe('sales-calendar');
    expect(slugify('***')).toBe('imported');
  });

  it('parses epoch values', () => {
    expect(parseEpoch('1700000000')).toBe(1_700_000_000_000);
    expect(parseEpoch('2024-01-01T00:00:00.000Z')).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
  });

  it('extracts custom field values from a contact fixture', () => {
    expect(customFieldValues(contactFixture)).toEqual({ cf_city: 'London' });
  });

  it('remaps custom field keys from the mapping UI', () => {
    expect(remapCustomFieldKeys({ cf_city: 'London' }, { cf_city: 'city' })).toEqual({
      city: 'London',
    });
    expect(remapCustomFieldKeys({ cf_city: 'London' }, undefined)).toEqual({ cf_city: 'London' });
  });

  it('maps GHL appointment statuses onto Seedly values', () => {
    expect(mapAppointmentStatus('confirmed')).toBe('confirmed');
    expect(mapAppointmentStatus('showed')).toBe('completed');
    expect(mapAppointmentStatus('noshow')).toBe('no_show');
    expect(mapAppointmentStatus('new')).toBe('scheduled');
  });

  it('maps historical message statuses to inert values only', () => {
    expect(mapInertMessageStatus('delivered')).toBe('delivered');
    expect(mapInertMessageStatus('pending')).toBe('failed');
    expect(mapInertMessageStatus('queued')).toBe('failed');
    expect(mapInertMessageStatus('scheduled')).toBe('failed');
    expect(mapInertMessageStatus('read')).toBe('read');
    expect(mapInertMessageStatus('undelivered')).toBe('failed');
    expect(mapInertMessageStatus('bounced')).toBe('bounced');
    expect(['pending', 'queued', 'scheduled']).not.toContain(mapInertMessageStatus('pending'));
  });

  it('maps DND fail-closed', () => {
    expect(mapHlDnd(undefined).ok).toBe(true);
    const allBlocked = mapHlDnd(true);
    expect(allBlocked.ok).toBe(true);
    if (allBlocked.ok) {
      expect(allBlocked.suppressions).toEqual(['email', 'sms']);
    }
    expect(mapHlDnd({ SMS: { status: 'active' } }).ok).toBe(true);
    expect(mapHlDnd({ fax: true }).ok).toBe(false);
    expect(mapHlDnd('sometimes').ok).toBe(false);
  });
});
