import { describe, expect, it } from 'vitest';
import { GhlApiError, GhlClient } from '../client';
import { TokenBucket } from '../rateLimit';

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

describe('GhlClient', () => {
  it('sends PAT + Version headers', async () => {
    let seenAuth = '';
    let seenVersion = '';
    const client = new GhlClient({
      token: 'pit_test',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url, init) => {
        seenAuth = String(init?.headers && (init.headers as Record<string, string>).Authorization);
        seenVersion = String(init?.headers && (init.headers as Record<string, string>).Version);
        expect(url).toContain('/locations/loc_1');
        return { status: 200, body: { location: { id: 'loc_1', name: 'HQ' } } };
      }) as typeof fetch,
    });
    const loc = await client.getLocation('loc_1');
    expect(loc.name).toBe('HQ');
    expect(seenAuth).toBe('Bearer pit_test');
    expect(seenVersion).toBe('2021-07-28');
  });

  it('detects an agency token from a location list', async () => {
    const client = new GhlClient({
      token: 'pit_agency',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch(() => ({
        status: 200,
        body: { locations: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }] },
      })) as typeof fetch,
    });
    const result = await client.validate();
    expect(result.kind).toBe('agency');
    expect(result.locations).toHaveLength(2);
  });

  it('falls back to location token when search is forbidden', async () => {
    const client = new GhlClient({
      token: 'pit_loc',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url) => {
        if (url.includes('/locations/search')) {
          return { status: 403, body: { message: 'forbidden' } };
        }
        return { status: 200, body: { location: { id: 'loc_1', name: 'Solo' } } };
      }) as typeof fetch,
    });
    const result = await client.validate('loc_1');
    expect(result.kind).toBe('location');
    expect(result.selectedLocation?.name).toBe('Solo');
  });

  it('throws GhlApiError on non-auth failures', async () => {
    const client = new GhlClient({
      token: 'pit',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch(() => ({ status: 500, body: { message: 'boom' } })) as typeof fetch,
    });
    await expect(client.listLocations()).rejects.toBeInstanceOf(GhlApiError);
  });

  it('lists contacts via GET /contacts/ with startAfterId paging', async () => {
    let seenUrl = '';
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url) => {
        seenUrl = url;
        expect(url).toContain('/contacts/?');
        expect(url).toContain('locationId=loc_1');
        expect(url).toContain('limit=25');
        expect(url).toContain('startAfterId=c1');
        return {
          status: 200,
          body: {
            contacts: [{ id: 'c2', email: 'b@x.com' }],
            meta: { startAfterId: 'c2' },
          },
        };
      }) as typeof fetch,
    });
    const page = await client.searchContacts({ after: 'c1', limit: 25 });
    expect(seenUrl).toContain('/contacts/');
    expect(page.contacts).toHaveLength(1);
    expect(page.contacts[0]?.id).toBe('c2');
    expect(page.next).toBe('c2');
  });

  it('accepts _id when GHL omits id on listed contacts', async () => {
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch(() => ({
        status: 200,
        body: { contacts: [{ _id: 'legacy_1', firstName: 'Ada' }] },
      })) as typeof fetch,
    });
    const page = await client.searchContacts({ limit: 1 });
    expect(page.contacts[0]?.id).toBe('legacy_1');
  });

  it('falls back to POST /contacts/search when GET list is gone', async () => {
    const urls: string[] = [];
    let seenVersion = '';
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url, init) => {
        urls.push(url);
        if (url.includes('/contacts/?')) {
          return { status: 404, body: { message: 'gone' } };
        }
        seenVersion = String(init?.headers && (init.headers as Record<string, string>).Version);
        expect(url).toContain('/contacts/search');
        return {
          status: 200,
          body: { contacts: [{ id: 'c9', email: 'c@x.com' }] },
        };
      }) as typeof fetch,
    });
    const page = await client.searchContacts({ limit: 10 });
    expect(urls.some((u) => u.includes('/contacts/?'))).toBe(true);
    expect(urls.some((u) => u.includes('/contacts/search'))).toBe(true);
    expect(seenVersion).toBe('v3');
    expect(page.contacts[0]?.id).toBe('c9');
  });

  it('falls back to v3 search when GET list returns the known search 400', async () => {
    const urls: string[] = [];
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url) => {
        urls.push(url);
        if (url.includes('/contacts/?')) {
          return {
            status: 400,
            body: { message: 'Error occurred while searching for contact' },
          };
        }
        return {
          status: 200,
          body: { contacts: [{ id: 'c3', email: 'd@x.com' }] },
        };
      }) as typeof fetch,
    });
    const page = await client.searchContacts();
    expect(urls.some((u) => u.includes('/contacts/search'))).toBe(true);
    expect(page.contacts[0]?.id).toBe('c3');
  });

  it('pages invoices until a short page', async () => {
    let calls = 0;
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url) => {
        calls += 1;
        expect(url).toContain('/invoices/');
        if (url.includes('offset=0')) {
          return {
            status: 200,
            body: { invoices: Array.from({ length: 100 }, (_, i) => ({ id: `inv_${i}` })) },
          };
        }
        return { status: 200, body: { invoices: [{ id: 'inv_last' }] } };
      }) as typeof fetch,
    });
    const rows = await client.listInvoices();
    expect(calls).toBe(2);
    expect(rows).toHaveLength(101);
  });

  it('pages users with skip/limit and a next cursor', async () => {
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url) => {
        expect(url).toContain('/users/?');
        expect(url).toContain('locationId=loc_1');
        expect(url).toContain('skip=25');
        expect(url).toContain('limit=25');
        return {
          status: 200,
          body: { users: Array.from({ length: 25 }, (_, i) => ({ id: `u_${i}`, email: `a${i}@x.com` })) },
        };
      }) as typeof fetch,
    });
    const page = await client.searchUsers({ offset: 25, limit: 25 });
    expect(page.users).toHaveLength(25);
    expect(page.next).toBe('50');
  });

  it('slices a HighLevel user dump so one page stays at the requested limit', async () => {
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch(() => ({
        status: 200,
        body: {
          users: Array.from({ length: 80 }, (_, i) => ({ id: `u_${i}`, email: `a${i}@x.com` })),
        },
      })) as typeof fetch,
    });
    const first = await client.searchUsers({ offset: 0, limit: 25 });
    expect(first.users).toHaveLength(25);
    expect(first.users[0]?.id).toBe('u_0');
    expect(first.next).toBe('25');
    const second = await client.searchUsers({ offset: 25, limit: 25 });
    expect(second.users).toHaveLength(25);
    expect(second.users[0]?.id).toBe('u_25');
    expect(second.next).toBe('50');
  });

  it('fails a hung HighLevel request instead of waiting for Convex to kill it', async () => {
    const client = new GhlClient({
      token: 'pit',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      requestTimeoutMs: 30,
      fetchImpl: ((_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('This operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })) as typeof fetch,
    });
    await expect(client.listLocations()).rejects.toMatchObject({
      status: 408,
      message: expect.stringContaining('timed out'),
    });
  });

  it('pages location tasks until a short page', async () => {
    let calls = 0;
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url) => {
        calls += 1;
        expect(url).toContain('/locations/loc_1/tasks');
        if (url.includes('skip=0')) {
          return {
            status: 200,
            body: { tasks: Array.from({ length: 100 }, (_, i) => ({ id: `t_${i}`, title: 'Call' })) },
          };
        }
        return { status: 200, body: { tasks: [{ id: 't_last', title: 'Last' }] } };
      }) as typeof fetch,
    });
    const tasks = await client.listTasks();
    expect(calls).toBe(2);
    expect(tasks).toHaveLength(101);
    expect(tasks[100]?.title).toBe('Last');
  });

  it('pages conversation messages with lastMessageId', async () => {
    let calls = 0;
    const client = new GhlClient({
      token: 'pit',
      locationId: 'loc_1',
      bucket: new TokenBucket(100, 1, () => 0),
      sleeper: async () => undefined,
      fetchImpl: mockFetch((url) => {
        calls += 1;
        expect(url).toContain('/conversations/c1/messages');
        if (!url.includes('lastMessageId=')) {
          return {
            status: 200,
            body: {
              messages: Array.from({ length: 100 }, (_, i) => ({ id: `m_${i}`, body: 'hi' })),
            },
          };
        }
        return { status: 200, body: { messages: [{ id: 'm_last', body: 'bye' }] } };
      }) as typeof fetch,
    });
    const messages = await client.listMessages('c1');
    expect(calls).toBe(2);
    expect(messages).toHaveLength(101);
    expect(messages[100]?.body).toBe('bye');
  });
});
