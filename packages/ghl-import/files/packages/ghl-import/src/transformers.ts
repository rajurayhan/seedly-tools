import type { GhlContact, GhlCustomField, GhlOpportunity } from './types';

const FIELD_TYPE_MAP: Record<string, string> = {
  TEXT: 'text',
  LARGE_TEXT: 'text',
  NUMERICAL: 'number',
  PHONE: 'phone',
  MONETARY: 'monetary',
  CHECKBOX: 'boolean',
  SINGLE_OPTIONS: 'select',
  MULTIPLE_OPTIONS: 'select',
  DATE: 'date',
  RADIO: 'radio',
};

export function mapCustomFieldType(ghlType: string | undefined): string {
  if (!ghlType) return 'text';
  return FIELD_TYPE_MAP[ghlType.toUpperCase()] ?? 'text';
}

export function mapDealStatus(ghlStatus: string | undefined): 'open' | 'won' | 'lost' | 'abandoned' {
  const s = (ghlStatus ?? 'open').toLowerCase();
  if (s === 'won') return 'won';
  if (s === 'lost') return 'lost';
  if (s === 'abandoned') return 'abandoned';
  return 'open';
}

export function mapMessageChannel(
  ghlType: string | number | undefined,
): 'sms' | 'email' | 'call' | 'messenger' | 'instagram' | 'live_chat' {
  if (ghlType === 'TYPE_EMAIL' || ghlType === 3 || ghlType === 'Email') return 'email';
  if (ghlType === 'TYPE_CALL' || ghlType === 1 || ghlType === 'Call') return 'call';
  if (ghlType === 'TYPE_FACEBOOK' || ghlType === 'FB' || ghlType === 'TYPE_MESSENGER') {
    return 'messenger';
  }
  if (ghlType === 'TYPE_INSTAGRAM' || ghlType === 'IG') return 'instagram';
  if (ghlType === 'TYPE_LIVE_CHAT' || ghlType === 'Live Chat') return 'live_chat';
  return 'sms';
}

export function mapMessageDirection(direction: string | undefined): 'inbound' | 'outbound' {
  return direction?.toLowerCase() === 'inbound' ? 'inbound' : 'outbound';
}

export function mapAppointmentStatus(
  ghlStatus: string | undefined,
): 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' {
  const s = (ghlStatus ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'confirmed') return 'confirmed';
  if (s === 'cancelled' || s === 'canceled' || s === 'invalid') return 'cancelled';
  if (s === 'completed' || s === 'showed' || s === 'show') return 'completed';
  if (s === 'no_show' || s === 'noshow') return 'no_show';
  return 'scheduled';
}

export function remapCustomFieldKeys(
  values: Record<string, unknown>,
  mapping: Record<string, string> | undefined,
): Record<string, unknown> {
  if (!mapping || Object.keys(mapping).length === 0) return values;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(values)) {
    out[mapping[key] ?? key] = val;
  }
  return out;
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug.length > 0 ? slug : 'imported';
}

export function parseEpoch(value: string | number | undefined, fallback = Date.now()): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

export function customFieldValues(contact: GhlContact): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of contact.customFields ?? []) {
    const key = field.key ?? field.id;
    if (!key) continue;
    out[key] = field.field_value ?? field.value;
  }
  return out;
}

export function customFieldOptions(field: GhlCustomField): string[] | undefined {
  if (!field.options || field.options.length === 0) return undefined;
  return field.options.map((opt) => (typeof opt === 'string' ? opt : (opt.label ?? opt.key ?? '')));
}

export function opportunityName(opp: GhlOpportunity): string {
  return opp.name?.trim() || 'Imported opportunity';
}

export const INERT_MESSAGE_STATUSES = ['delivered', 'failed', 'bounced', 'read'] as const;
export type InertMessageStatus = (typeof INERT_MESSAGE_STATUSES)[number];

/** Historical import may only write statuses that never enqueue a send. */
export function mapInertMessageStatus(ghlStatus: string | undefined): InertMessageStatus {
  const s = (ghlStatus ?? '').toLowerCase();
  if (s === 'read' || s === 'opened') return 'read';
  if (s === 'bounced') return 'bounced';
  if (s === 'failed' || s === 'undelivered') return 'failed';
  if (s === 'pending' || s === 'queued' || s === 'scheduled' || s === 'processing') {
    return 'failed';
  }
  return 'delivered';
}

export type DndChannel = 'sms' | 'email' | 'call';

export type DndMapResult =
  | {
      ok: true;
      settings: Record<string, { inbound: boolean; outbound: boolean }>;
      suppressions: Array<'email' | 'sms'>;
    }
  | { ok: false; reason: string };

const DND_CHANNELS: readonly DndChannel[] = ['sms', 'email', 'call'];

function channelFromKey(key: string): DndChannel | undefined {
  const k = key.toLowerCase();
  if (k === 'sms' || k === 'text') return 'sms';
  if (k === 'email' || k === 'mail') return 'email';
  if (k === 'call' || k === 'voice' || k === 'phone') return 'call';
  return undefined;
}

function isBlockedSetting(value: unknown): boolean | 'unknown' {
  if (value === true || value === 'blocked' || value === 'active') return true;
  if (value === false || value === 'allowed' || value === 'inactive') return false;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if (rec.status !== undefined) return isBlockedSetting(rec.status);
    if (rec.outbound === true) return true;
    if (rec.outbound === false) return false;
  }
  return 'unknown';
}

/**
 * Map HighLevel DND onto Seedly outbound blocks. Unknown shapes reject the
 * contact rather than importing it unrestricted.
 */
export function mapHlDnd(dnd: unknown, dndSettings?: unknown): DndMapResult {
  const source = dndSettings ?? dnd;
  if (source === undefined || source === null || source === false) {
    return { ok: true, settings: {}, suppressions: [] };
  }
  if (source === true) {
    return {
      ok: true,
      settings: {
        sms: { inbound: false, outbound: true },
        email: { inbound: false, outbound: true },
        call: { inbound: false, outbound: true },
      },
      suppressions: ['email', 'sms'],
    };
  }
  if (typeof source !== 'object' || Array.isArray(source)) {
    return { ok: false, reason: 'DND shape is not a boolean or channel object' };
  }
  const settings: Record<string, { inbound: boolean; outbound: boolean }> = {};
  const suppressions: Array<'email' | 'sms'> = [];
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (value === undefined) continue;
    const channel = channelFromKey(key);
    if (!channel) {
      return { ok: false, reason: `Unknown DND channel "${key}"` };
    }
    const blocked = isBlockedSetting(value);
    if (blocked === 'unknown') {
      return { ok: false, reason: `Unrecognized DND value for ${channel}` };
    }
    if (blocked) {
      settings[channel] = { inbound: false, outbound: true };
      if (channel === 'email' || channel === 'sms') suppressions.push(channel);
    }
  }
  void DND_CHANNELS;
  return { ok: true, settings, suppressions };
}
