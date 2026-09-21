'use server';

import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import {
  localDashboardSearchResponse,
  type DashboardSearchContext,
  type DashboardSearchResponse,
} from '@/lib/dashboard-search';

export async function searchDashboardAction(
  query: string,
  context: DashboardSearchContext,
): Promise<DashboardSearchResponse> {
  const token = await getToken();
  const trimmed = query.trim();

  if (!token) {
    return localDashboardSearchResponse(trimmed, context);
  }

  try {
    return await apiFetch<DashboardSearchResponse>(
      '/search/dashboard',
      {
        method: 'POST',
        body: JSON.stringify({ query: trimmed }),
      },
      token,
    );
  } catch {
    return localDashboardSearchResponse(trimmed, context);
  }
}
