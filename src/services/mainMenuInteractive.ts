import {
  normalizeInteractiveList,
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
} from '../lib/integrations/messaging/interactiveList.js';
import type { InteractiveList } from '../lib/integrations/messaging/types.js';
import {
  buildMainMenuText,
  MAIN_MENU_ITEMS,
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
 * Build the main menu as a Meta Cloud API interactive list.
 * Row ids "1"–"7" match text-menu routing in handleMenu().
 */
export function buildMainMenuInteractive(salon: SalonMenuInput): InteractiveList {
  const welcome =
    menuWelcomeLine(salon).replace('Reply with a number:', 'Tap below to get started.');

  const rows: InteractiveList['sections'][0]['rows'] = MAIN_MENU_ITEMS.map((item, index) => ({
    id: String(index + 1),
    title: truncateListField(item.label, 24),
    description: truncateListField(mainMenuRowDescription(item), 72),
  }));

  return normalizeInteractiveList({
    type: 'list',
    body: welcome,
    footer: truncateListField(`Powered by ${salonDisplayName(salon)}`, 60),
    button: 'Main menu',
    sections: [{ title: 'Choose section', rows }],
  });
}

function mainMenuRowDescription(item: (typeof MAIN_MENU_ITEMS)[number]): string {
  if (item.kind === 'direct') {
    return item.action === 'book' ? 'Schedule a new visit' : '';
  }
  switch (item.id) {
    case 'my_appointments':
      return 'View, reschedule, cancel';
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
