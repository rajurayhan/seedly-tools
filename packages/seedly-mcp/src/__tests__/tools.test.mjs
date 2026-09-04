import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED_V1_TOOLS, TOOLS, getTool, toolRoute, resolveRequest } from '../../files/packages/seedly-mcp/lib/tools.mjs';

const EXPECTED = {
  list_contacts: ['GET', '/api/v1/contacts'],
  get_contact: ['GET', '/api/v1/contacts/{id}'],
  list_contact_fields: ['GET', '/api/v1/contacts/fields'],
  create_contact: ['POST', '/api/v1/contacts'],
  update_contact: ['PATCH', '/api/v1/contacts/{id}'],
  list_conversations: ['GET', '/api/v1/conversations'],
  get_conversation: ['GET', '/api/v1/conversations/{id}'],
  list_messages: ['GET', '/api/v1/conversations/{id}/messages'],
  list_calendars: ['GET', '/api/v1/calendars'],
  list_calendar_types: ['GET', '/api/v1/calendars/types'],
  get_availability: ['GET', '/api/v1/calendars/availability'],
  list_appointments: ['GET', '/api/v1/calendars/appointments'],
  get_appointment: ['GET', '/api/v1/calendars/appointments/{id}'],
  create_appointment: ['POST', '/api/v1/calendars/appointments'],
  list_tasks: ['GET', '/api/v1/tasks'],
  get_task: ['GET', '/api/v1/tasks/{id}'],
  create_task: ['POST', '/api/v1/tasks'],
  complete_task: ['PUT', '/api/v1/tasks/{id}/complete'],
  list_opportunities: ['GET', '/api/v1/opportunities'],
  get_opportunity: ['GET', '/api/v1/opportunities/{id}'],
  create_opportunity: ['POST', '/api/v1/opportunities'],
  update_opportunity_status: ['PUT', '/api/v1/opportunities/{id}/status'],
  update_opportunity_stage: ['PUT', '/api/v1/opportunities/{id}/stage'],
  list_pipelines: ['GET', '/api/v1/pipelines'],
  list_invoices: ['GET', '/api/v1/invoices'],
  get_invoice: ['GET', '/api/v1/invoices/{id}'],
  list_estimates: ['GET', '/api/v1/estimates'],
  get_estimate: ['GET', '/api/v1/estimates/{id}'],
  list_sub_accounts: ['GET', '/api/v1/sub-accounts'],
};

test('every v1 tool maps to one /api/v1 method + path', () => {
  assert.equal(Object.keys(EXPECTED).length, TOOLS.length);
  for (const [name, [method, path]] of Object.entries(EXPECTED)) {
    const route = toolRoute(name);
    assert.ok(route, name);
    assert.equal(route.method, method, name);
    assert.equal(route.path, path, name);
  }
});

test('blocked send/money tools are not in the catalog', () => {
  const names = new Set(TOOLS.map((t) => t.name));
  for (const blocked of BLOCKED_V1_TOOLS) {
    assert.equal(names.has(blocked), false, blocked);
  }
  assert.equal(names.has('send_conversation_message'), false);
});

test('resolveRequest fills path ids and leaves body fields', () => {
  const tool = getTool('update_contact');
  const req = resolveRequest(tool, { id: 'abc', firstName: 'Jane' });
  assert.equal(req.method, 'PATCH');
  assert.equal(req.path, '/api/v1/contacts/abc');
  assert.deepEqual(req.body, { firstName: 'Jane' });
});
