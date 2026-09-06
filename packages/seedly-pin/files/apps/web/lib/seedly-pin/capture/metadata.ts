import { storageKeyNamesFromWindow, type ConsoleError, type NetworkError, type UserActivity } from './collectors';

export type PinnedElement = {
  cssSelector: string;
  domPath?: string;
  tagName?: string;
  textSnippet?: string;
  boundingRect?: { x: number; y: number; width: number; height: number };
  captureMode?: 'element';
};

export type PinMetadata = {
  url?: string;
  title?: string;
  referrer?: string;
  browser?: { name: string; version: string; userAgent: string };
  device?: { type: 'desktop' | 'tablet' | 'mobile'; os: string };
  viewport?: { width: number; height: number; devicePixelRatio: number; orientation?: 'landscape' | 'portrait' };
  timestamp: string;
  timezone?: string;
  pageLoadTime?: number;
  consoleErrors?: ConsoleError[];
  networkErrors?: NetworkError[];
  userActivity?: UserActivity[];
  storageKeys?: { cookies: string[]; localStorage: string[]; sessionStorage: string[] };
  pinnedElement?: PinnedElement;
  source?: string;
};

export function parseUserAgent(ua: string) {
  const source = ua || '';
  let name = 'Unknown';
  let version = '';
  if (/Edg\//.test(source)) {
    name = 'Edge';
    version = source.match(/Edg\/([\d.]+)/)?.[1] ?? '';
  } else if (/Chrome\//.test(source) && !/Edg\//.test(source)) {
    name = 'Chrome';
    version = source.match(/Chrome\/([\d.]+)/)?.[1] ?? '';
  } else if (/Firefox\//.test(source)) {
    name = 'Firefox';
    version = source.match(/Firefox\/([\d.]+)/)?.[1] ?? '';
  } else if (/Safari\//.test(source) && !/Chrome\//.test(source)) {
    name = 'Safari';
    version = source.match(/Version\/([\d.]+)/)?.[1] ?? '';
  }
  let os = 'Unknown';
  if (/Windows/.test(source)) os = 'Windows';
  else if (/Mac OS X/.test(source)) os = 'macOS';
  else if (/Android/.test(source)) os = 'Android';
  else if (/iPhone|iPad/.test(source)) os = 'iOS';
  else if (/Linux/.test(source)) os = 'Linux';
  return { name, version, os, userAgent: source };
}

export function classifyDevice(width: number, ua: string): 'desktop' | 'tablet' | 'mobile' {
  if (/Mobi|Android.*Mobile|iPhone/.test(ua) || width < 768) return 'mobile';
  if (/iPad|Tablet/.test(ua) || width < 1024) return 'tablet';
  return 'desktop';
}

export function capturePageMetadata(partial: Partial<PinMetadata> = {}): PinMetadata {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const parsed = parseUserAgent(ua);
  const width = typeof window === 'undefined' ? 0 : window.innerWidth;
  const height = typeof window === 'undefined' ? 0 : window.innerHeight;
  const nav = typeof performance !== 'undefined' ? performance.getEntriesByType?.('navigation')?.[0] : undefined;
  return {
    url: typeof location === 'undefined' ? undefined : location.href,
    title: typeof document === 'undefined' ? undefined : document.title,
    referrer: typeof document === 'undefined' ? undefined : document.referrer || undefined,
    browser: { name: parsed.name, version: parsed.version, userAgent: parsed.userAgent },
    device: { type: classifyDevice(width, ua), os: parsed.os },
    viewport: {
      width,
      height,
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      orientation: width >= height ? 'landscape' : 'portrait',
    },
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    pageLoadTime: nav && 'duration' in nav ? Number(nav.duration) : undefined,
    storageKeys: typeof window === 'undefined' ? undefined : storageKeyNamesFromWindow(),
    ...partial,
  };
}
