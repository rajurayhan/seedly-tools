/** Importable GHL entity catalog and FK-safe run order. */

export type GhlEntityId =
  | 'users'
  | 'tags'
  | 'customFields'
  | 'companies'
  | 'contacts'
  | 'contactNotes'
  | 'tasks'
  | 'pipelines'
  | 'deals'
  | 'calendars'
  | 'appointments'
  | 'conversations'
  | 'messages'
  | 'lists'
  | 'listMemberships'
  | 'segments'
  | 'forms'
  | 'formSubmissions'
  | 'campaigns'
  | 'workflows'
  | 'products'
  | 'invoices'
  | 'estimates'
  | 'callLogs'
  | 'socialPosts'
  | 'reviews';

export type GhlEntityCategory =
  | 'core'
  | 'comms'
  | 'marketing'
  | 'automation'
  | 'commerce'
  | 'optional';

export interface GhlEntityDef {
  id: GhlEntityId;
  label: string;
  category: GhlEntityCategory;
  requiredScopes: readonly string[];
  dependsOn: readonly GhlEntityId[];
  /** How well this maps into Seedly. */
  fidelity: 'full' | 'partial' | 'degraded' | 'metadata';
  notes: string;
}

export const GHL_ENTITIES: readonly GhlEntityDef[] = [
  {
    id: 'users',
    label: 'Users (mapping only)',
    category: 'core',
    requiredScopes: ['users.readonly'],
    dependsOn: [],
    fidelity: 'partial',
    notes: 'Maps GHL users to existing Seedly users by email. Does not create logins.',
  },
  {
    id: 'tags',
    label: 'Tags',
    category: 'core',
    requiredScopes: ['locations/tags.readonly'],
    dependsOn: [],
    fidelity: 'full',
    notes: 'Creates missing tags in the location tag registry.',
  },
  {
    id: 'customFields',
    label: 'Custom fields',
    category: 'core',
    requiredScopes: ['locations/customFields.readonly'],
    dependsOn: [],
    fidelity: 'full',
    notes: 'Field definitions. Values arrive on contacts.',
  },
  {
    id: 'companies',
    label: 'Companies',
    category: 'core',
    requiredScopes: ['businesses.readonly'],
    dependsOn: [],
    fidelity: 'full',
    notes: 'GHL businesses → Seedly companies.',
  },
  {
    id: 'contacts',
    label: 'Contacts',
    category: 'core',
    requiredScopes: ['contacts.readonly'],
    dependsOn: ['companies', 'tags', 'customFields', 'users'],
    fidelity: 'full',
    notes: 'Dedupes by email then phone. Does not fabricate marketing consent.',
  },
  {
    id: 'contactNotes',
    label: 'Contact notes',
    category: 'core',
    requiredScopes: ['contacts.readonly'],
    dependsOn: ['contacts'],
    fidelity: 'full',
    notes: 'Notes attached to imported contacts.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    category: 'core',
    requiredScopes: ['locations/tasks.readonly'],
    dependsOn: ['contacts', 'users'],
    fidelity: 'full',
    notes: 'Imported under one "Imported from HighLevel" project. Overdue open tasks stay unassigned.',
  },
  {
    id: 'pipelines',
    label: 'Pipelines & stages',
    category: 'core',
    requiredScopes: ['opportunities.readonly'],
    dependsOn: [],
    fidelity: 'full',
    notes: 'Creates pipelines and stages. Mapping UI can remap stage names.',
  },
  {
    id: 'deals',
    label: 'Opportunities',
    category: 'core',
    requiredScopes: ['opportunities.readonly'],
    dependsOn: ['contacts', 'pipelines', 'users'],
    fidelity: 'full',
    notes: 'GHL opportunities → Seedly deals.',
  },
  {
    id: 'calendars',
    label: 'Calendars',
    category: 'comms',
    requiredScopes: ['calendars.readonly'],
    dependsOn: ['users'],
    fidelity: 'partial',
    notes: 'Calendar definitions. Google/Outlook sync must be reconnected.',
  },
  {
    id: 'appointments',
    label: 'Appointments',
    category: 'comms',
    requiredScopes: ['calendars/events.readonly'],
    dependsOn: ['calendars', 'contacts', 'users'],
    fidelity: 'full',
    notes: 'Booked events. Staff mapping uses the user map.',
  },
  {
    id: 'conversations',
    label: 'Conversations',
    category: 'comms',
    requiredScopes: ['conversations.readonly'],
    dependsOn: ['contacts'],
    fidelity: 'partial',
    notes: 'One thread per contact + channel when GHL provides it.',
  },
  {
    id: 'messages',
    label: 'Messages',
    category: 'comms',
    requiredScopes: ['conversations/message.readonly'],
    dependsOn: ['conversations'],
    fidelity: 'partial',
    notes: 'Historical SMS/email/DM. Attachments fetched when URLs are present.',
  },
  {
    id: 'lists',
    label: 'Email lists',
    category: 'marketing',
    requiredScopes: ['contacts.readonly'],
    dependsOn: [],
    fidelity: 'partial',
    notes: 'GHL does not expose a first-class lists API. Tags used as list names when mapped.',
  },
  {
    id: 'listMemberships',
    label: 'List memberships',
    category: 'marketing',
    requiredScopes: ['contacts.readonly'],
    dependsOn: ['lists', 'contacts'],
    fidelity: 'partial',
    notes: 'Manual memberships only. No fabricated marketing consent.',
  },
  {
    id: 'segments',
    label: 'Segments',
    category: 'marketing',
    requiredScopes: ['contacts.readonly'],
    dependsOn: ['tags'],
    fidelity: 'degraded',
    notes: 'GHL has no smart-list API. Creates named segments from tags; rebuild filters in Seedly.',
  },
  {
    id: 'forms',
    label: 'Forms',
    category: 'marketing',
    requiredScopes: ['forms.readonly'],
    dependsOn: [],
    fidelity: 'partial',
    notes: 'Structure + fields. Layout will not be pixel-identical.',
  },
  {
    id: 'formSubmissions',
    label: 'Form submissions',
    category: 'marketing',
    requiredScopes: ['forms.readonly'],
    dependsOn: ['forms', 'contacts'],
    fidelity: 'full',
    notes: 'Submission payloads linked to imported contacts when possible.',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    category: 'marketing',
    requiredScopes: ['campaigns.readonly'],
    dependsOn: [],
    fidelity: 'metadata',
    notes: 'Historical records only. Live sends cannot be resumed.',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    category: 'automation',
    requiredScopes: ['workflows.readonly'],
    dependsOn: [],
    fidelity: 'degraded',
    notes: 'Imported as draft templates plus a rebuild checklist. GHL ≠ Seedly DAG.',
  },
  {
    id: 'products',
    label: 'Products',
    category: 'commerce',
    requiredScopes: ['products.readonly'],
    dependsOn: [],
    fidelity: 'partial',
    notes: 'Catalog only. Stripe IDs are not transferred.',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    category: 'commerce',
    requiredScopes: ['invoices.readonly'],
    dependsOn: ['contacts', 'products'],
    fidelity: 'partial',
    notes: 'Read-only financial history. Reconnect Stripe to collect new payments.',
  },
  {
    id: 'estimates',
    label: 'Estimates',
    category: 'commerce',
    requiredScopes: ['invoices/estimate.readonly'],
    dependsOn: ['contacts', 'products'],
    fidelity: 'partial',
    notes: 'Read-only proposals. E-sign is not replayed.',
  },
  {
    id: 'callLogs',
    label: 'Call logs',
    category: 'optional',
    requiredScopes: ['conversations.readonly'],
    dependsOn: ['contacts'],
    fidelity: 'metadata',
    notes: 'Call metadata only. Recordings usually cannot be exported.',
  },
  {
    id: 'socialPosts',
    label: 'Social posts',
    category: 'optional',
    requiredScopes: ['socialplanner/post.readonly'],
    dependsOn: [],
    fidelity: 'metadata',
    notes: 'Post copy and schedule. Accounts must be reconnected in Seedly.',
  },
  {
    id: 'reviews',
    label: 'Reviews',
    category: 'optional',
    requiredScopes: ['reputation.readonly'],
    dependsOn: [],
    fidelity: 'partial',
    notes: 'Review copy and rating when the reputation API is in scope. Google/GBP must reconnect.',
  },
];

export const GHL_IMPORT_ORDER: readonly GhlEntityId[] = [
  'users',
  'tags',
  'customFields',
  'companies',
  'contacts',
  'contactNotes',
  'tasks',
  'pipelines',
  'deals',
  'calendars',
  'appointments',
  'conversations',
  'messages',
  'lists',
  'listMemberships',
  'segments',
  'forms',
  'formSubmissions',
  'campaigns',
  'workflows',
  'products',
  'invoices',
  'estimates',
  'callLogs',
  'socialPosts',
  'reviews',
];

export const MANUAL_FOLLOW_UPS = [
  {
    id: 'phone-numbers',
    title: 'Phone numbers',
    detail: 'Buy or port numbers in Seedly. GHL numbers do not transfer.',
  },
  {
    id: 'a2p',
    title: 'A2P 10DLC',
    detail: 'US outbound SMS needs a new brand + campaign registration.',
  },
  {
    id: 'email-domains',
    title: 'Email domains',
    detail: 'Verify sending domains in Seedly (Settings → Integrations → Email).',
  },
  {
    id: 'stripe',
    title: 'Stripe',
    detail: 'Connect Stripe again. Customer and subscription IDs do not transfer.',
  },
  {
    id: 'oauth',
    title: 'Google / Meta / social',
    detail: 'Reconnect OAuth apps. Tokens from GHL are not reusable.',
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    detail: 'Recreate outbound webhooks pointing at Seedly URLs.',
  },
  {
    id: 'workflows',
    title: 'Workflows',
    detail: 'Rebuild active automations. Imported workflows stay draft.',
  },
] as const;

export function entityById(id: GhlEntityId): GhlEntityDef {
  const found = GHL_ENTITIES.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown GHL entity: ${id}`);
  return found;
}

export function defaultSelectedEntities(): GhlEntityId[] {
  return GHL_ENTITIES.filter((e) => e.category !== 'optional').map((e) => e.id);
}
