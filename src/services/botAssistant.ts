import { ConversationStep, MessageDirection, type Conversation, type Customer, type Salon } from '@prisma/client';
import { DateTime } from 'luxon';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { isConversationWakeMessage } from '../lib/conversationWake.js';
import { formatCentsZar } from '../lib/formatPrice.js';
import { isAnthropicConfigured, orchestrateConversation, semanticSearch, claudeText } from '../lib/integrations/ai/index.js';
import { loadSalonServiceCatalog, sanitizeAiBookReply, filterBookableCatalogServices, isAddonCatalogService } from './serviceCatalogDisplay.js';
import { getAvailableSlots, getStaffForService, suggestBookingDates } from './slots.js';
import { parseNaturalDateTime } from './naturalDateTime.js';
import { pickCompliment } from './personalization.js';
import { logger } from '../lib/logger.js';
import { createConfirmedAppointment } from './bookingConfirm.js';
import { createPaymentCheckoutSession } from './payments.js';
import { onBookingConfirmed } from './botPowerFeatures.js';
import { buildPopiaRightsHint, notifyPopiaRightsOnce } from './compliance.js';
import type { Service, Staff } from '@prisma/client';

/** EC-13: Strip WhatsApp markdown chars from user-controlled strings to prevent formatting injection. */
function sanitize(s: string): string {
  return s.replace(/[*_~`[\]]/g, '');
}

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
  return formatCentsZar(cents);
}

/**
 * Match a named entity (service or staff) from free text (menu tap title, typed
 * name, or sentence). Prefers exact matches, then longest unambiguous substring
 * match — never defaults to the first item in the list.
 */
function matchNameInText(entities: Array<{ id: string; name: string }>, text: string): string | null {
  const hay = text.toLowerCase().trim();
  if (!hay || entities.length === 0) return null;

  type Scored = { id: string; score: number };
  const scored: Scored[] = [];
  for (const s of entities) {
    const name = s.name.toLowerCase();
    if (hay === name) {
      scored.push({ id: s.id, score: name.length + 1000 });
    } else if (hay.includes(name)) {
      scored.push({ id: s.id, score: name.length });
    } else if (name.includes(hay) && hay.length >= 3) {
      scored.push({ id: s.id, score: hay.length });
    }
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const runnerUp = scored[1];
  if (runnerUp && runnerUp.score === best.score) return null;
  return best.id;
}

/**
 * Match a service from free text (menu tap title, typed name, or sentence).
 * Prefers exact matches, then longest unambiguous substring match — never defaults
 * to the first catalog item.
 */
export function matchServiceInText(
  services: Array<{ id: string; name: string }>,
  text: string,
): string | null {
  return matchNameInText(services, text);
}

/**
 * Match a staff member by name from free text, e.g. "stylist Mmaki" or a returning
 * customer naming who they want in a compound booking message. Same scoring rules
 * as matchServiceInText — never guesses when ambiguous.
 */
export function matchStaffInText(
  staff: Array<{ id: string; name: string }>,
  text: string,
): string | null {
  return matchNameInText(staff, text);
}

/** Party-size bound shared with the CONFIRM_BOOKING free-text capture step. */
const MIN_PARTY_SIZE = 2;
const MAX_PARTY_SIZE = 20;

/**
 * Extract a party size from free text like "for 2 people" or "table of 4" —
 * keyword-anchored so it never mistakes a date/time/phone digit for a headcount.
 */
export function extractPartySize(text: string): number | null {
  const m =
    text.match(/\b(\d{1,2})\s*(?:people|persons?|pax|ppl|guests?)\b/i) ??
    text.match(/\b(?:party|table|group)\s+of\s+(\d{1,2})\b/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  if (n >= MIN_PARTY_SIZE && n <= MAX_PARTY_SIZE) return n;
  return null;
}

function resolveServiceId(
  services: Array<{ id: string; name: string }>,
  serviceId: string | null,
  guess: string | null,
  inbound: string,
): string | null {
  const fromInbound = matchServiceInText(services, inbound);
  if (fromInbound) return fromInbound;
  if (guess) {
    const fromGuess = matchServiceInText(services, guess);
    if (fromGuess) return fromGuess;
  }
  if (serviceId && services.some((s) => s.id === serviceId)) return serviceId;
  return null;
}

export async function buildQuickPickOptions(input: {
  salonId: string;
  serviceId: string;
  staffId?: string;
  timezone: string;
  maxOptions?: number;
}): Promise<QuickPickOption[]> {
  const max = input.maxOptions ?? 3;
  const service = await getTenantDb().service.findUniqueOrThrow({
    where: { id: input.serviceId },
    include: { category: true },
  });
  if (isAddonCatalogService(service)) {
    return [];
  }
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
  const [services, staff, faqs, recentMessages, succeededPayments] = await Promise.all([
    loadSalonServiceCatalog(conv.salonId).then((rows) =>
      filterBookableCatalogServices(rows).map((s) => ({
        id: s.id,
        name: s.name,
        priceCents: s.priceCents,
      })),
    ),
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
    db.payment.count({
      where: { salonId: conv.salonId, customerId: conv.customerId, status: 'SUCCEEDED' },
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
    hasPaymentHistory: succeededPayments > 0,
  });
}

export async function synthesizeFaqAnswer(
  salon: Salon,
  question: string,
  contextChunks: string[],
): Promise<string | null> {
  if (!isAnthropicConfigured()) return null;

  return claudeText({
    system: `You answer FAQ questions for ${salon.name} on WhatsApp. Be warm, concise (max 350 chars), use only the provided context. Never invent services or prices — only state prices that appear verbatim in the context. If unsure, say you'll have the team follow up.`,
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

const STRUCTURED_BOOKING_STEPS: ConversationStep[] = [
  ConversationStep.PICK_BRANCH,
  ConversationStep.PICK_SERVICE_CATEGORY,
  ConversationStep.PICK_SERVICE,
  ConversationStep.PICK_STAFF,
  ConversationStep.PICK_DATE,
  ConversationStep.PICK_SLOT,
  ConversationStep.CONFIRM_BOOKING,
];

async function pickLeastBusyStaff<T extends { id: string }>(staffList: T[]): Promise<T> {
  const counts = await Promise.all(
    staffList.map(async (s) => ({
      id: s.id,
      count: await getTenantDb().appointment.count({
        where: {
          staffId: s.id,
          start: { gte: new Date() },
          status: { notIn: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'] },
        },
      }),
    })),
  );
  counts.sort((a, b) => a.count - b.count);
  return staffList.find((s) => s.id === counts[0]!.id)!;
}

/**
 * Books immediately — no "Reply YES" round trip and no separate "choose payment
 * method" menu — when a free-text first message already resolves service, staff,
 * date, and an exact available time slot to a single outbound confirmation +
 * payment link. Falls back to null (caller shows the normal "Reply YES" confirm
 * prompt) on any guardrail failure, so the slower always-safe path is the
 * fallback rather than a second silent attempt.
 */
async function tryInstantConfirm(
  conv: Conversation & { customer: Customer; salon: Salon },
  service: Service,
  staff: Staff,
  start: Date,
  partySize: number | null,
  explicitStaff: boolean,
): Promise<AiAssistResult | null> {
  const result = await createConfirmedAppointment({
    conv,
    service,
    staff,
    start,
    partySize: partySize ?? 1,
    anyStaff: !explicitStaff,
  });
  if (!result.ok) return null;

  const { appointment, end, paymentPlan, isFirstBooking, bookingNotes } = result;
  const zone = conv.salon.timezone;
  const dt = DateTime.fromJSDate(start).setZone(zone);
  const firstName = conv.customer.firstName?.trim();
  const ref = appointment.id.slice(0, 8).toUpperCase();

  const lines = [
    bookingNotes ? `${bookingNotes}\n` : '',
    firstName ? `✅ *You're all set, ${sanitize(firstName)}!*` : `✅ *Booking confirmed!*`,
    '',
    `📋 *${sanitize(service.name)}*`,
    `👤 with ${sanitize(staff.name)}`,
    `📅 ${dt.toFormat('cccc, d MMMM yyyy')}`,
    `🕐 ${dt.toFormat('HH:mm')} – ${DateTime.fromJSDate(end).setZone(zone).toFormat('HH:mm')}`,
    partySize && partySize > 1 ? `👥 Party size: ${partySize}` : '',
    '',
    `🔖 Ref: *${ref}*`,
    '',
    `_Not what you meant? Reply *UNDO* within 15 minutes to cancel this — no charge._`,
  ];

  if (paymentPlan) {
    try {
      const sessionUrl = await createPaymentCheckoutSession({
        salonId: conv.salonId,
        customerId: conv.customerId,
        appointmentId: appointment.id,
        service,
        amountCents: paymentPlan.amountCents,
      });
      if (sessionUrl) {
        lines.push(
          '',
          `💳 *Complete payment*`,
          `Amount due: *${fmtMoney(paymentPlan.amountCents)}*`,
          '',
          `Pay securely via PayFast:`,
          sessionUrl,
          '',
          `_We'll mark your booking as paid once payment goes through._`,
        );
      } else {
        lines.push(
          '',
          'We could not generate a payment link right now — you can pay in-store or contact us to pay over the phone.',
        );
      }
    } catch (err) {
      logger.warn({ err, appointmentId: appointment.id }, 'instant_confirm_payment_link_failed');
      lines.push(
        '',
        'We could not generate a payment link right now — you can pay in-store or contact us to pay over the phone.',
      );
    }
  } else {
    void onBookingConfirmed({
      id: appointment.id,
      salonId: conv.salonId,
      start,
      status: appointment.status,
      salon: conv.salon,
    }).catch((err) => logger.warn({ err, appointmentId: appointment.id }, 'reminder_schedule_failed'));
  }

  if (isFirstBooking) {
    await notifyPopiaRightsOnce(conv.id, async () => {
      lines.push('', buildPopiaRightsHint());
    });
  }

  if (!paymentPlan) {
    lines.push(
      '',
      'How was the booking process? Reply 1–5 ⭐ (1 = frustrating, 5 = super easy)\nOr reply *SKIP* to go to the menu.',
    );
  } else {
    lines.push(
      '',
      firstName
        ? `_See you then, ${sanitize(firstName)}! Reply *MENU* anytime to manage your bookings._`
        : `_Reply *MENU* anytime to manage your bookings._`,
    );
  }

  return {
    handled: true,
    reply: lines.filter(Boolean).join('\n'),
    step: paymentPlan ? ConversationStep.IDLE : ConversationStep.BOOKING_RATING,
    contextPatch: {
      selectedServiceId: service.id,
      selectedStaffId: staff.id,
      anyStaff: !explicitStaff,
      pendingAppointmentId: appointment.id,
      pendingPaymentAmountCents: paymentPlan?.amountCents,
      pendingPaymentIsFirstBooking: isFirstBooking,
      partySize: undefined,
      quickPickOptions: undefined,
    },
  };
}

/**
 * When a free-text booking request already names a date/time (parsed via
 * parseNaturalDateTime), try to resolve it directly to a bookable slot so the
 * customer can bypass staff-pick, date-pick, and slot-pick in one message.
 * Falls back to the generic quick-pick flow by returning null.
 */
async function tryDirectDateTimeBooking(
  conv: Conversation & { customer: Customer; salon: Salon },
  trimmed: string,
  serviceId: string,
  explicitStaffId: string | null,
): Promise<AiAssistResult | null> {
  const parsed = await parseNaturalDateTime(trimmed, conv.salon.timezone);
  if (!parsed) return null;

  const service = await getTenantDb().service.findUnique({
    where: { id: serviceId },
    include: { category: true },
  });
  if (!service || isAddonCatalogService(service)) return null;

  const staffList = await getStaffForService(conv.salonId, serviceId);
  if (staffList.length === 0) return null;

  const explicitMatch = explicitStaffId ? staffList.find((s) => s.id === explicitStaffId) : undefined;
  const explicitStaff = Boolean(explicitMatch);
  const staff = explicitMatch ?? (await pickLeastBusyStaff(staffList));

  const { slots, tooLong } = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr: parsed.localDateStr,
  });
  if (tooLong || slots.length === 0) return null;

  let matched: { start: Date; end: Date } | undefined;
  if (parsed.hour != null) {
    const wantedMin = parsed.hour * 60 + (parsed.minute ?? 0);
    matched =
      slots.find((s) => {
        const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
        return dt.hour * 60 + dt.minute === wantedMin;
      }) ??
      slots.find((s) => {
        const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
        return dt.hour * 60 + dt.minute >= wantedMin;
      });
  }

  if (matched) {
    const partySize = extractPartySize(trimmed);

    // All 5 variables (service, staff, date, time, party size) resolved to a real
    // open slot — book instantly instead of asking the customer to reply YES.
    // Only when the customer named the stylist themselves: an auto-assigned
    // stylist is the case most likely to surprise them, so that case still
    // gets the normal "Reply YES" confirm prompt. Any guardrail failure (slot
    // just taken, salon suspended, double-booking) also falls through to that
    // same prompt, which re-runs the same checks before actually booking.
    const instant = explicitStaff
      ? await tryInstantConfirm(conv, service, staff, matched.start, partySize, explicitStaff)
      : null;
    if (instant) return instant;

    const dt = DateTime.fromJSDate(matched.start).setZone(conv.salon.timezone);
    const firstName = conv.customer.firstName?.trim();
    const opener = firstName
      ? `${pickCompliment()} *${sanitize(firstName)}*, here's the booking:`
      : `${pickCompliment()} Here's the booking:`;
    return {
      handled: true,
      reply: [
        opener,
        `${sanitize(service.name)} with ${sanitize(staff.name)}`,
        dt.toFormat('cccc, dd LLL yyyy HH:mm'),
        '',
        'Reply YES to confirm, or BACK to choose another time.',
      ].join('\n'),
      step: ConversationStep.CONFIRM_BOOKING,
      contextPatch: {
        selectedServiceId: service.id,
        selectedStaffId: staff.id,
        anyStaff: !explicitStaff,
        localDateStr: parsed.localDateStr,
        slotStartIso: matched.start.toISOString(),
        partySize: partySize ?? undefined,
        quickPickOptions: undefined,
      },
    };
  }

  // Date resolved but no exact/near-enough time — offer that day's open slots.
  const keys = ['A', 'B', 'C'];
  const dayOptions: QuickPickOption[] = slots.slice(0, 3).map((s, i) => {
    const d = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
    const key = keys[i]!;
    return {
      key,
      serviceId: service.id,
      staffId: staff.id,
      slotStartIso: s.start.toISOString(),
      localDateStr: parsed.localDateStr,
      label: `${key}) ${d.toFormat('ccc dd LLL HH:mm')} — ${sanitize(service.name)} with ${sanitize(staff.name)} (${fmtMoney(service.priceCents)})`,
      explicitStaff,
    };
  });
  if (dayOptions.length === 0) return null;

  const dayFirstName = conv.customer.firstName?.trim();
  const dayOpener = dayFirstName
    ? `Good eye, *${sanitize(dayFirstName)}* — here's what's open on ${DateTime.fromISO(parsed.localDateStr).toFormat('cccc dd LLL')}. Reply with A, B, or C:`
    : `Here's what's open on ${DateTime.fromISO(parsed.localDateStr).toFormat('cccc dd LLL')} — reply with A, B, or C:`;
  return {
    handled: true,
    reply: [
      dayOpener,
      ...dayOptions.map((o) => o.label),
      '',
      'Or reply BACK for the main menu.',
    ].join('\n'),
    step: ConversationStep.PICK_SLOT,
    contextPatch: {
      selectedServiceId: service.id,
      selectedStaffId: staff.id,
      localDateStr: parsed.localDateStr,
      quickPickOptions: dayOptions,
    },
  };
}

export async function tryAiAssist(
  conv: Conversation & { customer: Customer; salon: Salon },
  inboundText: string,
): Promise<AiAssistResult> {
  if (!isAnthropicConfigured()) return { handled: false };

  // Never hijack structured booking — slot/service/date picks must stay deterministic.
  if (STRUCTURED_BOOKING_STEPS.includes(conv.step)) {
    return { handled: false };
  }

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

    const services = filterBookableCatalogServices(await loadSalonServiceCatalog(conv.salonId));

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

        // Customer may have volunteered a date/time up front (e.g. "Monday 18
        // November 14:45") — when we can resolve that to a real slot, skip
        // straight past staff/date/slot picking into a confirm prompt instead
        // of always showing the generic "next 3 available" quick-picks.
        const directBooking = await tryDirectDateTimeBooking(conv, trimmed, serviceId, ai.staffId ?? null);
        if (directBooking) return directBooking;

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

        const bookLead = sanitizeAiBookReply(ai.empathyNote?.trim() || ai.reply);
        return {
          handled: true,
          reply: [
            bookLead,
            '',
            'Here are times I can hold for you — reply with A, B, or C:',
            ...quickPickOptions.map((o) => o.label),
            '',
            'Or reply BACK for the main menu.',
          ].join('\n'),
          step: ConversationStep.PICK_SLOT,
          contextPatch: {
            selectedServiceId: serviceId,
            selectedStaffId: undefined,
            localDateStr: undefined,
            slotStartIso: undefined,
            flatSlotOptions: undefined,
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
