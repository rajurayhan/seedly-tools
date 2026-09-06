export type ConsoleError = {
  type: 'error' | 'warn' | 'log';
  message: string;
  source?: string;
  line?: number;
  timestamp: string;
};

export type NetworkError = {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: string;
};

export type UserActivity = {
  type: 'button' | 'link' | 'input' | 'select' | 'checkbox' | 'other';
  text?: string;
  url?: string;
  inputType?: string;
  timestamp: string;
};

const MAX_CONSOLE = 50;
const MAX_NETWORK = 50;
const MAX_ACTIVITY = 30;

function now() {
  return new Date().toISOString();
}

export function classifyClickTarget(el: Element | null): UserActivity {
  const timestamp = now();
  if (!el || !(el instanceof HTMLElement)) return { type: 'other', timestamp };
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' || el.closest('a')) {
    const link = (tag === 'a' ? el : el.closest('a')) as HTMLAnchorElement | null;
    return {
      type: 'link',
      text: (link?.textContent ?? '').trim().slice(0, 80) || undefined,
      url: link?.href,
      timestamp,
    };
  }
  if (tag === 'button' || el.getAttribute('role') === 'button') {
    return { type: 'button', text: (el.textContent ?? '').trim().slice(0, 80) || undefined, timestamp };
  }
  if (tag === 'select' || el.closest('select')) return { type: 'select', timestamp };
  if (tag === 'input') {
    const input = el as HTMLInputElement;
    if (input.type === 'checkbox' || input.type === 'radio') {
      return { type: 'checkbox', inputType: input.type, timestamp };
    }
    return { type: 'input', inputType: input.type, timestamp };
  }
  return { type: 'other', text: (el.textContent ?? '').trim().slice(0, 40) || undefined, timestamp };
}

export function storageKeyNamesFromWindow(win: Window = window) {
  const cookies = win.document.cookie
    ? win.document.cookie.split(';').map((part) => part.split('=')[0]?.trim()).filter(Boolean)
    : [];
  const localStorage = Object.keys(win.localStorage ?? {});
  const sessionStorage = Object.keys(win.sessionStorage ?? {});
  return { cookies, localStorage, sessionStorage };
}

export function createCaptureSession() {
  const consoleErrors: ConsoleError[] = [];
  const networkErrors: NetworkError[] = [];
  const userActivity: UserActivity[] = [];
  const originals = {
    error: console.error,
    warn: console.warn,
    log: console.log,
    fetch: window.fetch.bind(window),
    open: XMLHttpRequest.prototype.open,
    send: XMLHttpRequest.prototype.send,
  };

  const pushConsole = (type: ConsoleError['type'], args: unknown[]) => {
    consoleErrors.push({
      type,
      message: args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ').slice(0, 500),
      timestamp: now(),
    });
    if (consoleErrors.length > MAX_CONSOLE) consoleErrors.shift();
  };

  console.error = (...args: unknown[]) => {
    pushConsole('error', args);
    originals.error.apply(console, args as []);
  };
  console.warn = (...args: unknown[]) => {
    pushConsole('warn', args);
    originals.warn.apply(console, args as []);
  };
  console.log = (...args: unknown[]) => {
    pushConsole('log', args);
    originals.log.apply(console, args as []);
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    try {
      const res = await originals.fetch(input, init);
      if (res.status >= 400) {
        networkErrors.push({ url, method, status: res.status, statusText: res.statusText, timestamp: now() });
        if (networkErrors.length > MAX_NETWORK) networkErrors.shift();
      }
      return res;
    } catch (err) {
      networkErrors.push({
        url,
        method,
        status: 0,
        statusText: err instanceof Error ? err.message : 'network failure',
        timestamp: now(),
      });
      if (networkErrors.length > MAX_NETWORK) networkErrors.shift();
      throw err;
    }
  };

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as XMLHttpRequest & { __seedlyPin?: { method: string; url: string } }).__seedlyPin = {
      method: String(method).toUpperCase(),
      url: String(url),
    };
    return originals.open.call(this, method, url, ...(rest as []));
  };
  XMLHttpRequest.prototype.send = function (...args: unknown[]) {
    this.addEventListener('loadend', () => {
      const meta = (this as XMLHttpRequest & { __seedlyPin?: { method: string; url: string } }).__seedlyPin;
      if (!meta) return;
      if (this.status >= 400 || this.status === 0) {
        networkErrors.push({
          url: meta.url,
          method: meta.method,
          status: this.status,
          statusText: this.statusText,
          timestamp: now(),
        });
        if (networkErrors.length > MAX_NETWORK) networkErrors.shift();
      }
    });
    return originals.send.apply(this, args as []);
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-seedly-pin]')) return;
    userActivity.push(classifyClickTarget(target));
    if (userActivity.length > MAX_ACTIVITY) userActivity.shift();
  };
  document.addEventListener('click', onClick, true);

  return {
    snapshot() {
      return {
        consoleErrors: [...consoleErrors],
        networkErrors: [...networkErrors],
        userActivity: [...userActivity],
        storageKeys: storageKeyNamesFromWindow(),
      };
    },
    stop() {
      console.error = originals.error;
      console.warn = originals.warn;
      console.log = originals.log;
      window.fetch = originals.fetch;
      XMLHttpRequest.prototype.open = originals.open;
      XMLHttpRequest.prototype.send = originals.send;
      document.removeEventListener('click', onClick, true);
    },
  };
}
