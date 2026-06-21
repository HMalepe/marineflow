import { getDashboardDebugApiResolved, getDashboardDebugEnvSnapshot } from '@/lib/dashboard-debug';

/** Amber strip shown at top of dashboard when debug mode is enabled. */
export function DashboardDebugBanner() {
  const env = getDashboardDebugEnvSnapshot();
  const apiResolved = getDashboardDebugApiResolved();

  return (
    <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-3 py-2 text-[11px] font-mono text-amber-950 dark:text-amber-100">
      <span className="font-bold">DEBUG</span>
      {' · '}
      API={apiResolved}
      {' · '}
      misconfigured={String(env.apiMisconfigured)}
      {' · '}
      vercel={env.vercelEnv}
    </div>
  );
}
