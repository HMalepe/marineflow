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

export function templatesForKind(kind: FollowUpMessageKind): FollowUpMessageTemplate[] {
  switch (kind) {
    case 'firstFollowUp':
      return FIRST_FOLLOW_UP_TEMPLATES;
    case 'secondFollowUp':
      return SECOND_FOLLOW_UP_TEMPLATES;
    case 'closing':
      return CLOSING_MESSAGE_TEMPLATES;
  }
}
