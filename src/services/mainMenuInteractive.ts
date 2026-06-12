import {
  normalizeInteractiveList,
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
} from '../lib/integrations/messaging/interactiveList.js';
import type { InteractiveList } from '../lib/integrations/messaging/types.js';

export {
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
};

/** Row ids align with numbered text menu choices for handleMenu() routing. */
export const MAIN_MENU_ROW_IDS_WITH_LOYALTY = ['1', '2', '3', '4', '5', '6', '7', '8', '0'] as const;
export const MAIN_MENU_ROW_IDS_WITHOUT_LOYALTY = ['1', '2', '4', '5', '6', '7', '8', '0'] as const;

/**
 * Build the main menu as a Meta Cloud API interactive list.
 * Row ids match numeric text-menu choices ("1", "2", …) so handleMenu() works unchanged.
 */
export function buildMainMenuInteractive(salon: {
  name: string;
  welcomeMessage?: string | null;
  botLoyaltyEnabled: boolean;
}): InteractiveList {
  const welcome =
    salon.welcomeMessage?.trim() ||
    `Welcome to ${salon.name}! Tap below to get started.`;

  const rows: InteractiveList['sections'][0]['rows'] = [
    {
      id: '1',
      title: 'Book appointment',
      description: 'Schedule a new visit',
    },
    {
      id: '2',
      title: 'My bookings',
      description: 'View, cancel or reschedule',
    },
  ];

  if (salon.botLoyaltyEnabled) {
    rows.push({
      id: '3',
      title: 'My rewards',
      description: 'Loyalty stamps & rewards',
    });
  }

  rows.push(
    { id: '4', title: 'FAQs', description: 'Common questions answered' },
    { id: '5', title: 'Rate experience', description: 'Tell us how we did' },
    { id: '6', title: 'Contact us', description: 'Phone, email & support' },
    { id: '7', title: 'Business hours', description: 'Opening times' },
    { id: '8', title: 'Find us', description: 'Address & directions' },
    { id: '0', title: 'Something else', description: 'Ask our AI assistant' },
  );

  return normalizeInteractiveList({
    type: 'list',
    body: welcome,
    footer: 'Powered by MarineFlow',
    button: 'Choose option',
    sections: [{ title: 'Main menu', rows }],
  });
}
