import {
  normalizeInteractiveList,
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
} from '../lib/integrations/messaging/interactiveList.js';
import type { InteractiveList } from '../lib/integrations/messaging/types.js';
import {
  buildMainMenuText,
  MAIN_MENU_CATEGORIES,
  MAIN_MENU_ROW_IDS,
  menuWelcomeLine,
  salonDisplayName,
  type SalonMenuInput,
} from '../lib/hierarchicalMenu.js';

export {
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
  MAIN_MENU_ROW_IDS,
};

/**
 * Build the main menu as a Meta Cloud API interactive list (6 categories).
 * Row ids "1"–"6" match text-menu routing in handleMenu().
 */
export function buildMainMenuInteractive(salon: SalonMenuInput): InteractiveList {
  const welcome =
    menuWelcomeLine(salon).replace('Reply with a number:', 'Tap below to get started.');

  const rows: InteractiveList['sections'][0]['rows'] = MAIN_MENU_CATEGORIES.map(
    (cat, index) => ({
      id: String(index + 1),
      title: truncateListField(cat.label, 24),
      description: truncateListField(subMenuDescription(cat.id), 72),
    }),
  );

  return normalizeInteractiveList({
    type: 'list',
    body: welcome,
    footer: truncateListField(`Powered by ${salonDisplayName(salon)}`, 60),
    button: 'Main menu',
    sections: [{ title: 'Choose section', rows }],
  });
}

function subMenuDescription(categoryId: (typeof MAIN_MENU_CATEGORIES)[number]['id']): string {
  switch (categoryId) {
    case 'appointments':
      return 'Book, view, reschedule, cancel';
    case 'services':
      return 'Hair, nails, massage, beauty, prices';
    case 'rewards':
      return 'Points, redeem, referrals, coupons';
    case 'promotions':
      return 'Specials, packages, gift vouchers';
    case 'about':
      return 'Hours, location, contact, team';
    case 'support':
      return 'FAQ, review, report issue, reception';
    default:
      return '';
  }
}

/** @deprecated use MAIN_MENU_ROW_IDS — kept for test compatibility */
export const MAIN_MENU_ROW_IDS_WITH_LOYALTY = [...MAIN_MENU_ROW_IDS];
export const MAIN_MENU_ROW_IDS_WITHOUT_LOYALTY = [...MAIN_MENU_ROW_IDS];

export { buildMainMenuText, salonDisplayName };
