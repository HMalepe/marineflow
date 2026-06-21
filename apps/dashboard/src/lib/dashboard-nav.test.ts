import { describe, expect, it } from 'vitest';
import {
  APPOINTMENTS_LABEL,
  BOT_FAQS_LABEL,
  BRANCHES_LABEL,
  CONVERSATIONS_LABEL,
  TICKETS_LABEL,
  isNavItemActive,
  mobileMoreNavGroups,
  MOBILE_BOTTOM_TAB_ITEMS,
  SALON_NAV_GROUPS,
  visibleSalonNavGroups,
} from './dashboard-nav.js';

describe('dashboard-nav', () => {
  it('puts conversations in daily operations near the top', () => {
    const daily = SALON_NAV_GROUPS.find((g) => g.title === 'Daily operations');
    expect(daily?.items[0]?.href).toBe('/appointments');
    expect(daily?.items[1]?.href).toBe('/pulse');
    expect(daily?.items[2]?.href).toBe('/conversations');
  });

  it('hides billing for non-owners but keeps settings for managers and stylists', () => {
    const groups = visibleSalonNavGroups(false);
    const account = groups.find((g) => g.title === 'Account');
    expect(account?.items.map((i) => i.href)).toEqual(['/settings']);
    expect(groups.flatMap((g) => g.items).some((i) => i.href === '/billing')).toBe(false);
  });

  it('shows account links for owners', () => {
    const groups = visibleSalonNavGroups(true);
    const account = groups.find((g) => g.title === 'Account');
    expect(account?.items.map((i) => i.href)).toEqual(['/billing', '/settings']);
  });

  it('matches roster and legacy staff routes', () => {
    expect(isNavItemActive('/roster', '/roster')).toBe(true);
    expect(isNavItemActive('/staff', '/roster')).toBe(true);
  });

  it('uses the same labels on desktop nav and mobile bottom tabs', () => {
    const desktop = SALON_NAV_GROUPS.flatMap((g) => g.items);
    for (const tab of MOBILE_BOTTOM_TAB_ITEMS) {
      if (tab.href === '/appointments' || tab.href === '/conversations') {
        const match = desktop.find((item) => item.href === tab.href);
        expect(match?.label).toBe(tab.label);
      }
    }
    expect(desktop.find((i) => i.href === '/appointments')?.label).toBe(APPOINTMENTS_LABEL);
    expect(desktop.find((i) => i.href === '/conversations')?.label).toBe(CONVERSATIONS_LABEL);
    expect(desktop.find((i) => i.href === '/faqs')?.label).toBe(BOT_FAQS_LABEL);
    expect(desktop.find((i) => i.href === '/tickets')?.label).toBe(TICKETS_LABEL);
    expect(desktop.find((i) => i.href === '/branches')?.label).toBe(BRANCHES_LABEL);
  });

  it('includes Power Features and Team Performance in mobile More menu', () => {
    const hrefs = mobileMoreNavGroups(true).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain('/automations');
    expect(hrefs).toContain('/team-performance');
    expect(hrefs).not.toContain('/appointments');
    expect(hrefs).not.toContain('/conversations');
  });
});
