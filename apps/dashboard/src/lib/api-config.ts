const DEFAULT_API_URL = 'http://localhost:3000';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

/** True when dashboard production build is still pointing at localhost. */
export function isApiMisconfiguredForProduction(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  const url = getApiBaseUrl();
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export const API_MISCONFIGURED_MESSAGE =
  'Dashboard cannot reach the MarineFlow API. Set NEXT_PUBLIC_API_URL to https://marineflow.co.za on Vercel and redeploy.';
