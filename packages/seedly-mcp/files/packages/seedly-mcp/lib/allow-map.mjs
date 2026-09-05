/**
 * Explicit OpenAPI operationId → MCP tool name.
 * Do not derive names by snake_casing — ids and tool names are not 1:1.
 */

/** @typedef {{ operationId: string, name: string }} AllowEntry */

/** @type {readonly AllowEntry[]} */
export const ALLOW_MAP = [
  { operationId: 'getMe', name: 'get_me' },
  { operationId: 'getLocation', name: 'get_location' },
  { operationId: 'listContacts', name: 'list_contacts' },
  { operationId: 'getContact', name: 'get_contact' },
  { operationId: 'listContactFields', name: 'list_contact_fields' },
  { operationId: 'createContact', name: 'create_contact' },
  { operationId: 'updateContact', name: 'update_contact' },
  { operationId: 'listConversations', name: 'list_conversations' },
  { operationId: 'getConversation', name: 'get_conversation' },
  { operationId: 'listMessages', name: 'list_messages' },
  { operationId: 'listCalendars', name: 'list_calendars' },
  { operationId: 'listAppointmentTypes', name: 'list_calendar_types' },
  { operationId: 'getAvailability', name: 'get_availability' },
  { operationId: 'listAppointments', name: 'list_appointments' },
  { operationId: 'getAppointment', name: 'get_appointment' },
  { operationId: 'bookAppointment', name: 'create_appointment' },
  { operationId: 'listTasks', name: 'list_tasks' },
  { operationId: 'getTask', name: 'get_task' },
  { operationId: 'createTask', name: 'create_task' },
  { operationId: 'completeTask', name: 'complete_task' },
  { operationId: 'listOpportunities', name: 'list_opportunities' },
  { operationId: 'getOpportunity', name: 'get_opportunity' },
  { operationId: 'createOpportunity', name: 'create_opportunity' },
  { operationId: 'setOpportunityStatus', name: 'update_opportunity_status' },
  { operationId: 'moveOpportunityStage', name: 'update_opportunity_stage' },
  { operationId: 'listPipelines', name: 'list_pipelines' },
  { operationId: 'listInvoices', name: 'list_invoices' },
  { operationId: 'getInvoice', name: 'get_invoice' },
  { operationId: 'listEstimates', name: 'list_estimates' },
  { operationId: 'getEstimate', name: 'get_estimate' },
  { operationId: 'listSubAccounts', name: 'list_sub_accounts' },
];

/** Tools that send money or messages. Not shipped in v1. */
export const BLOCKED_V1_TOOLS = [
  'send_conversation_message',
  'send_invoice',
  'void_invoice',
  'mark_invoice_paid',
  'refund_invoice',
  'send_estimate',
  'accept_estimate',
  'decline_estimate',
  'convert_estimate_to_invoice',
  'send_campaign',
  'schedule_campaign',
  'create_webhook',
  'delete_webhook',
];

/** OpenAPI operationIds that must never become tools, even if someone adds them to ALLOW_MAP. */
export const BLOCKED_OPERATION_IDS = new Set([
  'sendMessage',
  'createConversation',
  'deleteContact',
  'listWebhookSubscriptions',
  'createWebhookSubscription',
  'updateWebhookSubscription',
  'deleteWebhookSubscription',
  'regenerateWebhookSecret',
  'createInvoice',
  'sendInvoice',
  'voidInvoice',
  'markInvoicePaid',
  'recordInvoicePayment',
  'refundInvoice',
  'deleteInvoice',
  'duplicateInvoice',
  'createEstimate',
  'sendEstimate',
  'acceptEstimate',
  'declineEstimate',
  'convertEstimateToInvoice',
  'deleteEstimate',
  'duplicateEstimate',
  'createCampaign',
  'sendCampaign',
  'scheduleCampaign',
  'cancelAppointment',
  'updateTask',
  'deleteTask',
  'updateOpportunity',
  'deleteOpportunity',
]);

export const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'PUT']);
