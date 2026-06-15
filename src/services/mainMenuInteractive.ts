import {
  normalizeInteractiveList,
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
} from '../lib/integrations/messaging/interactiveList.js';
import type { InteractiveList } from '../lib/integrations/messaging/types.js';
import {
  buildMainMenuText,
  getMainMenuItems,
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
  const welcome = menuWelcomeLine(salon).replace(
    'Reply with a number:',
    'Tap an option below to get started 👇',
  );

  const rows: InteractiveList['sections'][0]['rows'] = getMainMenuItems(salon).map((item, index) => ({
    id: String(index + 1),
    title: truncateListField(item.label, 24),
    description: truncateListField(mainMenuRowDescription(item), 72),
  }));

  return normalizeInteractiveList({
    type: 'list',
    body: welcome,
    footer: truncateListField(salonDisplayName(salon), 60),
    button: 'View options',
    sections: [{ title: 'How can we help you?', rows }],
  });
}

function mainMenuRowDescription(item: ReturnType<typeof getMainMenuItems>[number]): string {
  if (item.kind === 'direct') {
    return item.action === 'book' ? 'Pick a service, date & time' : '';
  }
  switch (item.id) {
    case 'my_appointments':
      return 'View, reschedule or cancel';
    case 'services':
      return 'Browse treatments & pricing';
    case 'rewards':
      return 'Your stamps, rewards & referrals';
    case 'promotions':
      return 'Specials, packages & gift vouchers';
    case 'about':
      return 'Hours, location & contact';
    case 'support':
      return 'FAQ, reviews & speak to reception';
    default:
      return '';
  }
}

/** @deprecated use MAIN_MENU_ROW_IDS — kept for test compatibility */
export const MAIN_MENU_ROW_IDS_WITH_LOYALTY = [...MAIN_MENU_ROW_IDS];
export const MAIN_MENU_ROW_IDS_WITHOUT_LOYALTY = [...MAIN_MENU_ROW_IDS];

export { buildMainMenuText, salonDisplayName };
