import indexJson from './dashboard-search-index.json' with { type: 'json' };
import { isDispensarySalon } from './retailSettings.js';

export type DashboardSearchEntry = {
  id: string;
  label: string;
  href: string;
  group: string;
  description: string;
  keywords: string[];
  aliases: string[];
  ownerOnly?: boolean;
  adminOnly?: boolean;
  /**
   * Industry this entry belongs to. Omitted = vocabulary-neutral, shown to
   * everyone. Keep in sync with the dashboard copy of this index.
   */
  industry?: 'salon' | 'dispensary';
};

export const DASHBOARD_SEARCH_INDEX = indexJson as DashboardSearchEntry[];

export function visibleSearchEntries(input: {
  isAdmin: boolean;
  isOwner: boolean;
  industryTemplate?: string | null;
}): DashboardSearchEntry[] {
  const industry = isDispensarySalon(input.industryTemplate) ? 'dispensary' : 'salon';
  return DASHBOARD_SEARCH_INDEX.filter((entry) => {
    if (entry.adminOnly && !input.isAdmin) return false;
    if (entry.ownerOnly && !input.isOwner && !input.isAdmin) return false;
    if (entry.industry && entry.industry !== industry) return false;
    return true;
  });
}
