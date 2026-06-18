/** Vertical-specific vocabulary for the bot — same flow/menu structure for every
 *  industry, just different labels/keywords/copy. Keyed by `Salon.industryTemplate`. */

export type IndustryTemplateId =
  | 'salon'
  | 'barbershop'
  | 'restaurant'
  | 'spa'
  | 'fitness'
  | 'clinic'
  | 'petgrooming'
  | 'carwash';

export const INDUSTRY_TEMPLATE_IDS: IndustryTemplateId[] = [
  'salon',
  'barbershop',
  'restaurant',
  'spa',
  'fitness',
  'clinic',
  'petgrooming',
  'carwash',
];

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
  spa: {
    id: 'spa',
    label: 'Spa & Wellness',
    bookAction: 'Book a treatment',
    servicesLabel: 'Treatments',
    providerNoun: 'therapist',
    providerNounPlural: 'Therapists',
    bookingExample: 'book a massage',
    nextBookingNoun: 'treatment',
    serviceCategoryAliases: {
      massage: ['massage', 'body', 'deep tissue', 'hot stone', 'reflexology'],
      facial: ['facial', 'skin', 'peel', 'microdermabrasion'],
      wellness: ['wellness', 'sauna', 'steam', 'wrap', 'aromatherapy'],
    },
  },
  fitness: {
    id: 'fitness',
    label: 'Fitness Studio',
    bookAction: 'Book a class',
    servicesLabel: 'Classes',
    providerNoun: 'trainer',
    providerNounPlural: 'Trainers',
    bookingExample: 'book a personal training session',
    nextBookingNoun: 'session',
    serviceCategoryAliases: {
      classes: ['class', 'yoga', 'pilates', 'spin', 'hiit', 'bootcamp'],
      personal: ['personal training', 'pt', 'one on one', '1 on 1', 'coaching'],
      assessment: ['assessment', 'consult', 'body composition'],
    },
  },
  clinic: {
    id: 'clinic',
    label: 'Medical / Dental Clinic',
    bookAction: 'Book a consultation',
    servicesLabel: 'Treatments',
    providerNoun: 'practitioner',
    providerNounPlural: 'Practitioners',
    bookingExample: 'book a consultation',
    nextBookingNoun: 'visit',
    serviceCategoryAliases: {
      consult: ['consult', 'consultation', 'checkup', 'check up', 'exam'],
      dental: ['dental', 'teeth', 'cleaning', 'filling', 'extraction'],
      followup: ['follow up', 'followup', 'review', 'results'],
    },
  },
  petgrooming: {
    id: 'petgrooming',
    label: 'Pet Grooming',
    bookAction: 'Book a grooming slot',
    servicesLabel: 'Services',
    providerNoun: 'groomer',
    providerNounPlural: 'Groomers',
    bookingExample: 'book a grooming session',
    nextBookingNoun: 'groom',
    serviceCategoryAliases: {
      grooming: ['groom', 'grooming', 'bath', 'wash', 'haircut', 'trim'],
      nails: ['nail', 'nail clip', 'claw'],
      extras: ['flea', 'tick', 'deshedding', 'teeth cleaning'],
    },
  },
  carwash: {
    id: 'carwash',
    label: 'Car Wash & Detailing',
    bookAction: 'Book a wash slot',
    servicesLabel: 'Services',
    providerNoun: 'detailer',
    providerNounPlural: 'Detailers',
    bookingExample: 'book a full valet',
    nextBookingNoun: 'wash',
    serviceCategoryAliases: {
      wash: ['wash', 'exterior', 'quick wash'],
      valet: ['valet', 'interior', 'full valet', 'detailing'],
      protection: ['wax', 'polish', 'ceramic', 'coating'],
    },
  },
};

export function getIndustryTemplate(id: string | null | undefined): IndustryTemplate {
  return INDUSTRY_TEMPLATES[isIndustryTemplateId(id) ? id : 'salon'];
}
