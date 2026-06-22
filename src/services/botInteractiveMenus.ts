import { DateTime } from 'luxon';
import { formatCentsZar } from '../lib/formatPrice.js';
import {
  CATEGORY_LABELS,
  getSubMenuLabels,
  salonDisplayName,
  type MenuCategoryId,
  type SalonMenuInput,
} from '../lib/hierarchicalMenu.js';
import { getIndustryTemplate } from '../lib/industryTemplates.js';
import { truncateListField } from '../lib/integrations/messaging/interactiveList.js';
import { withRatingFeedbackPreamble } from '../lib/feedbackCopy.js';
import type { InteractiveButtons, InteractiveList, InteractiveMessage } from '../lib/integrations/messaging/types.js';
import type { QuickPickOption } from './botAssistant.js';
import type { ServiceSubMenuOption } from './serviceMenuCatalog.js';

const MAX_LIST_ROWS = 10;

function footerForSalon(salon: SalonMenuInput): string | undefined {
  const f = truncateListField(`Powered by ${salonDisplayName(salon)}`, 60);
  return f || undefined;
}

function numberedList(
  body: string,
  buttonLabel: string,
  sectionTitle: string,
  items: Array<{ id: string; title: string; description?: string }>,
  footer?: string,
): InteractiveList | null {
  if (items.length === 0) return null;
  const rows = items.slice(0, MAX_LIST_ROWS).map((item) => ({
    id: item.id,
    title: truncateListField(item.title, 24),
    description: item.description ? truncateListField(item.description, 72) : undefined,
  }));
  return {
    type: 'list',
    body: truncateListField(body, 1024),
    footer,
    button: truncateListField(buttonLabel, 20),
    sections: [{ title: truncateListField(sectionTitle, 24), rows }],
  };
}

function quickButtons(
  body: string,
  buttons: Array<{ id: string; title: string }>,
  footer?: string,
): InteractiveButtons | null {
  if (buttons.length === 0) return null;
  return {
    type: 'button',
    body: truncateListField(body, 1024),
    footer,
    buttons: buttons.slice(0, 3).map((b) => ({
      id: b.id,
      title: truncateListField(b.title, 20),
    })),
  };
}

/** Main-menu category submenu (My Bookings, Rewards, etc.). */
export function buildCategorySubMenuInteractive(
  categoryId: MenuCategoryId | 'appointments',
  salon: SalonMenuInput,
): InteractiveMessage | null {
  if (categoryId === 'services') return null;
  const title =
    categoryId === 'appointments' ? CATEGORY_LABELS.my_appointments : CATEGORY_LABELS[categoryId];
  const labels = [...getSubMenuLabels(categoryId)];
  const footer = footerForSalon(salon);
  const body = `*${title}*\nTap below to choose.`;

  if (labels.length <= 3) {
    return quickButtons(
      body,
      labels.map((label, i) => ({ id: String(i + 1), title: label })),
      footer,
    );
  }

  return numberedList(
    body,
    'Choose option',
    title,
    labels.map((label, i) => ({ id: String(i + 1), title: label })),
    footer,
  );
}

/** Services submenu from live dashboard categories. */
export function buildServicesSubMenuInteractive(
  options: ServiceSubMenuOption[],
  salon: SalonMenuInput,
): InteractiveMessage | null {
  if (options.length === 0) return null;
  const footer = footerForSalon(salon);
  const body = '*Services*\nTap below to browse.';

  if (options.length <= 3) {
    return quickButtons(
      body,
      options.map((o, i) => ({ id: String(i + 1), title: o.label })),
      footer,
    );
  }

  return numberedList(
    body,
    'Services',
    'Services',
    options.map((o, i) => ({ id: String(i + 1), title: o.label })),
    footer,
  );
}

export function buildServicePickerInteractive(
  services: Array<{ name: string; priceCents: number }>,
  page: number,
  pageSize: number,
  salon: SalonMenuInput,
  header?: string,
): InteractiveMessage | null {
  const start = page * pageSize;
  const slice = services.slice(start, start + pageSize);
  const listSlice = slice.slice(0, MAX_LIST_ROWS);
  if (listSlice.length === 0) return null;

  const body =
    header ??
    (services.length > pageSize
      ? `Pick a service (${start + 1}–${start + listSlice.length} of ${services.length}):`
      : 'Pick a service:');

  return numberedList(
    truncateListField(body, 1024),
    'Pick service',
    'Services',
    listSlice.map((s, i) => ({
      id: String(start + i + 1),
      title: s.name,
      description: formatCentsZar(s.priceCents),
    })),
    footerForSalon(salon),
  );
}

export function buildStaffPickerInteractive(
  staffList: Array<{ id: string; name: string }>,
  preferredId: string | null,
  salon: SalonMenuInput,
  header?: string,
): InteractiveMessage | null {
  const template = getIndustryTemplate(salon.industryTemplate);
  const items = [
    ...staffList.map((s, i) => ({
      id: String(i + 1),
      title: s.name,
      description: s.id === preferredId ? `Your last ${template.providerNoun}` : undefined,
    })),
    { id: String(staffList.length + 1), title: 'Any available', description: undefined },
  ];

  return numberedList(
    truncateListField(header ?? `Choose ${template.providerNoun}:`, 1024),
    `Choose ${template.providerNoun}`,
    template.providerNounPlural,
    items.slice(0, MAX_LIST_ROWS),
    footerForSalon(salon),
  );
}

export function buildDatePickerInteractive(
  isoDates: string[],
  timezone: string,
  salon: SalonMenuInput,
  prefix?: string,
): InteractiveMessage | null {
  const slice = isoDates.slice(0, MAX_LIST_ROWS);
  if (slice.length === 0) return null;

  const body = prefix ?? '📅 When would you like to come in?';
  return numberedList(
    truncateListField(body, 1024),
    'Pick date',
    'Dates',
    slice.map((iso, i) => {
      const dt = DateTime.fromISO(iso).setZone(timezone);
      return { id: String(i + 1), title: dt.toFormat('ccc dd LLL'), description: dt.toFormat('yyyy') };
    }),
    footerForSalon(salon),
  );
}

/**
 * Flattened date+time picker: each row is a specific day+time slot (e.g. "Today 14:00",
 * "Tomorrow 09:00"), so the customer picks both in one tap. An optional trailing row
 * offers "More dates" for customers who want a day further out than the soonest options.
 */
export function buildCombinedSlotPickerInteractive(
  slots: Array<{ start: Date; localDateStr: string }>,
  timezone: string,
  salon: SalonMenuInput,
  options: { hasMore?: boolean; header?: string } = {},
): InteractiveMessage | null {
  if (slots.length === 0) return null;
  const today = DateTime.now().setZone(timezone).startOf('day');

  const items = slots.slice(0, MAX_LIST_ROWS - 1).map((s, i) => {
    const dt = DateTime.fromJSDate(s.start).setZone(timezone);
    const dayDiff = Math.round(dt.startOf('day').diff(today, 'days').days);
    const dayLabel = dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : dt.toFormat('ccc dd LLL');
    return {
      id: String(i + 1),
      title: truncateListField(`${dayLabel} ${dt.toFormat('HH:mm')}`, 24),
      description: dayDiff <= 1 ? dt.toFormat('ccc dd LLL') : undefined,
    };
  });

  if (options.hasMore) {
    items.push({ id: String(items.length + 1), title: 'More dates', description: 'See a different day' });
  }

  return numberedList(
    truncateListField(options.header ?? '⚡ *Soonest available times* — tap one below:', 1024),
    'Pick a time',
    'Available',
    items,
    footerForSalon(salon),
  );
}

export function buildSlotPickerInteractive(
  slots: Array<{ start: Date }>,
  timezone: string,
  salon: SalonMenuInput,
  header?: string,
): InteractiveMessage | null {
  const slice = slots.slice(0, MAX_LIST_ROWS);
  if (slice.length === 0) return null;

  return numberedList(
    truncateListField(header ?? 'Pick a time:', 1024),
    'Pick time',
    'Times',
    slice.map((s, i) => {
      const dt = DateTime.fromJSDate(s.start).setZone(timezone);
      return { id: String(i + 1), title: dt.toFormat('HH:mm'), description: dt.toFormat('ccc') };
    }),
    footerForSalon(salon),
  );
}

export function buildBranchPickerInteractive(
  branches: Array<{ name: string; city?: string | null }>,
  salon: SalonMenuInput,
): InteractiveMessage | null {
  return numberedList(
    'Which location?',
    'Locations',
    'Locations',
    branches.slice(0, MAX_LIST_ROWS).map((b, i) => ({
      id: String(i + 1),
      title: b.name,
      description: b.city ? truncateListField(b.city, 72) : undefined,
    })),
    footerForSalon(salon),
  );
}

export function buildServiceCategoryPickerInteractive(
  categories: Array<{ name: string }>,
  hasUncategorised: boolean,
  salon: SalonMenuInput,
): InteractiveMessage | null {
  const items = categories.map((c, i) => ({ id: String(i + 1), title: c.name }));
  if (hasUncategorised) {
    items.push({ id: String(items.length + 1), title: 'Other / Uncategorised' });
  }
  return numberedList(
    'What type of service are you looking for?',
    'Categories',
    'Categories',
    items.slice(0, MAX_LIST_ROWS),
    footerForSalon(salon),
  );
}

export function buildWriteFeedbackInteractive(): InteractiveButtons {
  return quickButtons(
    'Prefer to message us directly?',
    [{ id: 'write_review', title: 'Write Feedback' }],
  )!;
}

export function buildInactivityReminderInteractive(salon: SalonMenuInput, body: string): InteractiveButtons {
  return quickButtons(
    body,
    [
      { id: 'continue', title: 'Continue' },
      { id: 'menu', title: 'Main Menu' },
    ],
    footerForSalon(salon),
  )!;
}

export function buildConfirmBookingInteractive(salon: SalonMenuInput, body: string): InteractiveButtons {
  return quickButtons(
    body,
    [
      { id: 'yes', title: 'Yes, confirm' },
      { id: 'back', title: 'Back' },
    ],
    footerForSalon(salon),
  )!;
}

export function buildBookingRatingBody(): string {
  return [
    `✨ *One quick thing — while it's fresh*`,
    '',
    `How easy was booking with us just now?`,
    '',
    `Your honest tap helps us refine the experience for you and every guest who books after.`,
    '',
    withRatingFeedbackPreamble(`Takes two seconds — tap your rating below.`),
  ].join('\n');
}

export function buildStarRatingPromptBody(): string {
  return withRatingFeedbackPreamble(
    '⭐ *Share your experience*\n\nHow would you rate your last visit?',
  );
}

export function buildNpsRatingPromptBody(): string {
  return withRatingFeedbackPreamble(
    'On a scale of 1–10, how likely are you to recommend us to a friend?\n_(1 = not at all · 10 = absolutely)_',
  );
}

/** Post-booking process rating — interactive list (1–5 + skip). */
export function buildBookingRatingInteractive(salon: SalonMenuInput): InteractiveMessage {
  return numberedList(
    buildBookingRatingBody(),
    'Rate booking',
    'Your experience',
    [
      { id: '5', title: '⭐⭐⭐⭐⭐', description: 'Effortless — loved it' },
      { id: '4', title: '⭐⭐⭐⭐', description: 'Smooth & simple' },
      { id: '3', title: '⭐⭐⭐', description: 'Fine — room to improve' },
      { id: '2', title: '⭐⭐', description: 'A bit clunky' },
      { id: '1', title: '⭐', description: 'Frustrating' },
      { id: 'skip', title: 'Skip for now', description: 'Jump to main menu' },
    ],
    footerForSalon(salon),
  )!;
}

export function buildBookingPopiaInteractive(salon: SalonMenuInput): InteractiveButtons {
  return quickButtons(
    'To continue booking we need your consent to store your details (POPIA).',
    [
      { id: 'yes', title: 'Yes, accept' },
      { id: 'no', title: 'No, decline' },
    ],
    footerForSalon(salon),
  )!;
}

/** First-contact combined gate — POPIA data-storage consent + optional marketing opt-in in one ask. */
export function buildCombinedConsentInteractive(salon: SalonMenuInput, body: string): InteractiveButtons {
  return quickButtons(
    body,
    [
      { id: 'accept_all', title: 'Accept all' },
      { id: 'booking_only', title: 'Booking only' },
      { id: 'decline', title: 'No thanks' },
    ],
    footerForSalon(salon),
  )!;
}

export function buildQuickPickInteractive(
  options: QuickPickOption[],
  salon: SalonMenuInput,
  leadText?: string,
): InteractiveMessage | null {
  const slice = options.slice(0, 3);
  if (slice.length === 0) return null;

  const body = leadText ?? 'Here are times I can hold for you:';
  if (slice.length <= 3) {
    return quickButtons(
      body,
      slice.map((o) => ({ id: o.key, title: o.key })),
      footerForSalon(salon),
    );
  }

  return numberedList(
    body,
    'Pick time',
    'Times',
    slice.map((o) => ({
      id: o.key,
      title: truncateListField(o.label, 24),
    })),
    footerForSalon(salon),
  );
}

export function buildConfirmCancelInteractive(salon: SalonMenuInput): InteractiveButtons {
  return quickButtons(
    'Reply YES to confirm cancellation, or tap below.',
    [
      { id: 'yes', title: 'Yes, cancel' },
      { id: 'no', title: 'Keep booking' },
    ],
    footerForSalon(salon),
  )!;
}

export function buildManageBookingActionsInteractive(salon: SalonMenuInput): InteractiveButtons {
  return quickButtons(
    'What would you like to do with this booking?',
    [
      { id: 'cancel', title: 'Cancel' },
      { id: 'reschedule', title: 'Reschedule' },
      { id: 'back', title: 'Back' },
    ],
    footerForSalon(salon),
  )!;
}

export function buildManageBookingListInteractive(
  appointments: Array<{ serviceName: string; whenLabel: string }>,
  salon: SalonMenuInput,
  header: string,
): InteractiveMessage | null {
  if (appointments.length === 0) return null;
  return numberedList(
    truncateListField(header, 1024),
    'Pick booking',
    'Upcoming',
    appointments.slice(0, MAX_LIST_ROWS).map((a, i) => ({
      id: String(i + 1),
      title: truncateListField(a.serviceName, 24),
      description: truncateListField(a.whenLabel, 72),
    })),
    footerForSalon(salon),
  );
}

export function buildFaqListInteractive(
  faqs: Array<{ question: string }>,
  salon: SalonMenuInput,
): InteractiveMessage | null {
  if (faqs.length === 0) return null;
  return numberedList(
    'FAQs — tap a question or type your own:',
    'Pick FAQ',
    'FAQs',
    faqs.slice(0, MAX_LIST_ROWS).map((f, i) => ({
      id: String(i + 1),
      title: truncateListField(f.question, 24),
    })),
    footerForSalon(salon),
  );
}

const STAR_LABELS = ['Poor', 'Below average', 'Average', 'Good', 'Excellent'] as const;

export function buildStarRatingInteractive(salon: SalonMenuInput): InteractiveMessage {
  return numberedList(
    buildStarRatingPromptBody(),
    'Pick rating',
    'Rating',
    STAR_LABELS.map((label, i) => ({
      id: String(i + 1),
      title: `${i + 1} star${i === 0 ? '' : 's'}`,
      description: label,
    })),
    footerForSalon(salon),
  )!;
}

export function buildNpsRatingInteractive(salon: SalonMenuInput): InteractiveMessage {
  return numberedList(
    buildNpsRatingPromptBody(),
    'Pick score',
    'NPS',
    Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      title: String(i + 1),
      description: i + 1 <= 6 ? 'Unlikely' : i + 1 <= 8 ? 'Neutral' : 'Likely',
    })),
    footerForSalon(salon),
  )!;
}

export function buildSkipOnlyInteractive(body: string, salon: SalonMenuInput): InteractiveButtons {
  return quickButtons(body, [{ id: 'skip', title: 'Skip' }], footerForSalon(salon))!;
}

/** Companion to the PayFast CTA — one-tap cash choice without typing "2". */
export function buildPaymentCashOptionInteractive(salon: SalonMenuInput): InteractiveButtons {
  return quickButtons(
    `Or pay when you arrive — no card needed.`,
    [{ id: '2', title: 'Cash on arrival' }],
    footerForSalon(salon),
  )!;
}

export function buildTeamListInteractive(
  team: Array<{ name: string; specialties?: string[] }>,
  salon: SalonMenuInput,
): InteractiveMessage | null {
  if (team.length === 0) return null;
  return numberedList(
    '*Our team*',
    'View team',
    'Team',
    team.slice(0, MAX_LIST_ROWS).map((s, i) => ({
      id: String(i + 1),
      title: s.name,
      description: s.specialties?.length ? truncateListField(s.specialties.slice(0, 2).join(', '), 72) : undefined,
    })),
    footerForSalon(salon),
  );
}

export function buildCategoryServiceListInteractive(
  label: string,
  services: Array<{ name: string; priceCents: number }>,
  salon: SalonMenuInput,
): InteractiveMessage | null {
  return numberedList(
    `*${truncateListField(label, 40)}*\nTap a service to book.`,
    'Pick service',
    truncateListField(label, 24),
    services.slice(0, MAX_LIST_ROWS).map((s, i) => ({
      id: String(i + 1),
      title: s.name,
      description: formatCentsZar(s.priceCents),
    })),
    footerForSalon(salon),
  );
}
