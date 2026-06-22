const DEFAULT_API_URL = 'http://localhost:3000';

export type ApiRouteKind = 'api' | 'admin' | 'agency';

const PROXY_PREFIX: Record<ApiRouteKind, string> = {
  api: '/api/backend',
  admin: '/admin/backend',
  agency: '/agency/backend',
};

const DIRECT_PREFIX: Record<ApiRouteKind, string> = {
  api: '/api',
  admin: '/admin',
  agency: '/agency',
};

/** Railway / Vercel API base URL (no trailing slash) — server-side only. */
export function getServerApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return DEFAULT_API_URL;
}

/** @deprecated Use getServerApiBaseUrl() on the server or resolveApiUrl() in the browser. */
export function getApiBaseUrl(): string {
  return getServerApiBaseUrl();
}

/**
 * Build a fetch URL. In the browser, routes through the dashboard origin
 * (`/api/backend/*`, etc.) so corporate firewalls that block the API domain
 * still allow salon owners to use the dashboard.
 */
export function resolveApiUrl(
  kind: ApiRouteKind,
  path: string,
  options?: { forBrowser?: boolean },
): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const useProxy = options?.forBrowser ?? typeof window !== 'undefined';
  if (useProxy) {
    return `${PROXY_PREFIX[kind]}${normalized}`;
  }
  return `${getServerApiBaseUrl()}${DIRECT_PREFIX[kind]}${normalized}`;
}

/** True when dashboard production build is still pointing at localhost or env is blank. */
export function isApiMisconfiguredForProduction(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  const url = getServerApiBaseUrl();
  return !process.env.NEXT_PUBLIC_API_URL?.trim() || url.includes('localhost') || url.includes('127.0.0.1');
}

export const API_MISCONFIGURED_MESSAGE =
  'Dashboard cannot reach the MarineFlow API. Set NEXT_PUBLIC_API_URL to https://api.solupair.co.za on Vercel (Production + Preview) and redeploy.';
