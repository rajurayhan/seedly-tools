/** Official GHL API v2 read-only scopes used by the Seedly importer. */

export type GhlScopeGroup = 'core' | 'comms' | 'marketing' | 'commerce' | 'optional';

export interface GhlScopeDef {
  scope: string;
  group: GhlScopeGroup;
  label: string;
  purpose: string;
}

export const GHL_READ_SCOPES: readonly GhlScopeDef[] = [
  {
    scope: 'locations.readonly',
    group: 'core',
    label: 'Locations',
    purpose: 'Validate the token and read the location name',
  },
  {
    scope: 'users.readonly',
    group: 'core',
    label: 'Users',
    purpose: 'Map GHL users to Seedly assignees',
  },
  {
    scope: 'contacts.readonly',
    group: 'core',
    label: 'Contacts',
    purpose: 'Contacts, notes, and contact tasks',
  },
  {
    scope: 'businesses.readonly',
    group: 'core',
    label: 'Companies',
    purpose: 'Business / company records',
  },
  { scope: 'locations/tags.readonly', group: 'core', label: 'Tags', purpose: 'Location tags' },
  {
    scope: 'locations/customFields.readonly',
    group: 'core',
    label: 'Custom fields',
    purpose: 'Custom field definitions',
  },
  {
    scope: 'locations/customValues.readonly',
    group: 'core',
    label: 'Custom values',
    purpose: 'Location custom values',
  },
  {
    scope: 'opportunities.readonly',
    group: 'core',
    label: 'Opportunities',
    purpose: 'Pipelines and opportunities',
  },
  {
    scope: 'locations/tasks.readonly',
    group: 'core',
    label: 'Tasks',
    purpose: 'Location task search',
  },
  {
    scope: 'conversations.readonly',
    group: 'comms',
    label: 'Conversations',
    purpose: 'Conversation threads',
  },
  {
    scope: 'conversations/message.readonly',
    group: 'comms',
    label: 'Messages',
    purpose: 'SMS, email, and DM history',
  },
  {
    scope: 'calendars.readonly',
    group: 'comms',
    label: 'Calendars',
    purpose: 'Calendar definitions',
  },
  {
    scope: 'calendars/events.readonly',
    group: 'comms',
    label: 'Appointments',
    purpose: 'Booked events',
  },
  {
    scope: 'calendars/groups.readonly',
    group: 'comms',
    label: 'Calendar groups',
    purpose: 'Calendar grouping',
  },
  {
    scope: 'calendars/resources.readonly',
    group: 'comms',
    label: 'Calendar resources',
    purpose: 'Rooms and equipment',
  },
  {
    scope: 'campaigns.readonly',
    group: 'marketing',
    label: 'Campaigns',
    purpose: 'Historical campaigns',
  },
  { scope: 'forms.readonly', group: 'marketing', label: 'Forms', purpose: 'Forms and submissions' },
  {
    scope: 'workflows.readonly',
    group: 'marketing',
    label: 'Workflows',
    purpose: 'Automation definitions (imported as drafts)',
  },
  {
    scope: 'invoices.readonly',
    group: 'commerce',
    label: 'Invoices',
    purpose: 'Invoice history (read-only)',
  },
  {
    scope: 'invoices/schedule.readonly',
    group: 'commerce',
    label: 'Invoice schedules',
    purpose: 'Recurring invoice schedules',
  },
  {
    scope: 'invoices/template.readonly',
    group: 'commerce',
    label: 'Invoice templates',
    purpose: 'Invoice templates',
  },
  {
    scope: 'invoices/estimate.readonly',
    group: 'commerce',
    label: 'Estimates',
    purpose: 'Estimates / proposals',
  },
  { scope: 'products.readonly', group: 'commerce', label: 'Products', purpose: 'Product catalog' },
  {
    scope: 'products/prices.readonly',
    group: 'commerce',
    label: 'Prices',
    purpose: 'Product prices',
  },
  {
    scope: 'products/collection.readonly',
    group: 'commerce',
    label: 'Collections',
    purpose: 'Product collections',
  },
  {
    scope: 'payments/orders.readonly',
    group: 'commerce',
    label: 'Orders',
    purpose: 'Payment orders (reconnect Stripe separately)',
  },
  {
    scope: 'payments/transactions.readonly',
    group: 'commerce',
    label: 'Transactions',
    purpose: 'Payment transactions',
  },
  {
    scope: 'payments/subscriptions.readonly',
    group: 'commerce',
    label: 'Subscriptions',
    purpose: 'GHL subscriptions (do not transfer to Stripe)',
  },
  {
    scope: 'emails/builder.readonly',
    group: 'optional',
    label: 'Email builder',
    purpose: 'Email templates',
  },
  {
    scope: 'documents_contracts/list.readonly',
    group: 'optional',
    label: 'Documents',
    purpose: 'Contracts metadata',
  },
  {
    scope: 'documents_contracts_templates/list.readonly',
    group: 'optional',
    label: 'Document templates',
    purpose: 'Contract templates',
  },
  { scope: 'medias.readonly', group: 'optional', label: 'Media', purpose: 'Media library files' },
  {
    scope: 'objects/schema.readonly',
    group: 'optional',
    label: 'Custom objects',
    purpose: 'Custom object schemas',
  },
  {
    scope: 'objects/record.readonly',
    group: 'optional',
    label: 'Custom object records',
    purpose: 'Custom object rows',
  },
  {
    scope: 'socialplanner/post.readonly',
    group: 'optional',
    label: 'Social posts',
    purpose: 'Published / scheduled social posts',
  },
  {
    scope: 'socialplanner/account.readonly',
    group: 'optional',
    label: 'Social accounts',
    purpose: 'Connected social accounts (reconnect in Seedly)',
  },
  {
    scope: 'reputation.readonly',
    group: 'optional',
    label: 'Reviews',
    purpose: 'Reputation / review history (optional)',
  },
] as const;

export const GHL_SCOPE_GROUPS: Record<GhlScopeGroup, string> = {
  core: 'Core CRM (required to start)',
  comms: 'Conversations & calendars',
  marketing: 'Campaigns, forms & workflows',
  commerce: 'Products, invoices & estimates',
  optional: 'Optional (social, documents, custom objects)',
};

export function scopesForGroup(group: GhlScopeGroup): readonly GhlScopeDef[] {
  return GHL_READ_SCOPES.filter((s) => s.group === group);
}

export function allScopeNames(): string[] {
  return GHL_READ_SCOPES.map((s) => s.scope);
}

export function formatScopeChecklist(): string {
  const lines: string[] = [
    'Tick these View / Read scopes when creating the Private Integration.',
    'Do not tick Write scopes — Seedly only reads from GoHighLevel.',
    '',
  ];
  for (const [group, title] of Object.entries(GHL_SCOPE_GROUPS) as [GhlScopeGroup, string][]) {
    lines.push(title);
    for (const def of scopesForGroup(group)) {
      lines.push(`  - ${def.scope}  (${def.purpose})`);
    }
    lines.push('');
  }
  lines.push('Shortcut: if you want everything, tick every View / Read scope GHL offers.');
  return lines.join('\n');
}
