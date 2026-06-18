import indexJson from './dashboard-search-index.json' with { type: 'json' };

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
};

export const DASHBOARD_SEARCH_INDEX = indexJson as DashboardSearchEntry[];

export function visibleSearchEntries(input: {
  isAdmin: boolean;
  isOwner: boolean;
}): DashboardSearchEntry[] {
  return DASHBOARD_SEARCH_INDEX.filter((entry) => {
    if (entry.adminOnly && !input.isAdmin) return false;
    if (entry.ownerOnly && !input.isOwner && !input.isAdmin) return false;
    return true;
  });
}
