/**
 * Display grouping for the SeedlyMCP setup page.
 * Keep names in sync with TOOLS in tools.mjs — tests assert full coverage.
 */

import { BLOCKED_V1_TOOLS, TOOLS } from './tools.mjs';

/** @typedef {{ title: string, names: readonly string[] }} ToolGroup */

/** @type {readonly ToolGroup[]} */
export const TOOL_GROUPS = [
  {
    title: 'Account',
    names: ['get_me', 'get_location'],
  },
  {
    title: 'Contacts',
    names: ['list_contacts', 'get_contact', 'list_contact_fields', 'create_contact', 'update_contact'],
  },
  {
    title: 'Conversations',
    names: ['list_conversations', 'get_conversation', 'list_messages'],
  },
  {
    title: 'Calendars',
    names: [
      'list_calendars',
      'list_calendar_types',
      'get_availability',
      'list_appointments',
      'get_appointment',
      'create_appointment',
    ],
  },
  {
    title: 'Tasks',
    names: ['list_tasks', 'get_task', 'create_task', 'complete_task'],
  },
  {
    title: 'Opportunities',
    names: [
      'list_opportunities',
      'get_opportunity',
      'create_opportunity',
      'update_opportunity_status',
      'update_opportunity_stage',
      'list_pipelines',
    ],
  },
  {
    title: 'Invoices & estimates',
    names: ['list_invoices', 'get_invoice', 'list_estimates', 'get_estimate'],
  },
  {
    title: 'Locations',
    names: ['list_sub_accounts'],
  },
];

/** @type {Readonly<Record<string, string>>} */
export const BLOCKED_TOOL_LABELS = {
  send_conversation_message: 'Send a conversation message',
  send_invoice: 'Send an invoice',
  void_invoice: 'Void an invoice',
  mark_invoice_paid: 'Mark an invoice paid',
  refund_invoice: 'Refund an invoice',
  send_estimate: 'Send an estimate',
  accept_estimate: 'Accept an estimate',
  decline_estimate: 'Decline an estimate',
  convert_estimate_to_invoice: 'Convert an estimate to an invoice',
  send_campaign: 'Send a campaign',
  schedule_campaign: 'Schedule a campaign',
  create_webhook: 'Create a webhook',
  delete_webhook: 'Delete a webhook',
};

export function groupedCatalog(tools = TOOLS) {
  return TOOL_GROUPS.map((group) => ({
    title: group.title,
    tools: group.names.map((name) => {
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        throw new Error(`Tool group "${group.title}" references missing tool: ${name}`);
      }
      return tool;
    }),
  }));
}

export function catalogCoverage(tools = TOOLS) {
  const grouped = TOOL_GROUPS.flatMap((group) => group.names);
  const actual = tools.map((t) => t.name);
  const missing = actual.filter((name) => !grouped.includes(name));
  const extra = grouped.filter((name) => !actual.includes(name));
  const duplicates = grouped.filter((name, i) => grouped.indexOf(name) !== i);
  return { missing, extra, duplicates };
}

export function blockedToolRows(blocked = BLOCKED_V1_TOOLS) {
  return blocked.map((name) => ({
    name,
    label: BLOCKED_TOOL_LABELS[name] ?? name.replaceAll('_', ' '),
  }));
}
