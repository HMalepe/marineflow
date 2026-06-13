/** Customer-facing salon name — dashboard trading name, then legal/display name. */
export type SalonMenuInput = {
  name: string;
  tradingName?: string | null;
  welcomeMessage?: string | null;
  metadata?: unknown;
};

export function salonDisplayName(salon: Pick<SalonMenuInput, 'name' | 'tradingName'>): string {
  return salon.tradingName?.trim() || salon.name;
}

export type MenuCategoryId =
  | 'appointments'
  | 'services'
  | 'rewards'
  | 'promotions'
  | 'about'
  | 'support';

export const MAIN_MENU_CATEGORIES: Array<{ id: MenuCategoryId; label: string }> = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'services', label: 'Services' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'about', label: 'About Us' },
  { id: 'support', label: 'Support' },
];

export const MAIN_MENU_ROW_IDS = ['1', '2', '3', '4', '5', '6'] as const;

const SUB_MENUS: Record<MenuCategoryId, string[]> = {
  appointments: ['Book', 'View', 'Reschedule', 'Cancel'],
  services: ['Hair', 'Nails', 'Massage', 'Beauty', 'Prices'],
  rewards: ['My Points', 'Redeem', 'Referrals', 'Coupons'],
  promotions: ['Current Specials', 'Packages', 'Gift Vouchers'],
  about: ['Hours', 'Location', 'Contact', 'Team'],
  support: ['FAQ', 'Leave Review', 'Report Issue', 'Speak To Reception'],
};

export function menuWelcomeLine(salon: SalonMenuInput): string {
  const custom = salon.welcomeMessage?.trim();
  if (custom) return custom;
  return `Welcome to ${salonDisplayName(salon)}! Reply with a number:`;
}

export function buildMainMenuText(salon: SalonMenuInput): string {
  const welcome = menuWelcomeLine(salon);
  const lines = MAIN_MENU_CATEGORIES.map((cat, i) => `${i + 1} — ${cat.label}`);
  const meta =
    typeof salon.metadata === 'object' && salon.metadata
      ? (salon.metadata as Record<string, unknown>)
      : {};
  const special = typeof meta.currentSpecial === 'string' ? meta.currentSpecial.trim() : '';
  const specialLine = special ? `\n🌟 *Special:* ${special}` : '';
  return [welcome, ...lines, '', 'Reply BACK anytime for this menu.'].join('\n') + specialLine;
}

export function buildSubMenuText(categoryId: MenuCategoryId): string {
  const category = MAIN_MENU_CATEGORIES.find((c) => c.id === categoryId);
  const items = SUB_MENUS[categoryId];
  const title = category?.label ?? 'Menu';
  const lines = items.map((label, i) => `${i + 1} — ${label}`);
  return [`*${title}*`, ...lines, '', 'Reply BACK for main menu.'].join('\n');
}

export function parseMainMenuChoice(text: string): MenuCategoryId | null {
  const n = parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > MAIN_MENU_CATEGORIES.length) return null;
  return MAIN_MENU_CATEGORIES[n - 1]!.id;
}

export function parseSubMenuChoice(text: string): number | null {
  const n = parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
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

export function isMenuCategoryId(value: unknown): value is MenuCategoryId {
  return (
    value === 'appointments' ||
    value === 'services' ||
    value === 'rewards' ||
    value === 'promotions' ||
    value === 'about' ||
    value === 'support'
  );
}
