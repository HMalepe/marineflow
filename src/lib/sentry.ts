/**
 * Sentry error tracking integration.
 * Only active when SENTRY_DSN is configured and @sentry/node is installed.
 * This module uses dynamic require to avoid build errors when Sentry is not present.
 */

interface SentryLike {
  init(opts: Record<string, unknown>): void;
  captureException(err: unknown, context?: Record<string, unknown>): void;
  captureMessage(msg: string, level?: string): void;
  setUser(user: { id: string; email?: string } | null): void;
}

let sentryInstance: SentryLike | null = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // Dynamic import — if @sentry/node is not installed, this will throw
    const mod = await (Function('return import("@sentry/node")')() as Promise<SentryLike>);
    mod.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    sentryInstance = mod;
  } catch {
    // @sentry/node not installed — Sentry disabled
  }
}

export function captureException(err: unknown, _context?: Record<string, unknown>): void {
  sentryInstance?.captureException(err);
}

export function captureMessage(msg: string, level?: string): void {
  sentryInstance?.captureMessage(msg, level);
}

export function setSentryUser(user: { id: string; email?: string } | null): void {
  sentryInstance?.setUser(user);
}
