'use client';

import type { SerializedDashboardError } from '@/lib/dashboard-debug';
import { isDashboardDebugClientEnabled } from '@/lib/dashboard-debug-flag';

type Props = {
  error: Error & { digest?: string };
  hint?: string;
};

function DebugBlock({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="w-full max-w-2xl space-y-1 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
        {label}
      </p>
      <pre className="text-xs whitespace-pre-wrap break-all rounded-md border border-amber-500/30 bg-muted/50 p-3 font-mono overflow-x-auto">
        {value}
      </pre>
    </div>
  );
}

export function DashboardErrorDetails({ error, hint }: Props) {
  const debugOn = isDashboardDebugClientEnabled();

  if (!debugOn) {
    return (
      <div className="text-sm text-muted-foreground max-w-md text-center space-y-2">
        <p>{error.message || hint || 'An unexpected error occurred. Please try again.'}</p>
        {error.digest && (
          <p className="text-xs font-mono text-muted-foreground/80">
            Error ID: <span className="select-all">{error.digest}</span>
            {' — search this in Vercel → Deployments → Logs'}
          </p>
        )}
        <p className="text-xs">
          For full stack traces on screen, set{' '}
          <code className="font-mono text-[11px]">NEXT_PUBLIC_DASHBOARD_DEBUG=true</code> on Vercel
          and redeploy.
        </p>
      </div>
    );
  }

  const serialized: SerializedDashboardError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    digest: error.digest,
  };

  return (
    <div className="w-full max-w-2xl space-y-3 text-left">
      <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
        Debug mode is on — internal details below. Set{' '}
        <code className="font-mono">NEXT_PUBLIC_DASHBOARD_DEBUG=false</code> on Vercel when done.
      </p>
      <DebugBlock label="Message" value={serialized.message} />
      {serialized.digest && (
        <DebugBlock
          label="Digest (search in Vercel → Deployments → Logs)"
          value={serialized.digest}
        />
      )}
      {serialized.stack && <DebugBlock label="Stack" value={serialized.stack} />}
      <DebugBlock
        label="Client env"
        value={[
          `NEXT_PUBLIC_API_URL=${process.env.NEXT_PUBLIC_API_URL ?? '(not set)'}`,
          `location=${typeof window !== 'undefined' ? window.location.href : ''}`,
        ].join('\n')}
      />
    </div>
  );
}
