/** Pure SeedlyPin gates. No Convex imports. */

export const STOCK_ROLES = [
  'agency_owner',
  'brand_admin',
  'sub_account_admin',
  'sub_account_user',
];

export const DEFAULT_DROP_ROLES = [...STOCK_ROLES];

export const DEFAULT_TRIAGE_ROLES = ['agency_owner', 'brand_admin', 'sub_account_admin'];

export const PIN_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export const PIN_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];

export const PIN_FILE_TYPES = ['screenshot', 'video', 'attachment'];

export const PIN_HISTORY_ACTIONS = [
  'created',
  'status_changed',
  'priority_changed',
  'assignee_changed',
  'description_changed',
  'note_added',
];

export const DISABLED_MESSAGE = 'SeedlyPin is turned off for this agency.';
export const DROP_FORBIDDEN_MESSAGE = 'Your role cannot drop a pin.';
export const TRIAGE_FORBIDDEN_MESSAGE = 'Your role cannot triage pins.';

export function normalizeRoleList(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set(STOCK_ROLES);
  const next = value.filter((role) => typeof role === 'string' && allowed.has(role));
  return next.length > 0 ? [...new Set(next)] : [...fallback];
}

export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    enabled: src.enabled === true,
    dropRoles: normalizeRoleList(src.dropRoles, DEFAULT_DROP_ROLES),
    triageRoles: normalizeRoleList(src.triageRoles, DEFAULT_TRIAGE_ROLES),
  };
}

export function isEnabled(settings) {
  return normalizeSettings(settings).enabled === true;
}

export function canDrop(settings, roleSlug) {
  const cfg = normalizeSettings(settings);
  return cfg.enabled && typeof roleSlug === 'string' && cfg.dropRoles.includes(roleSlug);
}

export function canTriage(settings, roleSlug) {
  const cfg = normalizeSettings(settings);
  return cfg.enabled && typeof roleSlug === 'string' && cfg.triageRoles.includes(roleSlug);
}

export function storageKeyNamesOnly(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const keys = (value) =>
    Array.isArray(value)
      ? value.filter((item) => typeof item === 'string').map((item) => item.split('=')[0])
      : [];
  return {
    cookies: keys(src.cookies),
    localStorage: keys(src.localStorage),
    sessionStorage: keys(src.sessionStorage),
  };
}

export function sanitizeMetadata(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const storage = storageKeyNamesOnly(src.storageKeys);
  return {
    url: typeof src.url === 'string' ? src.url : undefined,
    title: typeof src.title === 'string' ? src.title : undefined,
    referrer: typeof src.referrer === 'string' ? src.referrer : undefined,
    browser: src.browser && typeof src.browser === 'object' ? src.browser : undefined,
    device: src.device && typeof src.device === 'object' ? src.device : undefined,
    viewport: src.viewport && typeof src.viewport === 'object' ? src.viewport : undefined,
    timestamp: typeof src.timestamp === 'string' ? src.timestamp : new Date().toISOString(),
    timezone: typeof src.timezone === 'string' ? src.timezone : undefined,
    pageLoadTime: typeof src.pageLoadTime === 'number' ? src.pageLoadTime : undefined,
    consoleErrors: Array.isArray(src.consoleErrors) ? src.consoleErrors.slice(0, 50) : [],
    networkErrors: Array.isArray(src.networkErrors) ? src.networkErrors.slice(0, 50) : [],
    userActivity: Array.isArray(src.userActivity) ? src.userActivity.slice(-30) : [],
    storageKeys: storage,
    pinnedElement: src.pinnedElement && typeof src.pinnedElement === 'object' ? src.pinnedElement : undefined,
    source: typeof src.source === 'string' ? src.source : undefined,
  };
}

export function isValidStatus(value) {
  return PIN_STATUSES.includes(value);
}

export function isValidPriority(value) {
  return PIN_PRIORITIES.includes(value);
}

export function historyEntry({ action, oldValue, newValue }) {
  if (!PIN_HISTORY_ACTIONS.includes(action)) return null;
  return {
    action,
    oldValue: oldValue == null ? undefined : String(oldValue),
    newValue: newValue == null ? undefined : String(newValue),
  };
}

function stripQuery(url) {
  if (typeof url !== 'string' || !url) return url;
  try {
    const parsed = new URL(url, 'https://pin.invalid');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace('https://pin.invalid', '');
  } catch {
    return url.split('?')[0];
  }
}

function truncateConsole(errors) {
  return (errors ?? []).slice(0, 10).map((row) => ({
    type: row.type,
    message: String(row.message ?? '').slice(0, 280),
    timestamp: row.timestamp,
  }));
}

export function exportDiagnostics(pin, { format = 'aiPrompt', files = [] } = {}) {
  const metadata = sanitizeMetadata(pin?.metadata);
  const safeUrl = stripQuery(metadata.url);
  const body = {
    id: pin?._id ?? pin?.id,
    title: pin?.title,
    description: pin?.description ?? '',
    status: pin?.status,
    priority: pin?.priority,
    url: safeUrl,
    pageTitle: metadata.title,
    browser: metadata.browser,
    device: metadata.device,
    viewport: metadata.viewport,
    pinnedElement: metadata.pinnedElement,
    consoleErrors: truncateConsole(metadata.consoleErrors),
    networkErrors: (metadata.networkErrors ?? []).slice(0, 15).map((row) => ({
      method: row.method,
      status: row.status,
      url: stripQuery(row.url),
    })),
    userActivity: (metadata.userActivity ?? []).slice(-15),
    storageKeys: metadata.storageKeys,
    files: (files ?? []).map((file) => ({
      type: file.type,
      filename: file.filename,
      url: file.url,
    })),
  };

  if (format === 'json') return { format, body };

  const lines = [
    `# Pin ${body.title ?? ''}`.trim(),
    '',
    `Status: ${body.status} · Priority: ${body.priority}`,
    body.url ? `URL: ${body.url}` : '',
    body.pageTitle ? `Page: ${body.pageTitle}` : '',
    body.description ? `Description: ${body.description}` : '',
    '',
    '## Environment',
    body.browser ? `${body.browser.name ?? ''} ${body.browser.version ?? ''}`.trim() : '',
    body.device ? `${body.device.type ?? ''} ${body.device.os ?? ''}`.trim() : '',
    body.viewport
      ? `${body.viewport.width}x${body.viewport.height} @${body.viewport.devicePixelRatio ?? 1}`
      : '',
    '',
    '## Pinned element',
    body.pinnedElement
      ? `${body.pinnedElement.tagName ?? ''} ${body.pinnedElement.cssSelector ?? ''}`.trim()
      : '(none)',
    '',
    '## Console',
    ...(body.consoleErrors.length
      ? body.consoleErrors.map((row) => `- [${row.type}] ${row.message}`)
      : ['(none)']),
    '',
    '## Network',
    ...(body.networkErrors.length
      ? body.networkErrors.map((row) => `- ${row.method} ${row.status} ${row.url}`)
      : ['(none)']),
    '',
    '## Files',
    ...(body.files.length ? body.files.map((file) => `- ${file.type}: ${file.url ?? file.filename}`) : ['(none)']),
  ].filter((line) => line !== '');

  if (format === 'plain') return { format, text: lines.join('\n') };
  if (format === 'markdown') return { format, text: lines.join('\n') };

  return {
    format: 'aiPrompt',
    text: [
      'You are fixing a bug reported as a SeedlyPin. Use the diagnostics below. Do not invent URLs or console lines that are not listed. After you fix it, update the pin status to in_progress or resolved.',
      '',
      ...lines,
    ].join('\n'),
  };
}
