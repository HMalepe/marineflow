import type { ReactNode } from 'react';
import { DashboardDebugErrorView } from '@/components/dashboard-debug-error-view';
import {
  isDashboardDebugEnabled,
  isNextInternalNavigationError,
  serializeDashboardError,
} from '@/lib/dashboard-debug';

/**
 * Wrap async server page/layout renderers so production shows the real error
 * when NEXT_PUBLIC_DASHBOARD_DEBUG=true instead of a generic Next.js message.
 */
export async function withDashboardDebugCatch(
  context: string,
  render: () => Promise<ReactNode>
): Promise<ReactNode> {
  if (!isDashboardDebugEnabled()) {
    return render();
  }
  try {
    return await render();
  } catch (error) {
    if (isNextInternalNavigationError(error)) throw error;
    return (
      <DashboardDebugErrorView context={context} error={serializeDashboardError(error)} />
    );
  }
}
