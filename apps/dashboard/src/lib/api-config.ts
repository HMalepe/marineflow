const DEFAULT_API_URL = 'http://localhost:3000';

/** Railway / Vercel API base URL (no trailing slash). */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return DEFAULT_API_URL;
}

/** True when dashboard production build is still pointing at localhost or env is blank. */
export function isApiMisconfiguredForProduction(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  const url = getApiBaseUrl();
  return !process.env.NEXT_PUBLIC_API_URL?.trim() || url.includes('localhost') || url.includes('127.0.0.1');
}

export const API_MISCONFIGURED_MESSAGE =
  'Dashboard cannot reach the MarineFlow API. Set NEXT_PUBLIC_API_URL to https://marineflow.co.za on Vercel (or your Railway dashboard service) and redeploy.';
