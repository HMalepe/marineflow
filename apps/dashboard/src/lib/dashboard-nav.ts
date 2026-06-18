/** Shared dashboard navigation — desktop sidebar and mobile nav stay in sync. */

/** Canonical salon nav labels — desktop, mobile, and page titles must match. */
export const APPOINTMENTS_LABEL = 'Appointments';
export const CONVERSATIONS_LABEL = 'Conversations';
export const TICKETS_LABEL = 'Support tickets';
export const BOT_FAQS_LABEL = 'Bot FAQs';
export const BRANCHES_LABEL = 'Branches';

/** Page subtitles — clarify Conversations (live chat) vs Support tickets (issue queue). */
export const CONVERSATIONS_TAGLINE =
  'Live WhatsApp inbox — reply in real time and take over when the bot hands off.';
export const TICKETS_TAGLINE =
  'Tracked issues from report-a-problem, complaints, and low ratings — resolve and close when done.';

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

export const SALON_OVERVIEW_ITEM: NavItem = { href: '/', label: 'Overview' };

/** Salon nav grouped by how owners use the product day to day. */
export const SALON_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Daily operations',
    items: [
      { href: '/appointments', label: APPOINTMENTS_LABEL },
      { href: '/conversations', label: CONVERSATIONS_LABEL },
      { href: '/customers', label: 'Customers' },
      { href: '/tickets', label: TICKETS_LABEL },
    ],
  },
  {
    title: 'Salon setup',
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
      { href: '/analytics', label: 'Analytics' },
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

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/agency', label: 'Businesses' },
  { href: '/admin', label: 'Admin' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/billing', label: 'Billing' },
];

/** True when pathname matches a nav href (including roster ↔ staff alias). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/appointments') {
    return pathname.startsWith('/appointments') || (pathname.includes('/branch/') && pathname.includes('/appointments'));
  }
  if (href === '/roster') {
    return pathname.startsWith('/roster') || pathname.startsWith('/staff') || (pathname.includes('/branch/') && pathname.includes('/roster'));
  }
  if (href === '/branches') {
    return pathname.startsWith('/branches') || pathname.startsWith('/branch/');
  }
  return pathname.startsWith(href);
}

export function visibleSalonNavGroups(isOwner: boolean): NavGroup[] {
  return SALON_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.ownerOnly || isOwner),
  })).filter((group) => group.items.length > 0);
}

/** Bottom tab bar on mobile — high-frequency destinations. */
export const MOBILE_BOTTOM_TAB_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/appointments', label: APPOINTMENTS_LABEL },
  { href: '/conversations', label: CONVERSATIONS_LABEL },
  { href: '/roster', label: 'Roster' },
  { href: '/services', label: 'Services' },
];

const MOBILE_TAB_HREFS = new Set(MOBILE_BOTTOM_TAB_ITEMS.map((item) => item.href));

/** Salon items for the mobile More sheet (excludes bottom tabs), grouped like desktop. */
export function mobileMoreNavGroups(isOwner: boolean): NavGroup[] {
  return visibleSalonNavGroups(isOwner)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !MOBILE_TAB_HREFS.has(item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

export const ADMIN_MOBILE_TAB_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/agency', label: 'Businesses' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/billing', label: 'Billing' },
];

const ADMIN_MOBILE_TAB_HREFS = new Set(ADMIN_MOBILE_TAB_ITEMS.map((item) => item.href));

export function adminMobileMoreItems(): NavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => !ADMIN_MOBILE_TAB_HREFS.has(item.href));
}

/** Flat list for sticky header navigation. */
export function flatDashboardNavItems(input: { isAdmin: boolean; isOwner: boolean }): NavItem[] {
  if (input.isAdmin) return ADMIN_NAV_ITEMS;
  return [
    SALON_OVERVIEW_ITEM,
    ...visibleSalonNavGroups(input.isOwner).flatMap((g) => g.items),
  ];
}

/** Grouped items for sticky header — preserves section labels. */
export function stickyHeaderNavGroups(input: { isAdmin: boolean; isOwner: boolean }): NavGroup[] {
  if (input.isAdmin) {
    return [
      { title: 'Platform', items: ADMIN_NAV_ITEMS.filter((i) => ['/', '/agency', '/admin'].includes(i.href)) },
      { title: 'Reports', items: ADMIN_NAV_ITEMS.filter((i) => ['/analytics', '/billing'].includes(i.href)) },
    ];
  }
  return [{ title: 'Overview', items: [SALON_OVERVIEW_ITEM] }, ...visibleSalonNavGroups(input.isOwner)];
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
