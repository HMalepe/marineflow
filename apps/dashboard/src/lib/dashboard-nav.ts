/** Shared dashboard navigation — desktop sidebar and mobile nav stay in sync. */

/** Canonical salon nav labels — desktop, mobile, and page titles must match. */
export const OVERVIEW_LABEL = 'Today at a glance';
export const OVERVIEW_MOBILE_TAB_LABEL = 'Today';
export const APPOINTMENTS_LABEL = 'Bookings';
export const ORDERS_LABEL = 'Orders';
export const CONVERSATIONS_LABEL = 'Inbox';
export const TICKETS_LABEL = 'Help requests';
export const CUSTOMERS_LABEL = 'Clients';
export const BUYERS_LABEL = 'Buyers';
export const ANALYTICS_LABEL = 'Insights';
export const BOT_FAQS_LABEL = 'Bot FAQs';
export const BRANCHES_LABEL = 'Branches';

/** Page subtitles — clarify Conversations (live chat) vs Support tickets (issue queue). */
export const CONVERSATIONS_TAGLINE =
  'Live WhatsApp inbox — reply in real time and take over when the bot hands off.';
export const TICKETS_TAGLINE =
  'Issues from Support menu, upset language, complaints, and handoffs — not casual after-hours chats.';

export type NavItem = {
  href: string;
  label: string;
  /** Visible only to salon OWNER (Billing, Settings). */
  ownerOnly?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export type DashboardIndustry = 'salon' | 'dispensary' | string;

export const SALON_OVERVIEW_ITEM: NavItem = { href: '/', label: OVERVIEW_LABEL };

/** Salon nav grouped by how owners use the product day to day. */
export const SALON_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Run the day',
    items: [
      { href: '/appointments', label: APPOINTMENTS_LABEL },
      { href: '/pulse', label: 'Live Pulse' },
      { href: '/conversations', label: CONVERSATIONS_LABEL },
      { href: '/customers', label: CUSTOMERS_LABEL },
      { href: '/tickets', label: TICKETS_LABEL },
    ],
  },
  {
    title: 'Set up your salon',
    items: [
      { href: '/services', label: 'Services' },
      { href: '/roster', label: 'Staff Roster' },
      { href: '/branches', label: BRANCHES_LABEL },
      { href: '/faqs', label: BOT_FAQS_LABEL },
    ],
  },
  {
    title: 'Marketing & insights',
    items: [
      { href: '/campaigns', label: 'Newsletter' },
      { href: '/automations', label: 'Power Features' },
      { href: '/team-performance', label: 'Team Performance' },
      { href: '/analytics', label: ANALYTICS_LABEL },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/billing', label: 'Billing', ownerOnly: true },
      { href: '/settings', label: 'Settings' },
    ],
  },
];

/** Dispensary / retail nav — same routes where possible, retail vocabulary. */
export const DISPENSARY_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Run the shop',
    items: [
      { href: '/orders', label: ORDERS_LABEL },
      { href: '/inventory', label: 'Inventory' },
      { href: '/conversations', label: CONVERSATIONS_LABEL },
      { href: '/customers', label: BUYERS_LABEL },
      { href: '/tickets', label: TICKETS_LABEL },
    ],
  },
  {
    title: 'Catalogue & ops',
    items: [
      { href: '/services', label: 'Products' },
      { href: '/faqs', label: BOT_FAQS_LABEL },
      { href: '/settings', label: 'Delivery & settings' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { href: '/campaigns', label: 'Drops & newsletter' },
      { href: '/automations', label: 'Automations' },
      { href: '/analytics', label: ANALYTICS_LABEL },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/billing', label: 'Billing', ownerOnly: true },
    ],
  },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/admin', label: 'Businesses' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/billing', label: 'Billing' },
];

/** True when pathname matches a nav href (including roster ↔ staff alias). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/appointments' || href === '/orders') {
    return (
      pathname.startsWith('/appointments') ||
      pathname.startsWith('/orders') ||
      (pathname.includes('/branch/') && pathname.includes('/appointments'))
    );
  }
  if (href === '/inventory') {
    return pathname.startsWith('/inventory');
  }
  if (href === '/pulse') {
    return pathname.startsWith('/pulse');
  }
  if (href === '/roster') {
    return pathname.startsWith('/roster') || pathname.startsWith('/staff') || (pathname.includes('/branch/') && pathname.includes('/roster'));
  }
  if (href === '/branches') {
    return pathname.startsWith('/branches') || pathname.startsWith('/branch/');
  }
  if (href === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/businesses/');
  }
  return pathname.startsWith(href);
}

/**
 * Parked for pilot: real, working pages — not deleted — just not worth the
 * nav clutter until a pilot salon asks for one by name. Live Pulse and Team
 * Performance need setup most pilots won't do yet; Branches and Newsletter
 * are built for scale a one-location pilot doesn't have. Drop an href here
 * to bring a page back.
 */
const PILOT_HIDDEN_HREFS = new Set(['/pulse', '/tickets', '/branches', '/campaigns', '/team-performance']);

export function salonNavGroupsForIndustry(industry: DashboardIndustry | null | undefined): NavGroup[] {
  return industry === 'dispensary' ? DISPENSARY_NAV_GROUPS : SALON_NAV_GROUPS;
}

export function visibleSalonNavGroups(
  isOwner: boolean,
  industry?: DashboardIndustry | null,
): NavGroup[] {
  const hidePilotExtras = industry !== 'dispensary';
  return salonNavGroupsForIndustry(industry)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.ownerOnly || isOwner)
        .filter((item) => !hidePilotExtras || !PILOT_HIDDEN_HREFS.has(item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Bottom tab bar on mobile — high-frequency destinations. */
export const MOBILE_BOTTOM_TAB_ITEMS: NavItem[] = [
  { href: '/', label: OVERVIEW_MOBILE_TAB_LABEL },
  { href: '/appointments', label: APPOINTMENTS_LABEL },
  { href: '/conversations', label: CONVERSATIONS_LABEL },
  { href: '/roster', label: 'Roster' },
  { href: '/services', label: 'Services' },
];

export const DISPENSARY_MOBILE_BOTTOM_TAB_ITEMS: NavItem[] = [
  { href: '/', label: OVERVIEW_MOBILE_TAB_LABEL },
  { href: '/orders', label: ORDERS_LABEL },
  { href: '/inventory', label: 'Stock' },
  { href: '/conversations', label: CONVERSATIONS_LABEL },
  { href: '/services', label: 'Products' },
];

export function mobileBottomTabItems(industry?: DashboardIndustry | null): NavItem[] {
  return industry === 'dispensary' ? DISPENSARY_MOBILE_BOTTOM_TAB_ITEMS : MOBILE_BOTTOM_TAB_ITEMS;
}

/** Salon items for the mobile More sheet (excludes bottom tabs), grouped like desktop. */
export function mobileMoreNavGroups(
  isOwner: boolean,
  industry?: DashboardIndustry | null,
): NavGroup[] {
  const tabs = new Set(mobileBottomTabItems(industry).map((item) => item.href));
  return visibleSalonNavGroups(isOwner, industry)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !tabs.has(item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

export const ADMIN_MOBILE_TAB_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/admin', label: 'Businesses' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/billing', label: 'Billing' },
];

const ADMIN_MOBILE_TAB_HREFS = new Set(ADMIN_MOBILE_TAB_ITEMS.map((item) => item.href));

export function adminMobileMoreItems(): NavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => !ADMIN_MOBILE_TAB_HREFS.has(item.href));
}

/** Human-readable title for the sticky in-page nav (not duplicated in the sidebar). */
export function pageTitleForPath(
  pathname: string,
  isAdmin: boolean,
  industry?: DashboardIndustry | null,
): string {
  const retail = industry === 'dispensary';
  if (pathname === '/') return isAdmin ? 'Platform overview' : OVERVIEW_LABEL;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'Businesses';
  if (pathname.startsWith('/orders')) return ORDERS_LABEL;
  if (pathname.startsWith('/inventory')) return 'Inventory';
  if (pathname.startsWith('/appointments') || (pathname.includes('/branch/') && pathname.includes('/appointments'))) {
    return retail ? ORDERS_LABEL : APPOINTMENTS_LABEL;
  }
  if (pathname.startsWith('/pulse')) return 'Live Pulse';
  if (pathname.startsWith('/conversations')) return CONVERSATIONS_LABEL;
  if (pathname.startsWith('/customers')) return retail ? BUYERS_LABEL : CUSTOMERS_LABEL;
  if (pathname.startsWith('/tickets')) return TICKETS_LABEL;
  if (pathname.startsWith('/services')) return retail ? 'Products' : 'Services';
  if (pathname.startsWith('/roster') || pathname.startsWith('/staff')) return 'Staff Roster';
  if (pathname.startsWith('/branches') || pathname.startsWith('/branch/')) return BRANCHES_LABEL;
  if (pathname.startsWith('/faqs')) return BOT_FAQS_LABEL;
  if (pathname.startsWith('/campaigns')) return retail ? 'Drops & newsletter' : 'Newsletter';
  if (pathname.startsWith('/automations')) return retail ? 'Automations' : 'Power Features';
  if (pathname.startsWith('/team-performance')) return 'Team Performance';
  if (pathname.startsWith('/analytics')) return ANALYTICS_LABEL;
  if (pathname.startsWith('/billing')) return 'Billing';
  if (pathname.startsWith('/settings')) return retail ? 'Delivery & settings' : 'Settings';
  if (pathname.startsWith('/agency')) return 'Agency';
  return 'Dashboard';
}

/** @deprecated Sticky header now uses in-page section nav — kept for tests or legacy callers. */
export function flatDashboardNavItems(input: {
  isAdmin: boolean;
  isOwner: boolean;
  industry?: DashboardIndustry | null;
}): NavItem[] {
  if (input.isAdmin) return ADMIN_NAV_ITEMS;
  return [
    SALON_OVERVIEW_ITEM,
    ...visibleSalonNavGroups(input.isOwner, input.industry).flatMap((g) => g.items),
  ];
}

/** Grouped items for sticky header — preserves section labels. */
export function stickyHeaderNavGroups(input: {
  isAdmin: boolean;
  isOwner: boolean;
  industry?: DashboardIndustry | null;
}): NavGroup[] {
  if (input.isAdmin) {
    return [{ title: 'Platform', items: ADMIN_NAV_ITEMS }];
  }
  return [
    { title: OVERVIEW_LABEL, items: [SALON_OVERVIEW_ITEM] },
    ...visibleSalonNavGroups(input.isOwner, input.industry),
  ];
}

export type SettingsSectionLink = { id: string; label: string };

/** In-page jump links on Settings — keep in sync with section ids in settings pages. */
export const SETTINGS_SECTION_LINKS: SettingsSectionLink[] = [
  { id: 'settings-profile', label: 'Profile' },
  { id: 'settings-logo', label: 'Logo' },
  { id: 'settings-business-name', label: 'Business name' },
  { id: 'settings-bot-behaviour', label: 'Bot behaviour' },
  { id: 'settings-conversation-flow', label: 'Conversation flow' },
  { id: 'settings-messages', label: 'Bot messages' },
  { id: 'settings-hours', label: 'Business hours' },
  { id: 'settings-location', label: 'Location' },
  { id: 'settings-password', label: 'Password' },
  { id: 'settings-contact-marineflow', label: 'Contact MarineFlow' },
  { id: 'settings-integrations', label: 'Integrations' },
];
