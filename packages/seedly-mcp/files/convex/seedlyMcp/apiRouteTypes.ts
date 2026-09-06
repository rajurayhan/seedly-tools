export type ExtensionApiRequest = {
  apiKeyId?: string;
  agencyId?: string;
  subAccountId?: string;
  pathParams?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: unknown;
};

export type ExtensionApiResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; code: string; message: string };

export type ExtensionApiRoute = {
  namespace: string;
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  scope: string;
  resource: string;
  rateLimit?: string;
  summary?: string;
  handle: (ctx: unknown, req: ExtensionApiRequest) => Promise<ExtensionApiResult>;
};
