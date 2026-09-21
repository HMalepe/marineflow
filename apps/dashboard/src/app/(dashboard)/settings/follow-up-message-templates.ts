export type FollowUpMessageKind = 'firstFollowUp' | 'secondFollowUp' | 'closing';

export interface FollowUpMessageTemplate {
  id: string;
  label: string;
  text: string;
}

export interface FollowUpMessageSet {
  id: string;
  label: string;
  description: string;
  firstFollowUp: string;
  secondFollowUp: string;
  closing: string;
}

/** Use {{salonName}} — replaced with trading name when applied in Settings. */
export const FIRST_FOLLOW_UP_TEMPLATES: FollowUpMessageTemplate[] = [
  {
    id: 'warm-check-in',
    label: 'Warm check-in',
    text: "Hi! Still there? Just reply when you're ready and we'll pick up right where we left off 😊",
  },
  {
    id: 'gentle-nudge',
    label: 'Gentle nudge',
    text: "Hey — no rush! Whenever you're ready, send a message and we'll continue your booking.",
  },
  {
    id: 'playful',
    label: 'Playful',
    text: "Still with us? 👋 Tap a reply when you're ready — we haven't gone anywhere!",
  },
  {
    id: 'professional',
    label: 'Professional',
    text: 'Hello — we noticed the conversation paused. Reply at your convenience and we will assist you further.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    text: 'Still there? Reply when ready.',
  },
];

export const SECOND_FOLLOW_UP_TEMPLATES: FollowUpMessageTemplate[] = [
  {
    id: 'soft-close',
    label: 'Soft close',
    text: "No worries — we'll be here whenever you're ready. You can always start fresh by messaging us again 💚",
  },
  {
    id: 'encouraging',
    label: 'Encouraging',
    text: "All good if you got busy! Message us anytime — we'll bring you back to the menu when you're ready ✨",
  },
  {
    id: 'menu-hint',
    label: 'Menu reset',
    text: "We'll leave this here for now. When you reply, we'll show the main menu so you can book or ask a question.",
  },
  {
    id: 'professional',
    label: 'Professional',
    text: 'We will keep your chat open. Reply whenever convenient and we will restore the main menu for you.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    text: "No reply needed — message us anytime to continue.",
  },
];

export const CLOSING_MESSAGE_TEMPLATES: FollowUpMessageTemplate[] = [
  {
    id: 'thank-you',
    label: 'Thank you',
    text: 'Thank you for contacting {{salonName}}! We appreciate your support. Remember — just send us a text and we\'ll respond faster than you can say "{{salonName}}" 😄',
  },
  {
    id: 'see-you-soon',
    label: 'See you soon',
    text: 'Thanks for chatting with {{salonName}} today — we look forward to seeing you soon! 💈',
  },
  {
    id: 'brand-love',
    label: 'Brand love',
    text: 'You\'re amazing — thanks for choosing {{salonName}}! Drop us a WhatsApp anytime. We\'re always happy to help 💚',
  },
  {
    id: 'professional',
    label: 'Professional',
    text: 'Thank you for contacting {{salonName}}. We appreciate your business and look forward to assisting you again.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    text: 'Thanks for messaging {{salonName}} — speak soon!',
  },
];

export const FOLLOW_UP_MESSAGE_SETS: FollowUpMessageSet[] = [
  {
    id: 'friendly-default',
    label: 'Friendly',
    description: 'Warm, casual tone — great for salons & barbers',
    firstFollowUp: FIRST_FOLLOW_UP_TEMPLATES[0]!.text,
    secondFollowUp: SECOND_FOLLOW_UP_TEMPLATES[0]!.text,
    closing: CLOSING_MESSAGE_TEMPLATES[0]!.text,
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Polished and clear — clinics & corporate',
    firstFollowUp: FIRST_FOLLOW_UP_TEMPLATES[3]!.text,
    secondFollowUp: SECOND_FOLLOW_UP_TEMPLATES[3]!.text,
    closing: CLOSING_MESSAGE_TEMPLATES[3]!.text,
  },
  {
    id: 'minimal',
    label: 'Short & direct',
    description: 'Brief messages — fast to read on mobile',
    firstFollowUp: FIRST_FOLLOW_UP_TEMPLATES[4]!.text,
    secondFollowUp: SECOND_FOLLOW_UP_TEMPLATES[4]!.text,
    closing: CLOSING_MESSAGE_TEMPLATES[4]!.text,
  },
  {
    id: 'high-energy',
    label: 'High energy',
    description: 'Upbeat and playful — youth brands',
    firstFollowUp: FIRST_FOLLOW_UP_TEMPLATES[2]!.text,
    secondFollowUp: SECOND_FOLLOW_UP_TEMPLATES[1]!.text,
    closing: CLOSING_MESSAGE_TEMPLATES[2]!.text,
  },
];

/**
 * Retail (dispensary) variants. Salon copy above is untouched — these are built by
 * overriding only the entries whose wording assumes bookings/salons, keeping the same
 * ids and ordering so template matching in the picker behaves identically.
 */
function withRetailText(
  templates: FollowUpMessageTemplate[],
  overrides: Record<string, string>,
): FollowUpMessageTemplate[] {
  return templates.map((t) => {
    const text = overrides[t.id];
    return text ? { ...t, text } : t;
  });
}

export const RETAIL_FIRST_FOLLOW_UP_TEMPLATES: FollowUpMessageTemplate[] = withRetailText(
  FIRST_FOLLOW_UP_TEMPLATES,
  {
    'gentle-nudge':
      "Hey — no rush! Whenever you're ready, send a message and we'll continue your order.",
  },
);

export const RETAIL_SECOND_FOLLOW_UP_TEMPLATES: FollowUpMessageTemplate[] = withRetailText(
  SECOND_FOLLOW_UP_TEMPLATES,
  {
    'menu-hint':
      "We'll leave this here for now. When you reply, we'll show the main menu so you can order or ask a question.",
  },
);

export const RETAIL_CLOSING_MESSAGE_TEMPLATES: FollowUpMessageTemplate[] = withRetailText(
  CLOSING_MESSAGE_TEMPLATES,
  {
    'see-you-soon':
      'Thanks for chatting with {{salonName}} today — we look forward to getting your order to you soon! 📦',
  },
);

const RETAIL_SET_DESCRIPTIONS: Record<string, string> = {
  'friendly-default': 'Warm, casual tone — great for shops & counters',
};

export const RETAIL_FOLLOW_UP_MESSAGE_SETS: FollowUpMessageSet[] = FOLLOW_UP_MESSAGE_SETS.map(
  (set) => {
    const firstIdx = FIRST_FOLLOW_UP_TEMPLATES.findIndex((t) => t.text === set.firstFollowUp);
    const secondIdx = SECOND_FOLLOW_UP_TEMPLATES.findIndex((t) => t.text === set.secondFollowUp);
    const closingIdx = CLOSING_MESSAGE_TEMPLATES.findIndex((t) => t.text === set.closing);
    return {
      ...set,
      description: RETAIL_SET_DESCRIPTIONS[set.id] ?? set.description,
      firstFollowUp: RETAIL_FIRST_FOLLOW_UP_TEMPLATES[firstIdx]?.text ?? set.firstFollowUp,
      secondFollowUp: RETAIL_SECOND_FOLLOW_UP_TEMPLATES[secondIdx]?.text ?? set.secondFollowUp,
      closing: RETAIL_CLOSING_MESSAGE_TEMPLATES[closingIdx]?.text ?? set.closing,
    };
  },
);

export function templatesForKind(
  kind: FollowUpMessageKind,
  retail = false,
): FollowUpMessageTemplate[] {
  switch (kind) {
    case 'firstFollowUp':
      return retail ? RETAIL_FIRST_FOLLOW_UP_TEMPLATES : FIRST_FOLLOW_UP_TEMPLATES;
    case 'secondFollowUp':
      return retail ? RETAIL_SECOND_FOLLOW_UP_TEMPLATES : SECOND_FOLLOW_UP_TEMPLATES;
    case 'closing':
      return retail ? RETAIL_CLOSING_MESSAGE_TEMPLATES : CLOSING_MESSAGE_TEMPLATES;
  }
}

export function followUpMessageSetsFor(retail: boolean): FollowUpMessageSet[] {
  return retail ? RETAIL_FOLLOW_UP_MESSAGE_SETS : FOLLOW_UP_MESSAGE_SETS;
}
