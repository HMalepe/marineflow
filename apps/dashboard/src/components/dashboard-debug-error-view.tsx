import {
  getDashboardDebugApiResolved,
  getDashboardDebugEnvSnapshot,
  type SerializedDashboardError,
} from '@/lib/dashboard-debug';

type Props = {
  title?: string;
  context: string;
  error: SerializedDashboardError;
};

function DebugBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
        {label}
      </p>
      <pre className="text-xs whitespace-pre-wrap break-all rounded-md border border-amber-500/30 bg-background/80 p-3 font-mono text-foreground overflow-x-auto">
        {value}
      </pre>
    </div>
  );
}

/** Full-screen server render failure details — only rendered when debug mode is on. */
export function DashboardDebugErrorView({
  title = 'Dashboard debug — server error',
  context,
  error,
}: Props) {
  const env = getDashboardDebugEnvSnapshot();
  const apiResolved = getDashboardDebugApiResolved();

  return (
    <div className="min-h-dvh bg-amber-50 dark:bg-amber-950/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">{title}</p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-1">
            Debug mode is on (<code className="font-mono">NEXT_PUBLIC_DASHBOARD_DEBUG=true</code>).
            Turn it off on Vercel after fixing — this screen shows internal errors to salon owners too.
          </p>
        </div>

        <DebugBlock label="Where" value={context} />
        <DebugBlock label="Error" value={`${error.name}: ${error.message}`} />
        {error.digest && <DebugBlock label="Digest (Vercel logs)" value={error.digest} />}
        {error.cause && <DebugBlock label="Cause" value={error.cause} />}
        {error.stack && <DebugBlock label="Stack" value={error.stack} />}

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Environment</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {Object.entries({
              ...env,
              apiResolved,
            }).map(([key, value]) => (
              <div key={key} className="rounded border px-2 py-1.5">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="font-medium break-all">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
