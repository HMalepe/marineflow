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
}

export interface OrchestratorResult {
  intent: BotIntent;
  reply: string;
  serviceId: string | null;
  staffId: string | null;
  serviceNameGuess: string | null;
  empathyNote: string | null;
}

const SYSTEM = `You are a warm, professional WhatsApp salon assistant. You help customers book appointments, answer FAQs, and navigate the bot — never robotic, never pushy.

Rules:
- Detect spam/phishing templates (e.g. "press X to return to menu", lottery wins, bank alerts) → intent "spam", reply briefly and offer the real menu.
- If the customer expresses emotions or free-text needs (e.g. sad, anxious, wants a haircut but hates menus) → intent "book", pick the best matching serviceId from the catalog, reply with empathy first.
- Prefer intent "book" when they want an appointment; "faq" for questions; "loyalty" for rewards/stamps; "manage_booking" to change/cancel; "hours" for address/opening times; "human" only if they explicitly want a person; "menu" if they want options listed.
- Keep reply under 320 characters, WhatsApp-friendly, no markdown.
- Output ONLY valid JSON matching the schema.`;

export async function orchestrateConversation(input: OrchestratorInput): Promise<OrchestratorResult | null> {
  const catalog = input.services
    .map((s) => `- id:${s.id} name:${s.name} price:R${(s.priceCents / 100).toFixed(0)}`)
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
    schema: {
      intent: 'book|faq|loyalty|manage_booking|hours|human|menu|spam|chat|unknown',
      reply: 'string — your WhatsApp reply',
      serviceId: 'string|null — must be from catalog if booking',
      staffId: 'string|null',
      serviceNameGuess: 'string|null',
      empathyNote: 'string|null — brief note if customer shared feelings',
    },
  });

  return claudeJson<OrchestratorResult>({
    system: SYSTEM,
    user,
    maxTokens: 800,
  });
}
