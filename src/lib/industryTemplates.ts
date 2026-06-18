/** Vertical-specific vocabulary for the bot — same flow/menu structure for every
 *  industry, just different labels/keywords/copy. Keyed by `Salon.industryTemplate`. */

export type IndustryTemplateId = 'salon' | 'barbershop' | 'restaurant';

export const INDUSTRY_TEMPLATE_IDS: IndustryTemplateId[] = ['salon', 'barbershop', 'restaurant'];

export function isIndustryTemplateId(value: unknown): value is IndustryTemplateId {
  return typeof value === 'string' && (INDUSTRY_TEMPLATE_IDS as string[]).includes(value);
}

export type IndustryTemplate = {
  id: IndustryTemplateId;
  /** Shown in the super-admin dashboard dropdown. */
  label: string;
  /** Main menu "Book an appointment" row label. */
  bookAction: string;
  /** "Services" category label. */
  servicesLabel: string;
  /** Noun for the person providing the service — used in staff-picker copy. */
  providerNoun: string;
  /** Plural form, e.g. "Stylists" list-picker title. */
  providerNounPlural: string;
  /** Used in fallback/example bot copy, e.g. "book a haircut" / "book a table". */
  bookingExample: string;
  /** Used in reward/referral copy, e.g. "off your next haircut" / "off your next visit". */
  nextBookingNoun: string;
  /** AI-assist keyword buckets for free-text service matching. */
  serviceCategoryAliases: Record<string, string[]>;
};

export const INDUSTRY_TEMPLATES: Record<IndustryTemplateId, IndustryTemplate> = {
  salon: {
    id: 'salon',
    label: 'Hair & Beauty Salon',
    bookAction: 'Book an appointment',
    servicesLabel: 'Services',
    providerNoun: 'stylist',
    providerNounPlural: 'Stylists',
    bookingExample: 'book a haircut',
    nextBookingNoun: 'haircut',
    serviceCategoryAliases: {
      hair: ['hair', 'haircut', 'barber', 'styling', 'cut'],
      nails: ['nail', 'manicure', 'pedicure'],
      massage: ['massage', 'spa', 'body'],
      beauty: ['beauty', 'facial', 'makeup', 'wax', 'skin', 'brow', 'lash'],
    },
  },
  barbershop: {
    id: 'barbershop',
    label: 'Barbershop',
    bookAction: 'Book an appointment',
    servicesLabel: 'Services',
    providerNoun: 'barber',
    providerNounPlural: 'Barbers',
    bookingExample: 'book a haircut',
    nextBookingNoun: 'cut',
    serviceCategoryAliases: {
      hair: ['haircut', 'fade', 'trim', 'cut', 'shape up'],
      beard: ['beard', 'shave', 'lineup', 'line up'],
      beauty: ['facial', 'wax'],
    },
  },
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    bookAction: 'Book a table',
    servicesLabel: 'Menu',
    providerNoun: 'waiter',
    providerNounPlural: 'Waiters',
    bookingExample: 'book a table',
    nextBookingNoun: 'visit',
    serviceCategoryAliases: {
      mains: ['main', 'meal', 'lunch', 'dinner', 'plate'],
      drinks: ['drink', 'beverage', 'cocktail', 'wine', 'beer'],
      desserts: ['dessert', 'sweet', 'cake'],
    },
  },
};

export function getIndustryTemplate(id: string | null | undefined): IndustryTemplate {
  return INDUSTRY_TEMPLATES[isIndustryTemplateId(id) ? id : 'salon'];
}
