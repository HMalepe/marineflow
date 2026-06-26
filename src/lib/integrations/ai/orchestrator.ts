import { claudeJson } from './claude.js';

export type BotIntent =
  | 'book'
  | 'faq'
  | 'loyalty'
  | 'manage_booking'
  | 'hours'
  | 'human'
  | 'menu'
  | 'spam'
  | 'chat'
  | 'unknown';

export interface OrchestratorInput {
  salonName: string;
  botName?: string | null;
  openTime: string;
  closeTime: string;
  timezone: string;
  currentStep: string;
  inboundText: string;
  recentMessages: Array<{ direction: 'in' | 'out'; body: string }>;
  services: Array<{ id: string; name: string; priceCents: number }>;
  staff: Array<{ id: string; name: string }>;
  faqSnippets: Array<{ question: string; answer: string }>;
  /** True when the customer has at least one succeeded payment at this salon. */
  hasPaymentHistory?: boolean;
  /** Customer's first name, if already on file — lets the assistant address them by name. */
  customerFirstName?: string | null;
}

export interface OrchestratorResult {
  intent: BotIntent;
  reply: string;
  serviceId: string | null;
  staffId: string | null;
  serviceNameGuess: string | null;
  empathyNote: string | null;
  /** true when the customer is angry, threatening, abusive, extremely frustrated, or in distress */
  negativeSentiment: boolean;
}

const SYSTEM = `You are a warm, professional WhatsApp salon assistant. You help customers book appointments, answer FAQs, and navigate the bot — never robotic, never pushy.

Rules:
- Detect spam/phishing templates (e.g. "press X to return to menu", lottery wins, bank alerts) → intent "spam", reply briefly and offer the real menu.
- If the customer expresses emotions or free-text needs (e.g. sad, anxious, wants a haircut but hates menus) → intent "book", pick the best matching serviceId from the catalog, reply with empathy first.
- Prefer intent "book" when they want an appointment; "faq" for questions; "loyalty" for rewards/stamps; "manage_booking" to change/cancel; "hours" for address/opening times; "human" only if they explicitly want a person; "menu" if they want options listed.
- The services list in the user payload is the ONLY source of truth for service names and prices. NEVER mention a service or price that is not in that list. NEVER invent price ranges.
- In reply, do NOT include any R amounts or price ranges — exact catalog prices are shown separately by the booking system.
- Keep reply under 320 characters, WhatsApp-friendly, no markdown.
- Set negativeSentiment: true if the customer is angry, threatening, abusive, extremely frustrated, or in distress. Do NOT set it for mild frustration or impatience — only genuine negative emotion.
- If hasPaymentHistory is false, do NOT mention "the usual", past visits, "what you usually get", "last time", or imply they are a returning customer — offer to show services or the menu instead.
- If customerFirstName is provided, you already know their name — use it naturally where it fits, and if they ask whether you know their name, confirm it. If customerFirstName is null, say truthfully that you don't have it yet (don't claim to remember a name you weren't given).
- Output ONLY valid JSON matching the schema.`;

export async function orchestrateConversation(input: OrchestratorInput): Promise<OrchestratorResult | null> {
  const catalog = input.services
    .map((s) => `- id:${s.id} name:${s.name} price:${(s.priceCents / 100).toFixed(2)} ZAR`)
    .join('\n');
  const staffList = input.staff.map((s) => `- id:${s.id} name:${s.name}`).join('\n');
  const faqs = input.faqSnippets
    .slice(0, 8)
    .map((f) => `Q: ${f.question}\nA: ${f.answer.slice(0, 200)}`)
    .join('\n\n');
  const history = input.recentMessages
    .slice(-6)
    .map((m) => `${m.direction === 'in' ? 'Customer' : 'Bot'}: ${m.body.slice(0, 300)}`)
    .join('\n');

  const user = JSON.stringify({
    salon: input.salonName,
    botName: input.botName ?? input.salonName,
    hours: `${input.openTime}-${input.closeTime} (${input.timezone})`,
    step: input.currentStep,
    message: input.inboundText,
    recentChat: history,
    services: catalog || '(none configured)',
    staff: staffList || '(any available)',
    faqs: faqs || '(none)',
    hasPaymentHistory: input.hasPaymentHistory ?? false,
    customerFirstName: input.customerFirstName ?? null,
    schema: {
      intent: 'book|faq|loyalty|manage_booking|hours|human|menu|spam|chat|unknown',
      reply: 'string — your WhatsApp reply',
      serviceId: 'string|null — must be from catalog if booking',
      staffId: 'string|null',
      serviceNameGuess: 'string|null',
      empathyNote: 'string|null — brief note if customer shared feelings',
      negativeSentiment: 'boolean — true only for anger/threats/abuse/extreme distress, false otherwise',
    },
  });

  return claudeJson<OrchestratorResult>({
    system: SYSTEM,
    user,
    maxTokens: 800,
  });
}
