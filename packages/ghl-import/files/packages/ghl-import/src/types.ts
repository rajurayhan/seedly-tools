export type GhlTokenKind = 'location' | 'agency';

export interface GhlLocationSummary {
  id: string;
  name: string;
  address?: string;
}

export interface ValidateTokenResult {
  kind: GhlTokenKind;
  locations: GhlLocationSummary[];
  selectedLocation?: GhlLocationSummary;
  missingScopes: string[];
}

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  website?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  source?: string;
  tags?: string[];
  customFields?: Array<{ id?: string; key?: string; field_value?: unknown; value?: unknown }>;
  /** GHL sends a boolean or a per-channel object. Unknown shapes are rejected at map time. */
  dnd?: unknown;
  dndSettings?: unknown;
  dateAdded?: string;
  dateUpdated?: string;
  assignedTo?: string;
  companyId?: string;
}

export interface GhlBusiness {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface GhlTag {
  id: string;
  name: string;
}

export interface GhlCustomField {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
  options?: Array<{ key?: string; label?: string } | string>;
  position?: number;
}

export interface GhlNote {
  id: string;
  body?: string;
  dateAdded?: string;
  userId?: string;
}

export interface GhlPipelineStage {
  id: string;
  name: string;
  position?: number;
}

export interface GhlPipeline {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
}

export interface GhlOpportunity {
  id: string;
  name?: string;
  monetaryValue?: number;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  contactId?: string;
  assignedTo?: string;
  source?: string;
}

export interface GhlCalendar {
  id: string;
  name?: string;
  description?: string;
  timezone?: string;
  calendarType?: string;
}

export interface GhlAppointment {
  id: string;
  title?: string;
  calendarId?: string;
  contactId?: string;
  assignedUserId?: string;
  startTime?: string;
  endTime?: string;
  appointmentStatus?: string;
  notes?: string;
}

export interface GhlConversation {
  id: string;
  contactId?: string;
  type?: string;
  lastMessageBody?: string;
  lastMessageDate?: string;
  unreadCount?: number;
  assignedTo?: string;
}

export interface GhlMessageAttachment {
  url?: string;
  name?: string;
  contentType?: string;
  size?: number;
}

export interface GhlMessage {
  id: string;
  conversationId?: string;
  body?: string;
  direction?: string;
  type?: number | string;
  dateAdded?: string;
  status?: string;
  attachments?: GhlMessageAttachment[];
}

export interface GhlTask {
  id: string;
  title?: string;
  body?: string;
  dueDate?: string;
  completed?: boolean;
  assignedTo?: string;
  contactId?: string;
}

export interface GhlForm {
  id: string;
  name?: string;
  fields?: Array<{ id?: string; name?: string; type?: string; required?: boolean }>;
}

export interface GhlFormSubmission {
  id: string;
  formId?: string;
  contactId?: string;
  others?: Record<string, unknown>;
  createdAt?: string;
}

export interface GhlCampaign {
  id: string;
  name?: string;
  status?: string;
}

export interface GhlWorkflow {
  id: string;
  name?: string;
  status?: string;
}

export interface GhlProduct {
  id: string;
  name?: string;
  description?: string;
  availableInStore?: boolean;
  prices?: Array<{ amount?: number; currency?: string }>;
}

export interface GhlInvoice {
  id: string;
  invoiceNumber?: string;
  status?: string;
  contactDetails?: { id?: string; name?: string };
  total?: number;
  amountDue?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  items?: Array<{ name?: string; qty?: number; amount?: number }>;
}

export interface GhlEstimate {
  id: string;
  name?: string;
  status?: string;
  contactId?: string;
  total?: number;
  currency?: string;
  items?: Array<{ name?: string; qty?: number; amount?: number }>;
}

export interface GhlUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface GhlSocialPost {
  id: string;
  message?: string;
  status?: string;
  scheduledFor?: string;
  publishedAt?: string;
  accountIds?: string[];
}

export interface GhlReview {
  id: string;
  reviewerName?: string;
  rating?: number;
  content?: string;
  date?: string;
  platform?: string;
  reply?: string;
}

export type GhlJson = Record<string, unknown>;

export function asRecord(value: unknown): GhlJson {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as GhlJson)
    : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
