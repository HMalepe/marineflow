import { describe, expect, it } from 'vitest';
import { localDashboardSearch, visibleSearchEntries } from './dashboard-search.js';

describe('dashboard-search', () => {
  const entries = visibleSearchEntries({ isAdmin: false, isOwner: true });

  it('finds roster when user types staff', () => {
    const results = localDashboardSearch('staff', entries);
    expect(results[0]?.id).toBe('roster');
  });

  it('tolerates faq typo', () => {
    const results = localDashboardSearch('faqs', entries);
    expect(results.some((r) => r.id === 'faqs')).toBe(true);
  });

  it('matches apointment misspelling to appointments', () => {
    const results = localDashboardSearch('apointment', entries);
    expect(results.some((r) => r.id === 'appointments')).toBe(true);
  });

  it('hides billing for non-owners', () => {
    const managerEntries = visibleSearchEntries({ isAdmin: false, isOwner: false });
    const results = localDashboardSearch('billing', managerEntries);
    expect(results.some((r) => r.id === 'billing')).toBe(false);
  });

  it('shows admin pages only for super admin', () => {
    const adminEntries = visibleSearchEntries({ isAdmin: true, isOwner: true });
    const results = localDashboardSearch('admin', adminEntries);
    expect(results.some((r) => r.id === 'admin')).toBe(true);

    const ownerEntries = visibleSearchEntries({ isAdmin: false, isOwner: true });
    expect(localDashboardSearch('admin', ownerEntries).some((r) => r.id === 'admin')).toBe(false);
  });
});
