import { getIndustryTemplate } from './industryTemplates.js';

/** Customer-facing salon name — dashboard trading name, then legal/display name. */
export type SalonMenuInput = {
  name: string;
  tradingName?: string | null;
  welcomeMessage?: string | null;
  metadata?: unknown;
  /** When false, Rewards is omitted from the main menu (Settings → Conversation flow). */
  botLoyaltyEnabled?: boolean;
  /** Drives vocabulary (e.g. "Book a table" vs "Book an appointment") — defaults to 'salon'. */
  industryTemplate?: string | null;
};

export function salonDisplayName(salon: Pick<SalonMenuInput, 'name' | 'tradingName'>): string {
  return salon.tradingName?.trim() || salon.name;
}

export type MenuCategoryId =
  | 'my_appointments'
  | 'services'
  | 'rewards'
  | 'promotions'
  | 'about'
  | 'support';

/** @deprecated legacy context value — maps to my_appointments */
export type LegacyMenuCategoryId = 'appointments';

export type MainMenuDirectAction = 'book';

export type MainMenuItem =
  | { kind: 'direct'; action: MainMenuDirectAction; label: string }
  | { kind: 'category'; id: MenuCategoryId; label: string };

export const MAIN_MENU_ITEMS: MainMenuItem[] = [
  { kind: 'direct', action: 'book', label: 'Book an appointment' },
  { kind: 'category', id: 'my_appointments', label: 'My Bookings' },
  { kind: 'category', id: 'services', label: 'Services' },
  { kind: 'category', id: 'rewards', label: 'Rewards' },
  { kind: 'category', id: 'promotions', label: 'Promotions' },
  { kind: 'category', id: 'about', label: 'About Us' },
  { kind: 'category', id: 'support', label: 'Support' },
];

export const MAIN_MENU_ROW_IDS = ['1', '2', '3', '4', '5', '6', '7'] as const;

/** Main menu rows for this salon — labels follow the industry template (e.g. "Book a
 *  table" for restaurants), and Rewards is omitted when loyalty is disabled in Settings. */
export function getMainMenuItems(
  salon: Pick<SalonMenuInput, 'botLoyaltyEnabled' | 'industryTemplate'>,
): MainMenuItem[] {
  const template = getIndustryTemplate(salon.industryTemplate);
  const items = MAIN_MENU_ITEMS.map((item) => {
    if (item.kind === 'direct' && item.action === 'book') {
      return { ...item, label: template.bookAction };
    }
    if (item.kind === 'category' && item.id === 'services') {
      return { ...item, label: template.servicesLabel };
    }
    return item;
  });
  if (salon.botLoyaltyEnabled === false) {
    return items.filter((item) => item.kind !== 'category' || item.id !== 'rewards');
  }
  return items;
}

const SUB_MENUS: Record<Exclude<MenuCategoryId, 'services'>, string[]> = {
  my_appointments: ['View', 'Reschedule', 'Cancel'],
  rewards: ['My Points', 'Redeem', 'Referrals'],
  promotions: ['Current Specials', 'Packages', 'Gift Vouchers'],
  about: ['Hours', 'Location', 'Contact', 'Team'],
  support: ['FAQ', 'Leave Review', 'Report Issue', 'Speak To Reception'],
};

export const CATEGORY_LABELS: Record<MenuCategoryId, string> = {
  my_appointments: 'My Bookings',
  services: 'Services',
  rewards: 'Rewards',
  promotions: 'Promotions',
  about: 'About Us',
  support: 'Support',
};

/** @deprecated use MAIN_MENU_ITEMS */
export const MAIN_MENU_CATEGORIES = MAIN_MENU_ITEMS.filter(
  (item): item is Extract<MainMenuItem, { kind: 'category' }> => item.kind === 'category',
);

export type MainMenuSelection =
  | { kind: 'direct'; action: MainMenuDirectAction }
  | { kind: 'category'; id: MenuCategoryId };

export function menuWelcomeLine(salon: SalonMenuInput): string {
  const custom = salon.welcomeMessage?.trim();
  if (custom) return custom;
  return `Welcome to ${salonDisplayName(salon)}! Reply with a number:`;
}

export function buildMainMenuText(salon: SalonMenuInput): string {
  const welcome = menuWelcomeLine(salon);
  const items = getMainMenuItems(salon);
  const lines = items.map((item, i) => `${i + 1} — ${item.label}`);
  const meta =
    typeof salon.metadata === 'object' && salon.metadata
      ? (salon.metadata as Record<string, unknown>)
      : {};
  const special = typeof meta.currentSpecial === 'string' ? meta.currentSpecial.trim() : '';
  const specialLine = special ? `\n🌟 *Special:* ${special}` : '';
  return [
    welcome,
    ...lines,
    '',
    '💬 Or just tell me what you need — e.g. "Monday 15:00 low fade" — and I\'ll book it for you.',
    'Reply BACK anytime for this menu.',
  ].join('\n') + specialLine;
}

export function buildSubMenuText(categoryId: MenuCategoryId | LegacyMenuCategoryId): string {
  const normalized = normalizeMenuCategoryId(categoryId);
  if (!normalized || normalized === 'services') return buildMainMenuText({ name: 'Salon' });
  const title = CATEGORY_LABELS[normalized];
  const items = SUB_MENUS[normalized];
  const lines = items.map((label, i) => `${i + 1} — ${label}`);
  return [`*${title}*`, ...lines, '', 'Reply BACK for main menu.'].join('\n');
}

export function parseMainMenuSelection(
  text: string,
  salon: Pick<SalonMenuInput, 'botLoyaltyEnabled'> = {},
): MainMenuSelection | null {
  const items = getMainMenuItems(salon);
  const n = parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > items.length) return null;
  const item = items[n - 1]!;
  if (item.kind === 'direct') return { kind: 'direct', action: item.action };
  return { kind: 'category', id: item.id };
}

/** @deprecated use parseMainMenuSelection */
export function parseMainMenuChoice(text: string): MenuCategoryId | null {
  const sel = parseMainMenuSelection(text);
  return sel?.kind === 'category' ? sel.id : null;
}

export function parseSubMenuChoice(text: string): number | null {
  const n = parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

const LEGACY_APPOINTMENTS_SUB_COUNT = 4;

export function getSubMenuItemCount(
  category: MenuCategoryId | LegacyMenuCategoryId,
): number {
  if (category === 'appointments') return LEGACY_APPOINTMENTS_SUB_COUNT;
  if (category === 'services') return 0;
  const normalized = normalizeMenuCategoryId(category);
  if (!normalized || normalized === 'services') return 0;
  return SUB_MENUS[normalized]?.length ?? 0;
}

/** Labels for a main-menu category submenu (excludes dynamic Services catalog). */
export function getSubMenuLabels(
  category: Exclude<MenuCategoryId, 'services'> | LegacyMenuCategoryId,
): readonly string[] {
  if (category === 'appointments') {
    return ['Book', ...SUB_MENUS.my_appointments];
  }
  return SUB_MENUS[category];
}

export function isValidSubMenuChoice(
  category: MenuCategoryId | LegacyMenuCategoryId,
  choice: number,
): boolean {
  if (category === 'services') return false;
  return choice >= 1 && choice <= getSubMenuItemCount(category);
}

/** True when input should be handled by handleMenu() instead of AI free-text. */
export function isMenuNavigationInput(
  menuCategory: unknown,
  text: string,
  salon: Pick<SalonMenuInput, 'botLoyaltyEnabled'> = {},
): boolean {
  return isWhatsAppMenuInput(text, menuCategory, salon);
}

/** WhatsApp bot menu/booking input — must not be blocked by dashboard consent or follow-up flows. */
export function isWhatsAppMenuInput(
  text: string,
  menuCategory?: unknown,
  salon: Pick<SalonMenuInput, 'botLoyaltyEnabled'> = {},
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^(back|menu|undo)$/i.test(trimmed)) return true;
  if (trimmed.toUpperCase() === 'REFERRAL') return true;

  const activeCategory =
    menuCategory === 'appointments'
      ? ('appointments' as LegacyMenuCategoryId)
      : normalizeMenuCategoryId(menuCategory);

  if (activeCategory) {
    const sub = parseSubMenuChoice(trimmed);
    if (activeCategory === 'services') return false;
    if (sub != null && isValidSubMenuChoice(activeCategory, sub)) return true;
    return parseMainMenuSelection(trimmed, salon) !== null;
  }

  return parseMainMenuSelection(trimmed, salon) !== null;
}

/** Service category keywords for submenu filtering. */
export const SERVICE_CATEGORY_KEYS = ['hair', 'nails', 'massage', 'beauty'] as const;
export type ServiceCategoryKey = (typeof SERVICE_CATEGORY_KEYS)[number];

export const SERVICE_CATEGORY_ALIASES: Record<ServiceCategoryKey, string[]> = {
  hair: ['hair', 'haircut', 'barber', 'styling', 'cut'],
  nails: ['nail', 'manicure', 'pedicure'],
  massage: ['massage', 'spa', 'body'],
  beauty: ['beauty', 'facial', 'makeup', 'wax', 'skin', 'brow', 'lash'],
};

export function normalizeMenuCategoryId(
  value: unknown,
): MenuCategoryId | null {
  if (value === 'appointments') return 'my_appointments';
  return isMenuCategoryId(value) ? value : null;
}

export function isMenuCategoryId(value: unknown): value is MenuCategoryId {
  return (
    value === 'my_appointments' ||
    value === 'services' ||
    value === 'rewards' ||
    value === 'promotions' ||
    value === 'about' ||
    value === 'support'
  );
}

export type SupportFreeTextIntent = 'leave_review' | 'report_issue' | 'show_support_menu';

const LEAVE_REVIEW_RE =
  /\b(leave\s+a?\s*review|write\s+a?\s*review|google\s+review|rate\s+(my|the|your)?\s*(visit|experience|service)?)\b/i;

const COMPLAIN_OR_FEEDBACK_RE =
  /\b(i\s+)?want\s+to\s+(complain|review|rate|give\s+feedback|share\s+feedback|leave\s+(a\s+)?review)\b/i;

const FEEDBACK_SENTIMENT_RE =
  /\b(complain|complaint|complaining|unhappy|not\s+happy|disappointed|dissatisfied|bad\s+experience|poor\s+service)\b/i;

const REPORT_ISSUE_RE =
  /\b(report\s+(an?\s+)?issue|report\s+a?\s*problem|issue\s+with|problem\s+with)\b/i;

/** Natural-language Support / review phrases while on the main menu (not numeric). */
export function parseFreeTextSupportIntent(text: string): SupportFreeTextIntent | null {
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;
  if (isWhatsAppMenuInput(trimmed)) return null;

  if (REPORT_ISSUE_RE.test(trimmed)) return 'report_issue';

  if (
    LEAVE_REVIEW_RE.test(trimmed) ||
    COMPLAIN_OR_FEEDBACK_RE.test(trimmed) ||
    FEEDBACK_SENTIMENT_RE.test(trimmed) ||
    /\b(feedback|review|rating)\b/i.test(trimmed)
  ) {
    return 'leave_review';
  }

  if (/^support$/i.test(trimmed)) return 'show_support_menu';

  return null;
}
