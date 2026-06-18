/** Build a branch-scoped dashboard path (roster, appointments, settings). */
export function branchPath(branchId: string, segment = ''): string {
  const base = `/branch/${branchId}`;
  if (!segment || segment === '/') return base;
  const path = segment.startsWith('/') ? segment : `/${segment}`;
  return `${base}${path}`;
}
