import { ConversationStep, MessageDirection, type Conversation, type Customer, type Salon } from '@prisma/client';
import { DateTime } from 'luxon';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { isConversationWakeMessage } from '../lib/conversationWake.js';
import { isAnthropicConfigured, orchestrateConversation, semanticSearch, claudeText } from '../lib/integrations/ai/index.js';
import { getAvailableSlots, getStaffForService, suggestBookingDates } from './slots.js';
import { logger } from '../lib/logger.js';

export interface QuickPickOption {
  key: string;
  serviceId: string;
  staffId: string;
  slotStartIso: string;
  localDateStr: string;
  label: string;
  /**
   * True when the customer explicitly named this stylist (AI resolved a staff
   * mention), false when the staff was auto-assigned. Drives whether booking
   * confirmation records a §6.1 staff preference. Options serialized before
   * this field existed deserialize as undefined → treated as auto-assigned.
   */
  explicitStaff?: boolean;
}

export interface AiAssistResult {
  handled: boolean;
  reply?: string;
  step?: ConversationStep;
  contextPatch?: Record<string, unknown>;
  /** Forwarded from OrchestratorResult — triggers auto-escalation in bot.ts before handled is checked */
  negativeSentiment?: boolean;
}

function fmtMoney(cents: number): string {
  return `R${(cents / 100).toFixed(0)}`;
}

function resolveServiceId(
  services: Array<{ id: string; name: string }>,
  serviceId: string | null,
  guess: string | null,
  inbound: string,
): string | null {
  if (serviceId && services.some((s) => s.id === serviceId)) return serviceId;
  const hay = `${guess ?? ''} ${inbound}`.toLowerCase();
  const match = services.find((s) => hay.includes(s.name.toLowerCase()));
  return match?.id ?? services[0]?.id ?? null;
}

export async function buildQuickPickOptions(input: {
  salonId: string;
  serviceId: string;
  staffId?: string;
  timezone: string;
  maxOptions?: number;
}): Promise<QuickPickOption[]> {
  const max = input.maxOptions ?? 3;
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: input.serviceId } });
  const staffList = await getStaffForService(input.salonId, input.serviceId);
  if (staffList.length === 0) return [];

  const explicitMatch = input.staffId
    ? staffList.find((s) => s.id === input.staffId)
    : undefined;
  const staff = explicitMatch ?? staffList[0]!;
  const explicitStaff = Boolean(explicitMatch);

  const dates = await suggestBookingDates(input.salonId, 14);
  const options: QuickPickOption[] = [];
  const keys = ['A', 'B', 'C', 'D', 'E'];

  for (const localDateStr of dates) {
    if (options.length >= max) break;
    const { slots, tooLong } = await getAvailableSlots({
      salonId: input.salonId,
      service,
      staff,
      localDateStr,
    });
    if (tooLong || slots.length === 0) continue;

    for (const slot of slots.slice(0, max - options.length)) {
      const key = keys[options.length]!;
      const dt = DateTime.fromJSDate(slot.start).setZone(input.timezone);
      options.push({
        key,
        serviceId: service.id,
        staffId: staff.id,
        slotStartIso: slot.start.toISOString(),
        localDateStr,
        label: `${key}) ${dt.toFormat('ccc dd LLL HH:mm')} — ${service.name} with ${staff.name} (${fmtMoney(service.priceCents)})`,
        explicitStaff,
      });
      if (options.length >= max) break;
    }
  }

  return options;
}

async function loadAssistContext(
  conv: Conversation & { customer: Customer; salon: Salon },
  inboundText: string,
) {
  const db = getTenantDb();
  const [services, staff, faqs, recentMessages] = await Promise.all([
    db.service.findMany({
      where: { salonId: conv.salonId, active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, priceCents: true },
    }),
    db.staff.findMany({
      where: { salonId: conv.salonId, active: true, isBookable: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
      take: 12,
    }),
    db.faqItem.findMany({
      where: { salonId: conv.salonId, status: 'APPROVED' },
      orderBy: { sortOrder: 'asc' },
      take: 8,
      select: { question: true, answer: true },
    }),
    db.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { direction: true, body: true },
    }),
  ]);

  return orchestrateConversation({
    salonName: conv.salon.tradingName ?? conv.salon.name,
    botName: conv.salon.botName,
    openTime: conv.salon.openTime ?? '09:00',
    closeTime: conv.salon.closeTime ?? '17:00',
    timezone: conv.salon.timezone,
    currentStep: conv.step,
    inboundText,
    recentMessages: recentMessages.reverse().map((m) => ({
      direction: m.direction === MessageDirection.INBOUND ? 'in' as const : 'out' as const,
      body: m.body,
    })),
    services,
    staff,
    faqSnippets: faqs,
  });
}

export async function synthesizeFaqAnswer(
  salon: Salon,
  question: string,
  contextChunks: string[],
): Promise<string | null> {
  if (!isAnthropicConfigured()) return null;

  return claudeText({
    system: `You answer FAQ questions for ${salon.name} on WhatsApp. Be warm, concise (max 350 chars), use only the provided context. If unsure, say you'll have the team follow up.`,
    user: `Question: ${question}\n\nContext:\n${contextChunks.join('\n\n')}`,
    maxTokens: 400,
  });
}

export function isBrowseServicesRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    (/\b(let me see|show me|see all|view all|list all|all the|browse)\b/.test(t) &&
      /\b(cut|cuts|service|services|style|styles|option|options|menu)\b/.test(t)) ||
    /\bwhat (cuts|services|options)\b/.test(t) ||
    /\bother (cuts|services|options)\b/.test(t)
  );
}

export async function tryAiAssist(
  conv: Conversation & { customer: Customer; salon: Salon },
  inboundText: string,
): Promise<AiAssistResult> {
  if (!isAnthropicConfigured()) return { handled: false };

  const trimmed = inboundText.trim();
  if (
    !trimmed ||
    isConversationWakeMessage(trimmed) ||
    /^(yes|y|no|back|undo|0|[1-7])$/i.test(trimmed)
  ) {
    return { handled: false };
  }

  try {
    const ai = await loadAssistContext(conv, trimmed);
    if (!ai) return { handled: false };

    // §4.4/§5 — negative sentiment detected: hand off to caller for escalation.
    // Return before the switch so this cannot be bypassed by any intent value.
    if (ai.negativeSentiment) {
      return { handled: false, negativeSentiment: true };
    }

    const services = await getTenantDb().service.findMany({
      where: { salonId: conv.salonId, active: true },
      select: { id: true, name: true },
    });

    switch (ai.intent) {
      case 'spam':
      case 'menu':
        return {
          handled: true,
          reply: `${ai.reply}\n\n_Type *MENU* to see all options._`,
          step: ConversationStep.MENU,
          contextPatch: { quickPickOptions: undefined, menuCategory: undefined },
        };

      case 'hours': {
        const salon = conv.salon;
        const lines = [
          salon.addressLine ?? 'Address not on file.',
          salon.phoneDisplay ? `Phone: ${salon.phoneDisplay}` : '',
          `Hours: ${salon.openTime ?? '09:00'}–${salon.closeTime ?? '17:00'}`,
        ].filter(Boolean);
        return {
          handled: true,
          reply: `${ai.reply}\n\n${lines.join('\n')}\n\n_Type *MENU* to see all options._`,
          step: ConversationStep.MENU,
          contextPatch: { menuCategory: undefined },
        };
      }

      case 'human':
        return { handled: false };

      case 'loyalty':
        return { handled: false };

      case 'manage_booking':
        return { handled: false };

      case 'faq': {
        const results = await semanticSearch(conv.salonId, trimmed, { limit: 3, threshold: 0.65 });
        const chunks = results.map((r) => r.content);
        const synthesized = chunks.length > 0
          ? await synthesizeFaqAnswer(conv.salon, trimmed, chunks)
          : null;
        const answer = synthesized ?? ai.reply;
        return {
          handled: true,
          reply: `${answer}\n\nReply BACK for menu.`,
          step: ConversationStep.FAQ,
        };
      }

      case 'book': {
        const serviceId = resolveServiceId(services, ai.serviceId, ai.serviceNameGuess, trimmed);
        if (!serviceId) {
          return {
            handled: true,
            reply: `${ai.reply}\n\n_Type *MENU* to see all options, or reply with what service you'd like._`,
            step: ConversationStep.MENU,
            contextPatch: { menuCategory: undefined },
          };
        }

        const quickPickOptions = await buildQuickPickOptions({
          salonId: conv.salonId,
          serviceId,
          staffId: ai.staffId ?? undefined,
          timezone: conv.salon.timezone,
        });

        if (quickPickOptions.length === 0) {
          return {
            handled: true,
            reply: `${ai.reply}\n\nI couldn't find any open slots right now — type *MENU* and choose *Appointments › Book* to pick dates manually, or *Support › Speak To Reception* to chat with our team.`,
            step: ConversationStep.MENU,
            contextPatch: { menuCategory: undefined },
          };
        }

        const first = quickPickOptions[0]!;
        return {
          handled: true,
          reply: [
            ai.reply,
            '',
            'Here are times I can hold for you — reply with A, B, or C:',
            ...quickPickOptions.map((o) => o.label),
            '',
            'Or reply BACK for the main menu.',
          ].join('\n'),
          step: ConversationStep.PICK_SLOT,
          contextPatch: {
            selectedServiceId: first.serviceId,
            selectedStaffId: first.staffId,
            localDateStr: first.localDateStr,
            quickPickOptions,
          },
        };
      }

      case 'chat':
      case 'unknown':
      default:
        return {
          handled: true,
          reply: `${ai.reply}\n\n_Type *MENU* anytime to see all options._`,
          step: ConversationStep.MENU,
          contextPatch: { menuCategory: undefined },
        };
    }
  } catch (err) {
    logger.warn({ err, convId: conv.id }, 'ai_assist_failed');
    return { handled: false };
  }
}

export function matchQuickPick(
  text: string,
  options: QuickPickOption[] | undefined,
): QuickPickOption | null {
  if (!options?.length) return null;
  const key = text.trim().toUpperCase();
  return options.find((o) => o.key === key) ?? null;
}
