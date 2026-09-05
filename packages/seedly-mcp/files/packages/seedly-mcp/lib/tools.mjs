/**
 * SeedlyMCP v1 tool catalog. Each tool is a thin wrap of one /api/v1 route.
 * Verbs follow OpenAPI when the build sheet and spec disagree.
 */

/** @typedef {{ name: string, method: 'GET'|'POST'|'PATCH'|'PUT', path: string, description: string, pathParams?: string[], queryParams?: string[], bodyParams?: string[], required?: string[] }} SeedlyMcpTool */

/** @type {readonly SeedlyMcpTool[]} */
export const TOOLS = [
  {
    name: 'get_me',
    method: 'GET',
    path: '/api/v1/me',
    description: 'The user who authorized this connection (the API key owner).',
  },
  {
    name: 'get_location',
    method: 'GET',
    path: '/api/v1/location',
    description: 'The location (sub-account) this connection is authorized to use.',
  },
  {
    name: 'list_contacts',
    method: 'GET',
    path: '/api/v1/contacts',
    description: 'List, search, or filter contacts. Cursor pagination.',
    queryParams: [
      'email',
      'search',
      'lifecycleStage',
      'source',
      'tags',
      'assignedTo',
      'hasPhone',
      'limit',
      'cursor',
    ],
  },
  {
    name: 'get_contact',
    method: 'GET',
    path: '/api/v1/contacts/{id}',
    description: 'Get one contact by id.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'list_contact_fields',
    method: 'GET',
    path: '/api/v1/contacts/fields',
    description: 'List custom field definitions for the location.',
  },
  {
    name: 'create_contact',
    method: 'POST',
    path: '/api/v1/contacts',
    description: 'Create a contact. firstName and lastName are required. Email is merge-idempotent.',
    bodyParams: [
      'firstName',
      'lastName',
      'email',
      'phone',
      'company',
      'lifecycleStage',
      'tags',
      'source',
      'customFields',
    ],
    required: ['firstName', 'lastName'],
  },
  {
    name: 'update_contact',
    method: 'PATCH',
    path: '/api/v1/contacts/{id}',
    description: 'Partial-update a contact. Only send fields to change.',
    pathParams: ['id'],
    bodyParams: [
      'firstName',
      'lastName',
      'email',
      'phone',
      'company',
      'lifecycleStage',
      'tags',
      'customFields',
    ],
    required: ['id'],
  },
  {
    name: 'list_conversations',
    method: 'GET',
    path: '/api/v1/conversations',
    description: 'List conversations. Filter by contact, status, channel, or assignee.',
    queryParams: ['contactId', 'status', 'channel', 'assignedTo', 'limit'],
  },
  {
    name: 'get_conversation',
    method: 'GET',
    path: '/api/v1/conversations/{id}',
    description: 'Get one conversation by id.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'list_messages',
    method: 'GET',
    path: '/api/v1/conversations/{id}/messages',
    description: 'List messages in a conversation, newest first.',
    pathParams: ['id'],
    queryParams: ['limit', 'cursor'],
    required: ['id'],
  },
  {
    name: 'list_calendars',
    method: 'GET',
    path: '/api/v1/calendars',
    description: 'List active calendars for the location.',
  },
  {
    name: 'list_calendar_types',
    method: 'GET',
    path: '/api/v1/calendars/types',
    description: 'List appointment types. Optionally filter by calendarId.',
    queryParams: ['calendarId'],
  },
  {
    name: 'get_availability',
    method: 'GET',
    path: '/api/v1/calendars/availability',
    description: 'Get bookable slots for an appointment type on a date (YYYY-MM-DD).',
    queryParams: ['appointmentTypeId', 'date'],
    required: ['appointmentTypeId', 'date'],
  },
  {
    name: 'list_appointments',
    method: 'GET',
    path: '/api/v1/calendars/appointments',
    description: 'List appointments. Filter by calendar, date range, or status.',
    queryParams: ['calendarId', 'startDate', 'endDate', 'status', 'limit'],
  },
  {
    name: 'get_appointment',
    method: 'GET',
    path: '/api/v1/calendars/appointments/{id}',
    description: 'Get one appointment by id.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'create_appointment',
    method: 'POST',
    path: '/api/v1/calendars/appointments',
    description: 'Book an appointment.',
    bodyParams: [
      'appointmentTypeId',
      'startTime',
      'endTime',
      'firstName',
      'lastName',
      'email',
      'phone',
      'contactId',
      'notes',
    ],
    required: ['appointmentTypeId', 'startTime'],
  },
  {
    name: 'list_tasks',
    method: 'GET',
    path: '/api/v1/tasks',
    description: 'List tasks. Filter by status, assignee, contact, deal, or due dates.',
    queryParams: ['status', 'assignedTo', 'contactId', 'dealId', 'dueBefore', 'dueAfter', 'limit', 'cursor'],
  },
  {
    name: 'get_task',
    method: 'GET',
    path: '/api/v1/tasks/{id}',
    description: 'Get one task by id.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'create_task',
    method: 'POST',
    path: '/api/v1/tasks',
    description: 'Create a task.',
    bodyParams: ['title', 'description', 'dueDate', 'assignedTo', 'contactId', 'dealId', 'status'],
    required: ['title'],
  },
  {
    name: 'complete_task',
    method: 'PUT',
    path: '/api/v1/tasks/{id}/complete',
    description: 'Mark a task completed.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'list_opportunities',
    method: 'GET',
    path: '/api/v1/opportunities',
    description: 'List opportunities. Filter by pipeline, stage, contact, assignee, or status.',
    queryParams: ['pipelineId', 'stageId', 'contactId', 'assignedTo', 'status', 'limit', 'cursor'],
  },
  {
    name: 'get_opportunity',
    method: 'GET',
    path: '/api/v1/opportunities/{id}',
    description: 'Get one opportunity by id.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'create_opportunity',
    method: 'POST',
    path: '/api/v1/opportunities',
    description: 'Create an opportunity in a pipeline stage.',
    bodyParams: ['pipelineId', 'stageId', 'contactId', 'name', 'value', 'assignedTo'],
    required: ['pipelineId', 'stageId', 'contactId', 'name'],
  },
  {
    name: 'update_opportunity_status',
    method: 'PUT',
    path: '/api/v1/opportunities/{id}/status',
    description: 'Set opportunity status: open, won, lost, or abandoned. lostReason required when lost.',
    pathParams: ['id'],
    bodyParams: ['status', 'lostReason'],
    required: ['id', 'status'],
  },
  {
    name: 'update_opportunity_stage',
    method: 'PUT',
    path: '/api/v1/opportunities/{id}/stage',
    description: 'Move an opportunity to another stage in the same pipeline.',
    pathParams: ['id'],
    bodyParams: ['stageId', 'beforeDealId', 'afterDealId'],
    required: ['id', 'stageId'],
  },
  {
    name: 'list_pipelines',
    method: 'GET',
    path: '/api/v1/pipelines',
    description: 'List pipelines and stages for the location.',
  },
  {
    name: 'list_invoices',
    method: 'GET',
    path: '/api/v1/invoices',
    description: 'List invoices. Read only — send, void, mark-paid, and refund are not in v1.',
    queryParams: ['status', 'contactId', 'limit', 'cursor'],
  },
  {
    name: 'get_invoice',
    method: 'GET',
    path: '/api/v1/invoices/{id}',
    description: 'Get one invoice by id.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'list_estimates',
    method: 'GET',
    path: '/api/v1/estimates',
    description: 'List estimates. Read only — send, accept, decline, and convert are not in v1.',
    queryParams: ['status', 'contactId', 'limit', 'cursor'],
  },
  {
    name: 'get_estimate',
    method: 'GET',
    path: '/api/v1/estimates/{id}',
    description: 'Get one estimate by id.',
    pathParams: ['id'],
    required: ['id'],
  },
  {
    name: 'list_sub_accounts',
    method: 'GET',
    path: '/api/v1/sub-accounts',
    description: 'List locations the API key can reach. Agency keys need X-Location-Id on later calls.',
  },
];

export { BLOCKED_V1_TOOLS } from './allow-map.mjs';

export function getTool(name) {
  return TOOLS.find((t) => t.name === name) ?? null;
}

export function toolRoute(name) {
  const tool = getTool(name);
  if (!tool) return null;
  return { method: tool.method, path: tool.path };
}

function stringProp(description) {
  return { type: 'string', description };
}

export function inputSchemaFor(tool) {
  /** @type {Record<string, { type: string, description?: string }>} */
  const properties = {};
  const required = [...(tool.required ?? [])];
  for (const name of tool.pathParams ?? []) {
    properties[name] = stringProp(`Path id for ${tool.path}`);
  }
  for (const name of tool.queryParams ?? []) {
    properties[name] = stringProp(`Query ${name}`);
  }
  for (const name of tool.bodyParams ?? []) {
    properties[name] = { description: `Body field ${name}` };
  }
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: true,
  };
}

export function mcpToolsList() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: inputSchemaFor(tool),
  }));
}

export function resolveRequest(tool, args = {}) {
  const params = args && typeof args === 'object' ? { ...args } : {};
  let path = tool.path;
  for (const name of tool.pathParams ?? []) {
    const value = params[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing path parameter: ${name}`);
    }
    path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
    delete params[name];
  }
  /** @type {Record<string, string>} */
  const query = {};
  for (const name of tool.queryParams ?? []) {
    if (params[name] !== undefined && params[name] !== null && params[name] !== '') {
      query[name] = String(params[name]);
    }
    delete params[name];
  }
  const body = tool.method === 'GET' ? undefined : params;
  return { method: tool.method, path, query, body };
}
