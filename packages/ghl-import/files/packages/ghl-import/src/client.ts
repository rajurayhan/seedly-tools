import { GHL_DEFAULT_PAGE_SIZE, TokenBucket, sleep } from './rateLimit';
import type {
  GhlAppointment,
  GhlBusiness,
  GhlCalendar,
  GhlCampaign,
  GhlContact,
  GhlConversation,
  GhlCustomField,
  GhlEstimate,
  GhlForm,
  GhlFormSubmission,
  GhlInvoice,
  GhlLocationSummary,
  GhlMessage,
  GhlNote,
  GhlOpportunity,
  GhlPipeline,
  GhlProduct,
  GhlReview,
  GhlSocialPost,
  GhlTag,
  GhlTask,
  GhlUser,
  GhlWorkflow,
  ValidateTokenResult,
} from './types';
import { asArray, asRecord, asString } from './types';

export const GHL_API_BASE = 'https://services.leadconnectorhq.com';
export const GHL_API_VERSION = '2021-07-28';

export const GHL_REQUEST_TIMEOUT_MS = 20_000;

export interface GhlClientOptions {
  token: string;
  locationId?: string;
  fetchImpl?: typeof fetch;
  sleeper?: (ms: number) => Promise<void>;
  bucket?: TokenBucket;
  /** Override for tests. Live calls use `GHL_REQUEST_TIMEOUT_MS`. */
  requestTimeoutMs?: number;
}

export class GhlApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'GhlApiError';
  }
}

export class GhlClient {
  private readonly token: string;
  private readonly locationId?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleeper: (ms: number) => Promise<void>;
  private readonly bucket: TokenBucket;
  private readonly requestTimeoutMs: number;

  constructor(opts: GhlClientOptions) {
    this.token = opts.token.trim();
    this.locationId = opts.locationId?.trim();
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleeper = opts.sleeper ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.bucket = opts.bucket ?? new TokenBucket();
    this.requestTimeoutMs = opts.requestTimeoutMs ?? GHL_REQUEST_TIMEOUT_MS;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts?: { version?: string },
  ): Promise<T> {
    const wait = this.bucket.waitMs();
    if (wait > 0) await sleep(wait, this.sleeper);
    this.bucket.take();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${GHL_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Version: opts?.version ?? GHL_API_VERSION,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const message = err instanceof Error ? err.message : String(err);
      if (name === 'AbortError' || /aborted|timeout/i.test(message)) {
        throw new GhlApiError(
          408,
          path,
          `GoHighLevel request timed out after ${this.requestTimeoutMs}ms`,
        );
      }
      throw new GhlApiError(0, path, `GoHighLevel request failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: unknown = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }

    if (!res.ok) {
      const rec = asRecord(json);
      const msg =
        asString(rec.message) ?? asString(rec.error) ?? `GHL ${method} ${path} failed (${res.status})`;
      throw new GhlApiError(res.status, path, msg);
    }
    return json as T;
  }

  async getLocation(locationId: string): Promise<GhlLocationSummary> {
    const json = await this.request<unknown>('GET', `/locations/${encodeURIComponent(locationId)}`);
    const rec = asRecord(json);
    const loc = asRecord(rec.location ?? rec);
    return {
      id: asString(loc.id) ?? locationId,
      name: asString(loc.name) ?? locationId,
      address: asString(loc.address),
    };
  }

  async listLocations(): Promise<GhlLocationSummary[]> {
    const json = await this.request<unknown>('GET', '/locations/search?limit=100');
    const rec = asRecord(json);
    const rows = asArray(rec.locations ?? rec.location);
    return rows.map((row) => {
      const loc = asRecord(row);
      return {
        id: asString(loc.id) ?? '',
        name: asString(loc.name) ?? asString(loc.id) ?? 'Untitled location',
        address: asString(loc.address),
      };
    }).filter((l) => l.id.length > 0);
  }

  /**
   * Detect agency vs location token.
   * Agency tokens can list locations. Location tokens fail that call (401/403)
   * and succeed on GET /locations/:id when a locationId is supplied.
   */
  async validate(locationId?: string): Promise<ValidateTokenResult> {
    const hint = locationId ?? this.locationId;
    try {
      const locations = await this.listLocations();
      const selected = hint ? locations.find((l) => l.id === hint) : undefined;
      return { kind: 'agency', locations, selectedLocation: selected, missingScopes: [] };
    } catch (err) {
      if (!(err instanceof GhlApiError) || (err.status !== 401 && err.status !== 403)) {
        if (err instanceof GhlApiError && err.status === 404 && hint) {
          // Some location tokens 404 the search endpoint instead of 403.
        } else if (!(err instanceof GhlApiError && (err.status === 400 || err.status === 404))) {
          throw err;
        }
      }
    }

    if (!hint) {
      return { kind: 'location', locations: [], missingScopes: [] };
    }
    const selected = await this.getLocation(hint);
    return { kind: 'location', locations: [selected], selectedLocation: selected, missingScopes: [] };
  }

  async searchContacts(page: { after?: string; limit?: number } = {}): Promise<{
    contacts: GhlContact[];
    next?: string;
  }> {
    const locationId = this.requireLocation();
    const limit = page.limit ?? GHL_DEFAULT_PAGE_SIZE;
    try {
      return await this.listContactsGet(locationId, page.after, limit);
    } catch (e) {
      // GET /contacts/ is the reliable list. Search is what GHL documents, but
      // unfiltered POST /contacts/search often 400s with
      // "Error occurred while searching for contact".
      if (e instanceof GhlApiError && shouldFallBackToContactSearch(e)) {
        return await this.searchContactsPost(locationId, page.after, limit);
      }
      throw e;
    }
  }

  private async listContactsGet(
    locationId: string,
    after: string | undefined,
    limit: number,
  ): Promise<{ contacts: GhlContact[]; next?: string }> {
    const qs = new URLSearchParams({ locationId, limit: String(limit) });
    if (after) qs.set('startAfterId', after);
    const json = await this.request<unknown>('GET', `/contacts/?${qs.toString()}`);
    return parseContactPage(json);
  }

  private async searchContactsPost(
    locationId: string,
    after: string | undefined,
    limit: number,
  ): Promise<{ contacts: GhlContact[]; next?: string }> {
    const json = await this.request<unknown>(
      'POST',
      '/contacts/search',
      {
        locationId,
        pageLimit: limit,
        ...(after ? { searchAfter: [after] } : {}),
      },
      { version: 'v3' },
    );
    return parseContactPage(json);
  }

  async listBusinesses(): Promise<GhlBusiness[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/businesses/?locationId=${encodeURIComponent(locationId)}&limit=${limit}&skip=${offset}`,
      );
      return asArray(asRecord(json).businesses).map((row) => {
        const b = asRecord(row);
        return {
          id: asString(b.id) ?? '',
          name: asString(b.name) ?? 'Untitled company',
          phone: asString(b.phone),
          email: asString(b.email),
          website: asString(b.website),
          address: asString(b.address),
          city: asString(b.city),
          state: asString(b.state),
          postalCode: asString(b.postalCode),
          country: asString(b.country),
        };
      }).filter((b) => b.id);
    });
  }

  async listTags(): Promise<GhlTag[]> {
    const locationId = this.requireLocation();
    const json = await this.request<unknown>(
      'GET',
      `/locations/${encodeURIComponent(locationId)}/tags`,
    );
    return asArray(asRecord(json).tags).map((row) => {
      const t = asRecord(row);
      return { id: asString(t.id) ?? '', name: asString(t.name) ?? '' };
    }).filter((t) => t.id && t.name);
  }

  async listCustomFields(): Promise<GhlCustomField[]> {
    const locationId = this.requireLocation();
    const json = await this.request<unknown>(
      'GET',
      `/locations/${encodeURIComponent(locationId)}/customFields`,
    );
    return asArray(asRecord(json).customFields).map((row) => {
      const f = asRecord(row);
      return {
        id: asString(f.id) ?? '',
        name: asString(f.name) ?? asString(f.fieldKey) ?? 'field',
        fieldKey: asString(f.fieldKey),
        dataType: asString(f.dataType),
        position: typeof f.position === 'number' ? f.position : undefined,
        options: asArray(f.options) as GhlCustomField['options'],
      };
    }).filter((f) => f.id);
  }

  async listContactNotes(contactId: string): Promise<GhlNote[]> {
    const json = await this.request<unknown>(
      'GET',
      `/contacts/${encodeURIComponent(contactId)}/notes`,
    );
    return asArray(asRecord(json).notes).map((row) => {
      const n = asRecord(row);
      return {
        id: asString(n.id) ?? '',
        body: asString(n.body),
        dateAdded: asString(n.dateAdded),
        userId: asString(n.userId),
      };
    }).filter((n) => n.id);
  }

  async listPipelines(): Promise<GhlPipeline[]> {
    const locationId = this.requireLocation();
    const json = await this.request<unknown>(
      'GET',
      `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    );
    return asArray(asRecord(json).pipelines).map((row) => {
      const p = asRecord(row);
      return {
        id: asString(p.id) ?? '',
        name: asString(p.name) ?? 'Pipeline',
        stages: asArray(p.stages).map((s) => {
          const st = asRecord(s);
          return {
            id: asString(st.id) ?? '',
            name: asString(st.name) ?? 'Stage',
            position: typeof st.position === 'number' ? st.position : undefined,
          };
        }),
      };
    }).filter((p) => p.id);
  }

  async searchOpportunities(page: { after?: string } = {}): Promise<{
    opportunities: GhlOpportunity[];
    next?: string;
  }> {
    const locationId = this.requireLocation();
    const qs = new URLSearchParams({ location_id: locationId, limit: String(GHL_DEFAULT_PAGE_SIZE) });
    if (page.after) qs.set('startAfterId', page.after);
    const json = await this.request<unknown>('GET', `/opportunities/search?${qs.toString()}`);
    const rec = asRecord(json);
    const opportunities = asArray(rec.opportunities).map((row) => {
      const o = asRecord(row);
      return {
        id: asString(o.id) ?? '',
        name: asString(o.name),
        monetaryValue: typeof o.monetaryValue === 'number' ? o.monetaryValue : undefined,
        pipelineId: asString(o.pipelineId),
        pipelineStageId: asString(o.pipelineStageId),
        status: asString(o.status),
        contactId: asString(o.contactId),
        assignedTo: asString(o.assignedTo),
        source: asString(o.source),
      };
    }).filter((o) => o.id);
    return { opportunities, next: lastId(opportunities) };
  }

  async listCalendars(): Promise<GhlCalendar[]> {
    const locationId = this.requireLocation();
    const json = await this.request<unknown>(
      'GET',
      `/calendars/?locationId=${encodeURIComponent(locationId)}`,
    );
    return asArray(asRecord(json).calendars).map((row) => {
      const c = asRecord(row);
      return {
        id: asString(c.id) ?? '',
        name: asString(c.name),
        description: asString(c.description),
        timezone: asString(c.timezone),
        calendarType: asString(c.calendarType),
      };
    }).filter((c) => c.id);
  }

  async listAppointments(startMs: number, endMs: number): Promise<GhlAppointment[]> {
    const locationId = this.requireLocation();
    const qs = new URLSearchParams({
      locationId,
      startTime: String(startMs),
      endTime: String(endMs),
    });
    const json = await this.request<unknown>('GET', `/calendars/events?${qs.toString()}`);
    return asArray(asRecord(json).events).map((row) => {
      const e = asRecord(row);
      return {
        id: asString(e.id) ?? '',
        title: asString(e.title),
        calendarId: asString(e.calendarId),
        contactId: asString(e.contactId),
        assignedUserId: asString(e.assignedUserId),
        startTime: asString(e.startTime),
        endTime: asString(e.endTime),
        appointmentStatus: asString(e.appointmentStatus),
        notes: asString(e.notes),
      };
    }).filter((e) => e.id);
  }

  async searchConversations(page: { startAfterDate?: string } = {}): Promise<{
    conversations: GhlConversation[];
    next?: string;
  }> {
    const locationId = this.requireLocation();
    const qs = new URLSearchParams({ locationId, limit: String(GHL_DEFAULT_PAGE_SIZE) });
    if (page.startAfterDate) qs.set('startAfterDate', page.startAfterDate);
    const json = await this.request<unknown>('GET', `/conversations/search?${qs.toString()}`);
    const conversations = asArray(asRecord(json).conversations).map((row) => {
      const c = asRecord(row);
      return {
        id: asString(c.id) ?? '',
        contactId: asString(c.contactId),
        type: asString(c.type),
        lastMessageBody: asString(c.lastMessageBody),
        lastMessageDate: asString(c.lastMessageDate),
        unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : undefined,
        assignedTo: asString(c.assignedTo),
      };
    }).filter((c) => c.id);
    const last = conversations[conversations.length - 1];
    return { conversations, next: last?.lastMessageDate };
  }

  async listMessages(conversationId: string): Promise<GhlMessage[]> {
    const all: GhlMessage[] = [];
    const seen = new Set<string>();
    let lastMessageId: string | undefined;
    for (let i = 0; i < 50; i++) {
      const qs = new URLSearchParams({ limit: '100' });
      if (lastMessageId) qs.set('lastMessageId', lastMessageId);
      const json = await this.request<unknown>(
        'GET',
        `/conversations/${encodeURIComponent(conversationId)}/messages?${qs.toString()}`,
      );
      const rec = asRecord(json);
      const messages = asArray(asRecord(rec.messages).messages ?? rec.messages);
      const page = messages.map((row) => {
        const m = asRecord(row);
        const attachments = asArray(m.attachments ?? m.files).map((a) => {
          const att = asRecord(a);
          return {
            url: asString(att.url) ?? asString(att.href),
            name: asString(att.name) ?? asString(att.fileName),
            contentType: asString(att.contentType) ?? asString(att.mimeType),
            size: typeof att.size === 'number' ? att.size : undefined,
          };
        });
        return {
          id: asString(m.id) ?? '',
          conversationId,
          body: asString(m.body),
          direction: asString(m.direction),
          type: (m.type as number | string | undefined) ?? undefined,
          dateAdded: asString(m.dateAdded),
          status: asString(m.status),
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      }).filter((m) => m.id);
      let added = 0;
      for (const row of page) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        all.push(row);
        added += 1;
      }
      if (page.length === 0 || added === 0 || page.length < 100) break;
      lastMessageId = page[page.length - 1]?.id;
    }
    return all;
  }

  async listForms(): Promise<GhlForm[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/forms/?locationId=${encodeURIComponent(locationId)}&limit=${limit}&skip=${offset}`,
      );
      return asArray(asRecord(json).forms).map((row) => {
        const f = asRecord(row);
        return {
          id: asString(f.id) ?? '',
          name: asString(f.name),
          fields: asArray(f.fields).map((field) => {
            const x = asRecord(field);
            return {
              id: asString(x.id),
              name: asString(x.name),
              type: asString(x.type),
              required: x.required === true,
            };
          }),
        };
      }).filter((f) => f.id);
    });
  }

  async listFormSubmissions(formId?: string): Promise<GhlFormSubmission[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const qs = new URLSearchParams({
        locationId,
        limit: String(limit),
        skip: String(offset),
      });
      if (formId) qs.set('formId', formId);
      const json = await this.request<unknown>('GET', `/forms/submissions?${qs.toString()}`);
      return asArray(asRecord(json).submissions).map((row) => {
        const s = asRecord(row);
        return {
          id: asString(s.id) ?? '',
          formId: asString(s.formId) ?? formId,
          contactId: asString(s.contactId),
          others: asRecord(s.others),
          createdAt: asString(s.createdAt),
        };
      }).filter((s) => s.id);
    });
  }

  async listCampaigns(): Promise<GhlCampaign[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/campaigns/?locationId=${encodeURIComponent(locationId)}&limit=${limit}&skip=${offset}`,
      );
      return asArray(asRecord(json).campaigns).map((row) => {
        const c = asRecord(row);
        return { id: asString(c.id) ?? '', name: asString(c.name), status: asString(c.status) };
      }).filter((c) => c.id);
    });
  }

  async listWorkflows(): Promise<GhlWorkflow[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/workflows/?locationId=${encodeURIComponent(locationId)}&limit=${limit}&skip=${offset}`,
      );
      return asArray(asRecord(json).workflows).map((row) => {
        const w = asRecord(row);
        return { id: asString(w.id) ?? '', name: asString(w.name), status: asString(w.status) };
      }).filter((w) => w.id);
    });
  }

  async listProducts(): Promise<GhlProduct[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/products/?locationId=${encodeURIComponent(locationId)}&limit=${limit}&skip=${offset}`,
      );
      return asArray(asRecord(json).products).map((row) => {
        const p = asRecord(row);
        return {
          id: asString(p._id) ?? asString(p.id) ?? '',
          name: asString(p.name),
          description: asString(p.description),
          availableInStore: p.availableInStore === true,
          prices: asArray(p.prices).map((price) => {
            const pr = asRecord(price);
            return {
              amount: typeof pr.amount === 'number' ? pr.amount : undefined,
              currency: asString(pr.currency),
            };
          }),
        };
      }).filter((p) => p.id);
    });
  }

  async listTasks(): Promise<GhlTask[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/locations/${encodeURIComponent(locationId)}/tasks?limit=${limit}&skip=${offset}`,
      );
      return asArray(asRecord(json).tasks ?? asRecord(json).data).map((row) => {
        const t = asRecord(row);
        return {
          id: asString(t.id) ?? asString(t._id) ?? '',
          title: asString(t.title) ?? asString(t.body),
          body: asString(t.body) ?? asString(t.description),
          dueDate: asString(t.dueDate) ?? asString(t.dueDateTime),
          completed: t.completed === true,
          assignedTo: asString(t.assignedTo),
          contactId: asString(t.contactId),
        };
      }).filter((t) => t.id);
    });
  }

  async listInvoices(): Promise<GhlInvoice[]> {
    const locationId = this.requireLocation();
    const all: GhlInvoice[] = [];
    for (let offset = 0; offset < 5000; offset += 100) {
      const json = await this.request<unknown>(
        'GET',
        `/invoices/?locationId=${encodeURIComponent(locationId)}&limit=100&offset=${offset}`,
      );
      const page = asArray(asRecord(json).invoices)
        .map((row) => {
          const i = asRecord(row);
          const contact = asRecord(i.contactDetails);
          return {
            id: asString(i._id) ?? asString(i.id) ?? '',
            invoiceNumber: asString(i.invoiceNumber),
            status: asString(i.status),
            contactDetails: { id: asString(contact.id), name: asString(contact.name) },
            total: typeof i.total === 'number' ? i.total : undefined,
            currency: asString(i.currency),
            issueDate: asString(i.issueDate),
            dueDate: asString(i.dueDate),
            items: asArray(i.items).map((item) => {
              const it = asRecord(item);
              return {
                name: asString(it.name),
                qty: typeof it.qty === 'number' ? it.qty : undefined,
                amount: typeof it.amount === 'number' ? it.amount : undefined,
              };
            }),
          };
        })
        .filter((i) => i.id);
      all.push(...page);
      if (page.length < 100) break;
    }
    return all;
  }

  async listEstimates(): Promise<GhlEstimate[]> {
    const locationId = this.requireLocation();
    const all: GhlEstimate[] = [];
    for (let offset = 0; offset < 5000; offset += 100) {
      const json = await this.request<unknown>(
        'GET',
        `/invoices/estimate/list?locationId=${encodeURIComponent(locationId)}&limit=100&offset=${offset}`,
      );
      const page = asArray(asRecord(json).estimates ?? asRecord(json).data)
        .map((row) => {
          const e = asRecord(row);
          return {
            id: asString(e._id) ?? asString(e.id) ?? '',
            name: asString(e.name),
            status: asString(e.status),
            contactId: asString(e.contactId),
            total: typeof e.total === 'number' ? e.total : undefined,
            currency: asString(e.currency),
          };
        })
        .filter((e) => e.id);
      all.push(...page);
      if (page.length < 100) break;
    }
    return all;
  }

  async searchUsers(page: { offset?: number; limit?: number } = {}): Promise<{
    users: GhlUser[];
    next?: string;
  }> {
    const locationId = this.requireLocation();
    const limit = page.limit ?? GHL_DEFAULT_PAGE_SIZE;
    const offset = page.offset ?? 0;
    const qs = new URLSearchParams({
      locationId,
      limit: String(limit),
      skip: String(offset),
    });
    const json = await this.request<unknown>('GET', `/users/?${qs.toString()}`);
    const fetched = asArray(asRecord(json).users).map((row) => {
      const u = asRecord(row);
      return {
        id: asString(u.id) ?? '',
        name: asString(u.name),
        firstName: asString(u.firstName),
        lastName: asString(u.lastName),
        email: asString(u.email),
      };
    }).filter((u) => u.id);
    // HighLevel sometimes ignores skip/limit and dumps the whole roster.
    // Slice so one Convex write never receives the entire list.
    const start = fetched.length > limit && offset > 0 ? offset : 0;
    const users = fetched.slice(start, start + limit);
    const more =
      fetched.length > limit ? start + limit < fetched.length : users.length >= limit;
    return {
      users,
      next: more ? String(offset + users.length) : undefined,
    };
  }

  /** First page only. The import action walks the rest in small batches. */
  async listUsers(): Promise<GhlUser[]> {
    const page = await this.searchUsers({ limit: GHL_DEFAULT_PAGE_SIZE });
    return page.users;
  }

  async listReviews(): Promise<GhlReview[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/reputation/reviews?locationId=${encodeURIComponent(locationId)}&limit=${limit}&skip=${offset}`,
      );
      const rec = asRecord(json);
      return asArray(rec.reviews ?? rec.data).map((row) => {
        const r = asRecord(row);
        return {
          id: asString(r._id) ?? asString(r.id) ?? '',
          reviewerName: asString(r.reviewerName) ?? asString(r.name),
          rating: typeof r.rating === 'number' ? r.rating : undefined,
          content: asString(r.review) ?? asString(r.comment) ?? asString(r.content),
          date: asString(r.date) ?? asString(r.createdAt),
          platform: asString(r.type) ?? asString(r.platform) ?? 'google',
          reply: asString(asRecord(r.reply).comment) ?? asString(r.response),
        };
      }).filter((r) => r.id);
    });
  }

  async listSocialPosts(): Promise<GhlSocialPost[]> {
    const locationId = this.requireLocation();
    return this.collectPages(async ({ offset, limit }) => {
      const json = await this.request<unknown>(
        'GET',
        `/social-media-posting/${encodeURIComponent(locationId)}/posts?limit=${limit}&skip=${offset}`,
      );
      return asArray(asRecord(json).posts ?? asRecord(json).data).map((row) => {
        const p = asRecord(row);
        return {
          id: asString(p._id) ?? asString(p.id) ?? '',
          message: asString(p.message) ?? asString(p.summary),
          status: asString(p.status),
          scheduledFor: asString(p.scheduledFor),
          publishedAt: asString(p.publishedAt),
        };
      }).filter((p) => p.id);
    });
  }

  private async collectPages<T extends { id: string }>(
    fetchPage: (cursor: { offset: number; limit: number }) => Promise<T[]>,
    limit = 100,
  ): Promise<T[]> {
    const all: T[] = [];
    const seen = new Set<string>();
    const maxPages = 20;
    for (let pageNo = 0; pageNo < maxPages; pageNo++) {
      const offset = pageNo * limit;
      const page = await fetchPage({ offset, limit });
      let added = 0;
      for (const row of page) {
        if (!row.id || seen.has(row.id)) continue;
        seen.add(row.id);
        all.push(row);
        added += 1;
      }
      if (page.length < limit || added === 0) break;
    }
    return all;
  }

  private requireLocation(): string {
    if (!this.locationId) throw new Error('GHL locationId is required for this request');
    return this.locationId;
  }
}

function shouldFallBackToContactSearch(e: GhlApiError): boolean {
  if (e.status === 404 || e.status === 405 || e.status === 410) return true;
  return e.status === 400 && /searching for contact/i.test(e.message);
}

function lastId(rows: Array<{ id: string }>): string | undefined {
  const last = rows[rows.length - 1];
  return last?.id;
}

function parseContactPage(json: unknown): { contacts: GhlContact[]; next?: string } {
  const rec = asRecord(json);
  const contacts = asArray(rec.contacts).map((c) => normalizeContact(c));
  const meta = asRecord(rec.meta);
  const next =
    asString(meta.startAfterId) ??
    asString(rec.searchAfter) ??
    lastId(contacts);
  return { contacts, next: contacts.length === 0 ? undefined : next };
}

function normalizeContact(row: unknown): GhlContact {
  const c = asRecord(row);
  return {
    id: asString(c.id) ?? asString(c._id) ?? '',
    firstName: asString(c.firstName),
    lastName: asString(c.lastName),
    email: asString(c.email),
    phone: asString(c.phone),
    companyName: asString(c.companyName),
    website: asString(c.website),
    address1: asString(c.address1),
    city: asString(c.city),
    state: asString(c.state),
    postalCode: asString(c.postalCode),
    country: asString(c.country),
    timezone: asString(c.timezone),
    source: asString(c.source),
    tags: asArray(c.tags).filter((t): t is string => typeof t === 'string'),
    customFields: asArray(c.customFields) as GhlContact['customFields'],
    dnd: c.dnd,
    dndSettings: c.dndSettings,
    dateAdded: asString(c.dateAdded),
    dateUpdated: asString(c.dateUpdated),
    assignedTo: asString(c.assignedTo),
    companyId: asString(c.companyId),
  };
}
