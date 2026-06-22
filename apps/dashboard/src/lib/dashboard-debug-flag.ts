/**
 * Client-safe debug flag (no server-only imports).
 * Set NEXT_PUBLIC_DASHBOARD_DEBUG=true on Vercel or in .env.local while troubleshooting.
 */
export function isDashboardDebugClientEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DASHBOARD_DEBUG ?? process.env.DASHBOARD_DEBUG;
  return flag === 'true' || flag === '1';
}
