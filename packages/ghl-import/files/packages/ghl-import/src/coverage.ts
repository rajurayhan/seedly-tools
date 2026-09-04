/**
 * Phase 0 spike: GHL API v2 coverage matrix.
 *
 * Built from the official marketplace docs (services.leadconnectorhq.com,
 * Version: 2021-07-28). A live PAT can refine counts via `probeCoverage`.
 */

import type { GhlEntityId } from './entities';

export type CoverageLevel = 'api' | 'partial-api' | 'csv-fallback' | 'reconnect' | 'unsupported';

export interface CoverageRow {
  entity: GhlEntityId | 'phoneNumbers' | 'emailDomains' | 'stripe' | 'a2p';
  level: CoverageLevel;
  method: string;
  path: string;
  notes: string;
}

export const GHL_API_COVERAGE: readonly CoverageRow[] = [
  {
    entity: 'users',
    level: 'api',
    method: 'GET',
    path: '/users/',
    notes: 'Filter by locationId. Map by email.',
  },
  {
    entity: 'tags',
    level: 'api',
    method: 'GET',
    path: '/locations/:locationId/tags',
    notes: 'Full list.',
  },
  {
    entity: 'customFields',
    level: 'api',
    method: 'GET',
    path: '/locations/:locationId/customFields',
    notes: 'Definitions. Model is TEXT/NUMERICAL/etc.',
  },
  {
    entity: 'companies',
    level: 'api',
    method: 'GET',
    path: '/businesses/',
    notes: 'locationId query.',
  },
  {
    entity: 'contacts',
    level: 'api',
    method: 'GET',
    path: '/contacts/',
    notes: 'List via GET /contacts/ (startAfterId). POST /contacts/search 400s on unfiltered dumps.',
  },
  {
    entity: 'contactNotes',
    level: 'api',
    method: 'GET',
    path: '/contacts/:contactId/notes',
    notes: 'Per-contact. Rate-limit heavy on large books.',
  },
  {
    entity: 'tasks',
    level: 'api',
    method: 'GET',
    path: '/locations/:locationId/tasks',
    notes: 'Location task list. Overdue open tasks import unassigned.',
  },
  {
    entity: 'pipelines',
    level: 'api',
    method: 'GET',
    path: '/opportunities/pipelines',
    notes: 'Includes stages.',
  },
  {
    entity: 'deals',
    level: 'api',
    method: 'GET',
    path: '/opportunities/search',
    notes: 'Paginated opportunities.',
  },
  {
    entity: 'calendars',
    level: 'api',
    method: 'GET',
    path: '/calendars/',
    notes: 'locationId query.',
  },
  {
    entity: 'appointments',
    level: 'api',
    method: 'GET',
    path: '/calendars/events',
    notes: 'Needs start/end window. Importer walks month windows.',
  },
  {
    entity: 'conversations',
    level: 'api',
    method: 'GET',
    path: '/conversations/search',
    notes: 'locationId + pagination.',
  },
  {
    entity: 'messages',
    level: 'api',
    method: 'GET',
    path: '/conversations/:id/messages',
    notes: 'Per conversation. Attachments are URLs when present.',
  },
  {
    entity: 'lists',
    level: 'partial-api',
    method: 'GET',
    path: '/locations/:locationId/tags',
    notes: 'No first-class lists API. Tags + mapping UI stand in.',
  },
  {
    entity: 'listMemberships',
    level: 'partial-api',
    method: 'GET',
    path: '/contacts/',
    notes: 'Contact tags used as list membership when mapped.',
  },
  {
    entity: 'segments',
    level: 'csv-fallback',
    method: 'GET',
    path: '/locations/:locationId/tags',
    notes: 'No smart-list API. Importer creates named segments from tags.',
  },
  {
    entity: 'forms',
    level: 'api',
    method: 'GET',
    path: '/forms/',
    notes: 'Form list. Field schema is not pixel-identical to Seedly builder.',
  },
  {
    entity: 'formSubmissions',
    level: 'api',
    method: 'GET',
    path: '/forms/submissions',
    notes: 'locationId + formId query.',
  },
  {
    entity: 'campaigns',
    level: 'api',
    method: 'GET',
    path: '/campaigns/',
    notes: 'Metadata only. Cannot resume a live send.',
  },
  {
    entity: 'workflows',
    level: 'partial-api',
    method: 'GET',
    path: '/workflows/',
    notes: 'Definitions exist. Node graph cannot be translated 1:1.',
  },
  {
    entity: 'products',
    level: 'api',
    method: 'GET',
    path: '/products/',
    notes: 'Catalog. No Stripe IDs.',
  },
  {
    entity: 'invoices',
    level: 'api',
    method: 'GET',
    path: '/invoices/',
    notes: 'History. Payment processor IDs discarded.',
  },
  {
    entity: 'estimates',
    level: 'api',
    method: 'GET',
    path: '/invoices/estimate',
    notes: 'Estimate list.',
  },
  {
    entity: 'callLogs',
    level: 'partial-api',
    method: 'GET',
    path: '/conversations/search',
    notes: 'Voice conversations only. Recordings typically not exportable.',
  },
  {
    entity: 'socialPosts',
    level: 'api',
    method: 'GET',
    path: '/social-media-posting/:locationId/posts',
    notes: 'Copy + schedule. Accounts must reconnect.',
  },
  {
    entity: 'reviews',
    level: 'partial-api',
    method: 'GET',
    path: '/reputation/reviews',
    notes: 'Optional. Coverage varies by GHL reputation product. GBP reconnect required.',
  },
  {
    entity: 'phoneNumbers',
    level: 'reconnect',
    method: '—',
    path: '—',
    notes: 'Must buy/port in Seedly.',
  },
  {
    entity: 'emailDomains',
    level: 'reconnect',
    method: '—',
    path: '—',
    notes: 'Re-verify in Seedly.',
  },
  {
    entity: 'stripe',
    level: 'reconnect',
    method: '—',
    path: '—',
    notes: 'Connect Stripe again.',
  },
  {
    entity: 'a2p',
    level: 'unsupported',
    method: '—',
    path: '—',
    notes: 'New 10DLC registration required.',
  },
];

export function coverageForEntity(entity: CoverageRow['entity']): CoverageRow | undefined {
  return GHL_API_COVERAGE.find((r) => r.entity === entity);
}

export function apiBackedEntities(): CoverageRow[] {
  return GHL_API_COVERAGE.filter((r) => r.level === 'api' || r.level === 'partial-api');
}
