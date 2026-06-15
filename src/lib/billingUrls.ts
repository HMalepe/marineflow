import { env } from '../config.js';

const DEFAULT_DASHBOARD_ORIGIN = 'https://dashboard.marineflow.co.za';

export function resolveDashboardOrigin(requestOrigin?: string | string[]): string {
  const origin = Array.isArray(requestOrigin) ? requestOrigin[0] : requestOrigin;
  if (origin && origin.startsWith('http')) {
    return origin.replace(/\/$/, '');
  }
  if (env.DASHBOARD_URL) {
    return env.DASHBOARD_URL.replace(/\/$/, '');
  }
  return DEFAULT_DASHBOARD_ORIGIN;
}

export function billingReturnUrl(origin: string, outcome: 'success' | 'cancelled'): string {
  return `${origin}/billing?checkout=${outcome}`;
}

import { isPayfastConfigured as payfastConfigured } from './integrations/payments/payfast.js';

export function isPayfastConfigured(): boolean {
  return payfastConfigured();
}
