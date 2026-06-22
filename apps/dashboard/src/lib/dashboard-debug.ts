import { getServerApiBaseUrl, isApiMisconfiguredForProduction } from './api-config';
import { isDashboardDebugClientEnabled } from './dashboard-debug-flag';

/** Enable with NEXT_PUBLIC_DASHBOARD_DEBUG=true on Vercel (or locally). */
export function isDashboardDebugEnabled(): boolean {
  return isDashboardDebugClientEnabled();
}

export type SerializedDashboardError = {
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  cause?: string;
};

export function serializeDashboardError(error: unknown): SerializedDashboardError {
  if (error instanceof Error) {
    const withDigest = error as Error & { digest?: string };
    let cause: string | undefined;
    if (error.cause instanceof Error) {
      cause = error.cause.message;
    } else if (error.cause != null) {
      cause = String(error.cause);
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: withDigest.digest,
      cause,
    };
  }
  return { name: 'Error', message: String(error) };
}

/** Next.js redirect()/notFound() throw internal errors — never show those as crashes. */
export function isNextInternalNavigationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const digest = (error as { digest?: string }).digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_');
}

export type DashboardDebugEnvSnapshot = {
  nodeEnv: string;
  vercelEnv: string;
  vercelUrl: string;
  apiUrl: string;
  apiUpstream: string;
  apiMisconfigured: boolean;
  debugEnabled: boolean;
};

export function getDashboardDebugEnvSnapshot(): DashboardDebugEnvSnapshot {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
    vercelEnv: process.env.VERCEL_ENV ?? '(not set)',
    vercelUrl: process.env.VERCEL_URL ?? '(not set)',
    apiUrl: process.env.NEXT_PUBLIC_API_URL?.trim() || '(not set)',
    apiUpstream: process.env.API_UPSTREAM_URL?.trim() || '(not set)',
    apiMisconfigured: isApiMisconfiguredForProduction(),
    debugEnabled: isDashboardDebugEnabled(),
  };
}

/** Resolved API base used by server-side fetches (no secrets). */
export function getDashboardDebugApiResolved(): string {
  return getServerApiBaseUrl();
}
