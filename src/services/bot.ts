import {
  ConversationStep,
  MessageDirection,
  Prisma,
  type Conversation,
  type Customer,
  type Salon,
} from '@prisma/client';
import { getTenantDb, withTenantContext } from '../lib/db/tenantSession.js';
import {
  assertTenantActive,
  resolveTenantForInbound,
  type ResolvedTenant,
} from '../lib/tenant.js';
import { sendWithFallback } from './channelRouter.js';
import { sendWhatsAppReply } from '../lib/twilio.js';
import { emitMessageReceived, emitBotEscalation } from '../lib/eventBus.js';
import { normalizeWaId } from '../lib/phone.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { DateTime } from 'luxon';
import { getAvailableSlots, getStaffForService, suggestBookingDates, validateSlotAvailable } from './slots.js';
import {
  ensureLoyaltyProgram,
  getStampBalance,
  redeemForNextBookingTx,
} from './loyalty.js';
import { createDepositCheckoutSession } from './payments.js';
import { matchQuickPick, tryAiAssist, type QuickPickOption } from './botAssistant.js';
import { scheduleConversationActivity } from '../lib/inngest/functions/conversationInactivity.js';
import {
  applyMarketingConsentChoice,
  buildConsentAcceptedMessage,
  buildConsentDeclinedMessage,
  buildConsentStopMessage,
  buildPopiaConsentMessage,
  isGlobalMarketingOptIn,
  isGlobalMarketingOptOut,
  needsMarketingConsentPrompt,
  parseMarketingConsentReply,
} from './marketingConsent.js';

export type BotContext = Record<string, unknown> & {
  selectedServiceId?: string;
  selectedStaffId?: string;
  selectedBranchId?: string;
  branchOptions?: string[];
  localDateStr?: string;
  slotStartIso?: string;
  pendingAppointmentId?: string;
  rescheduleAppointmentId?: string;
  csatAppointmentId?: string;
  anyStaff?: boolean;
  manageList?: string[];
  managingAppointmentId?: string;
  /** Consecutive unhandled-error count — triggers staff escalation at 2 */
  errorCount?: number;
  /** True when a human agent explicitly took over via the dashboard (keeps bot silent). */
  handoffByStaff?: boolean;
  /** AI-suggested quick book slots (A/B/C). */
  quickPickOptions?: QuickPickOption[];
  /** True once the AI has given its first answer in the OTHER_QUERY flow */
  otherQueryAnswered?: boolean;
  /** Original question text saved for the ticket if customer says NO */
  otherQueryText?: string;
  /** Rate-my-experience sub-step: which part of the flow we're collecting */
  ratingSubStep?: 'stars' | 'comment' | 'nps' | 'nps_reason';
  /** Collected rating fields during RATE_EXPERIENCE flow */
  ratingStars?: number;
  ratingComment?: string;
  ratingNps?: number;
};

const RATE_KEY_PREFIX = 'ratelimit:wa:';

async function rateLimitOrReject(waId: string): Promise<boolean> {
  try {
    const key = `${RATE_KEY_PREFIX}${waId}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.pexpire(key, 60_000);
    return n <= 30;
  } catch {
    return true; // Allow through if Redis is unavailable
  }
}

function ctx(conv: Conversation): BotContext {
  return (conv.context ?? {}) as BotContext;
}

async function saveCtx(convId: string, patch: Partial<BotContext>, step?: ConversationStep) {
  const conv = await getTenantDb().conversation.findUniqueOrThrow({ where: { id: convId } });
  const next = { ...ctx(conv), ...patch };
  await getTenantDb().conversation.update({
    where: { id: convId },
    data: {
      context: next as object,
      ...(step ? { step } : {}),
    },
  });
}

async function reply(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
  outboundSid?: string | null,
) {
  let providerSid: string | null = outboundSid ?? null;
  if (!providerSid) {
    try {
      const { result } = await sendWithFallback({
        salonId: conv.salonId,
        to: conv.customer.waId,
        body: text,
      });
      providerSid = result.providerMessageId ?? null;
    } catch (err) {
      logger.error({ err, to: conv.customer.waId }, 'reply_send_failed');
      return;
    }
  }
  await getTenantDb().message.create({
    data: {
      conversationId: conv.id,
      customerId: conv.customerId,
      direction: MessageDirection.OUTBOUND,
      body: text,
      providerSid,
    },
  });
  await getTenantDb().conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
  });
}

function mainMenu(salon: Salon): string {
  const welcome =
    salon.welcomeMessage?.trim() ||
    `Welcome to ${salon.name}! Reply with a number:`;
  const items = [
    '1 — Book an appointment',
    '2 — My bookings',
    ...(salon.botLoyaltyEnabled ? ['3 — My rewards / loyalty'] : []),
    '4 — FAQs',
    '5 — Rate my experience',
    '6 — Contact us',
    '7 — Business hours',
    '8 — Find us (address & directions)',
    '0 — Something else',
  ];
  return [welcome, ...items].join('\n');
}

function parseHmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function isWithinBusinessHours(salon: Salon, now = new Date()): boolean {
  const open = salon.openTime ?? '09:00';
  const close = salon.closeTime ?? '17:00';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: salon.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const nowMin = hour * 60 + minute;
  const openMin = parseHmToMin(open);
  const closeMin = parseHmToMin(close);
  if (closeMin <= openMin) return nowMin >= openMin || nowMin < closeMin;
  return nowMin >= openMin && nowMin < closeMin;
}

function afterHoursHumanReply(salon: Salon): string {
  const open = salon.openTime ?? '09:00';
  const close = salon.closeTime ?? '17:00';
  return (
    salon.afterHoursMessage?.trim() ||
    `We're closed for live support right now (our hours are ${open}–${close}). ` +
    `Someone from our team will contact you when we open. ` +
    `You can still book appointments, check loyalty, and browse FAQs anytime.`
  );
}

function isHumanHandoffRequest(text: string): boolean {
  const lower = text.toLowerCase();
  // '0' now routes to OTHER_QUERY (AI-first), so only explicit "talk to human" triggers direct handoff
  return lower.includes('human') || lower.includes('talk to');
}

export async function handleInboundWhatsApp(input: {
  from: string;
  body: string;
  messageSid: string;
  twilioTo?: string;
  metaPhoneNumberId?: string;
}): Promise<void> {
  const waId = normalizeWaId(input.from);
  const text = (input.body ?? '').trim();

  const tenant = await resolveTenantForInbound({
    twilioTo: input.twilioTo,
    metaPhoneNumberId: input.metaPhoneNumberId,
  });
  logger.info({ tenantId: tenant?.id ?? null, tenantSlug: tenant?.slug ?? null, twilioTo: input.twilioTo }, 'bot_tenant_resolved');
  if (!tenant) {
    logger.error({ twilioTo: input.twilioTo }, 'tenant_not_resolved');
    return;
  }

  try {
    assertTenantActive(tenant);
  } catch {
    logger.warn({ tenantId: tenant.id, status: tenant.status }, 'bot_tenant_inactive');
    await sendWhatsAppReply(
      waId,
      'This business is not accepting bookings right now. Please try again later.',
    );
    return;
  }

  if (!(await rateLimitOrReject(waId))) {
    await sendWhatsAppReply(waId, 'Too many messages — please wait a minute and try again.');
    return;
  }

  logger.info({ tenantId: tenant.id, waId, textLen: text.length }, 'bot_processing');

  // EC-19: Per-user Redis mutex to serialise concurrent messages from the same number
  const lockKey = `conv:lock:${tenant.id}:${waId}`;
  let lockAcquired = false;
  try {
    const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
    lockAcquired = acquired === 'OK';
    if (!lockAcquired) {
      logger.warn({ tenantId: tenant.id, waId }, 'concurrent_message_blocked');
      return;
    }
    await withTenantContext(tenant.id, async () => {
      await processInboundWhatsApp(tenant, { waId, text, messageSid: input.messageSid });
    });
  } finally {
    if (lockAcquired) {
      await redis.del(lockKey).catch(() => {});
    }
  }
}

async function processInboundWhatsApp(
  tenant: ResolvedTenant,
  input: { waId: string; text: string; messageSid: string },
): Promise<void> {
  const { waId, text, messageSid } = input;
  // EC-07/EC-15: drop empty messages (media-only, delivery receipts, etc.)
  if (!text) return;
  const salon = await getTenantDb().salon.findUniqueOrThrow({ where: { id: tenant.id } });

  let customer = await getTenantDb().customer.findUnique({
    where: { salonId_waId: { salonId: salon.id, waId } },
  });
  if (!customer) {
    customer = await getTenantDb().customer.create({
      data: { salonId: salon.id, waId, lastInteractionAt: new Date() },
    });
  } else {
    customer = await getTenantDb().customer.update({
      where: { id: customer.id },
      data: { lastInteractionAt: new Date() },
    });
  }

  let conv = await getTenantDb().conversation.findUnique({
    where: { salonId_customerId: { salonId: salon.id, customerId: customer.id } },
    include: { customer: true, salon: true },
  });
  if (!conv) {
    conv = await getTenantDb().conversation.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        step: ConversationStep.GREETING,
        context: {},
      },
      include: { customer: true, salon: true },
    });
  } else {
    conv = await getTenantDb().conversation.findUniqueOrThrow({
      where: { id: conv.id },
      include: { customer: true, salon: true },
    });
  }

  await getTenantDb().message.create({
    data: {
      conversationId: conv.id,
      customerId: customer.id,
      direction: MessageDirection.INBOUND,
      body: text,
      providerSid: messageSid,
    },
  });

  await getTenantDb().conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
  });

  await getTenantDb().analyticsEvent.create({
    data: {
      salonId: salon.id,
      customerId: customer.id,
      type: 'whatsapp_inbound',
      payload: { len: text.length },
    },
  });

  // Notify the dashboard SSE stream — fire-and-forget, must not block the transaction
  emitMessageReceived(salon.id, customer.id, text).catch((err) =>
    logger.warn({ err }, 'sse_emit_failed'),
  );

  const inboundAt = new Date().toISOString();
  scheduleConversationActivity({
    conversationId: conv.id,
    salonId: salon.id,
    customerWaId: waId,
    activityAt: inboundAt,
  }).catch(() => {});

  if (salon.status !== 'ACTIVE' && salon.status !== 'TRIAL') {
    await getTenantDb().ticket.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        status: 'OPEN',
        subject: 'Bot paused — customer needs human reply',
        messages: {
          create: {
            direction: MessageDirection.INBOUND,
            body: `Bot is paused. Customer message: ${text}`,
          },
        },
      },
    });
    await saveCtx(conv.id, {}, ConversationStep.HANDOFF);
    await reply(
      conv,
      salon.afterHoursMessage?.trim() ||
        'Thanks for your message. Our team will reply as soon as possible.',
    );
    return;
  }

  const consentHandled = await handleMarketingConsentFlow(conv, text);
  if (consentHandled) return;

  const lower = text.toLowerCase();
  if (lower === 'undo' || lower === 'back') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  if (isHumanHandoffRequest(text)) {
    if (!isWithinBusinessHours(salon)) {
      // After hours — don't escalate yet; offer AI help first
      await saveCtx(conv.id, {}, ConversationStep.MENU);
      await reply(
        conv,
        afterHoursHumanReply(salon) +
          '\n\nIs there anything our AI assistant can try to help with in the meantime? Reply YES to continue or NO to wait for a human.',
      );
      return;
    }

    // Within hours — open a ticket and hand off
    await getTenantDb().ticket.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        status: 'OPEN',
        subject: 'Human handoff requested',
        messages: {
          create: {
            direction: MessageDirection.INBOUND,
            body: `Customer requested human support.\nLast message: ${text}`,
          },
        },
      },
    });

    await reply(
      conv,
      'Thanks — a team member will read this chat and respond as soon as possible.',
    );
    await saveCtx(conv.id, {}, ConversationStep.IDLE);
    return;
  }

  const aiSteps: ConversationStep[] = [
    ConversationStep.GREETING,
    ConversationStep.MENU,
    ConversationStep.IDLE,
    ConversationStep.FAQ,
  ];
  if (aiSteps.includes(conv.step)) {
    const aiResult = await tryAiAssist(conv, text, mainMenu(salon));
    if (aiResult.handled && aiResult.reply) {
      await saveCtx(conv.id, aiResult.contextPatch ?? {}, aiResult.step ?? ConversationStep.MENU);
      await reply(conv, aiResult.reply);
      return;
    }
  }

  try {
    await routeConversation(conv, text);
    // Reset error counter after any successful routing (best-effort — must not throw)
    if ((ctx(conv).errorCount ?? 0) > 0) {
      await saveCtx(conv.id, { errorCount: undefined }).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, convId: conv.id, step: conv.step }, 'route_conversation_error');
    try {
      // P2021 = table doesn't exist yet (migration pending) — infrastructure error,
      // not a logic error. Reset quietly to MENU so the bot keeps working.
      const isInfraError =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2021' || err.code === 'P2002');
      if (isInfraError) {
        await saveCtx(conv.id, {}, ConversationStep.MENU);
        await reply(conv, mainMenu(conv.salon));
        return;
      }

      const prevCount = (ctx(conv).errorCount as number | undefined) ?? 0;
      const errorCount = prevCount + 1;

      if (errorCount >= 2) {
        // Escalate: move to HANDOFF, notify user, open a ticket, ping dashboard
        await saveCtx(conv.id, { errorCount }, ConversationStep.HANDOFF);

        await reply(
          conv,
          'Oops! We ran into an unexpected problem and couldn\'t complete your request. ' +
          'A team member has been notified and will reach out to you shortly. ' +
          'We apologise for the inconvenience.',
        );

        // Open a support ticket so the dashboard shows it immediately
        await getTenantDb().ticket.create({
          data: {
            salonId: conv.salonId,
            customerId: conv.customerId,
            status: 'OPEN',
            subject: 'Bot escalation — requires immediate attention',
            messages: {
              create: {
                direction: MessageDirection.INBOUND,
                body:
                  `Bot failed ${errorCount} consecutive time(s).\n` +
                  `Last step: ${conv.step}\n` +
                  `Last message: "${text.slice(0, 200)}"`,
              },
            },
          },
        });

        // Push a real-time alert to every dashboard tab watching this salon
        emitBotEscalation(conv.salonId, conv.customerId, conv.id, {
          errorCount,
          lastStep: conv.step,
          lastText: text.slice(0, 200),
        }).catch(() => {});

        logger.warn(
          { convId: conv.id, customerId: conv.customerId, errorCount },
          'bot_escalated_to_staff',
        );
      } else {
        // First failure — soft recovery, keep counting
        await saveCtx(conv.id, { errorCount }, ConversationStep.MENU);
        await reply(conv, `Sorry, something went wrong on our end. Let's start over.\n\n${mainMenu(conv.salon)}`);
      }
    } catch (innerErr) {
      logger.error({ innerErr }, 'error_recovery_failed');
    }
  }
}

async function handleMarketingConsentFlow(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<boolean> {
  const salon = conv.salon;
  const status = conv.customer.marketingConsentStatus;

  if (isGlobalMarketingOptOut(text)) {
    if (status !== 'DECLINED') {
      await applyMarketingConsentChoice({
        customerId: conv.customerId,
        salonId: salon.id,
        choice: 'decline',
        source: 'whatsapp_stop',
      });
    }
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `${buildConsentStopMessage()}\n\n${mainMenu(salon)}`);
    return true;
  }

  if (status === 'DECLINED' && isGlobalMarketingOptIn(text)) {
    await applyMarketingConsentChoice({
      customerId: conv.customerId,
      salonId: salon.id,
      choice: 'accept',
      source: 'whatsapp_opt_in',
    });
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `${buildConsentAcceptedMessage()}\n\n${mainMenu(salon)}`);
    return true;
  }

  if (!needsMarketingConsentPrompt(status)) {
    return false;
  }

  const choice = parseMarketingConsentReply(text);
  if (choice) {
    await applyMarketingConsentChoice({
      customerId: conv.customerId,
      salonId: salon.id,
      choice,
      source: 'whatsapp',
    });
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    const ack = choice === 'accept' ? buildConsentAcceptedMessage() : buildConsentDeclinedMessage();
    await reply(conv, `${ack}\n\n${mainMenu(salon)}`);
    return true;
  }

  if (conv.step !== ConversationStep.MARKETING_CONSENT) {
    await saveCtx(conv.id, {}, ConversationStep.MARKETING_CONSENT);
    await reply(conv, buildPopiaConsentMessage(salon.tradingName ?? salon.name));
    return true;
  }

  await reply(conv, 'Please reply *ACCEPT* or *DECLINE* for marketing messages (POPIA).');
  return true;
}

async function routeConversation(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const t = text.trim();
  const salon = conv.salon;

  switch (conv.step) {
    case ConversationStep.GREETING:
    case ConversationStep.MENU:
    case ConversationStep.IDLE:
      await handleMenu(conv, t);
      break;
    case ConversationStep.MARKETING_CONSENT:
      await handleMarketingConsentFlow(conv, t);
      break;
    case ConversationStep.PICK_SERVICE:
      await handlePickService(conv, t);
      break;
    case ConversationStep.PICK_STAFF:
      await handlePickStaff(conv, t);
      break;
    case ConversationStep.PICK_DATE:
      await handlePickDate(conv, t);
      break;
    case ConversationStep.PICK_SLOT:
      await handlePickSlot(conv, t);
      break;
    case ConversationStep.CONFIRM_BOOKING:
      await handleConfirm(conv, t);
      break;
    case ConversationStep.PICK_BRANCH:
      await handlePickBranch(conv, t);
      break;
    case ConversationStep.MANAGE_BOOKING:
      await handleManageBooking(conv, t);
      break;
    case ConversationStep.RESCHEDULE:
      await handleReschedule(conv, t);
      break;
    case ConversationStep.COMPLAINT:
      await handleComplaint(conv, t);
      break;
    case ConversationStep.RATE_EXPERIENCE:
      await handleRateExperience(conv, t);
      break;
    case ConversationStep.OTHER_QUERY:
      await handleOtherQuery(conv, t);
      break;
    case ConversationStep.HANDOFF_RATING:
      await handleHandoffRating(conv, t);
      break;
    case ConversationStep.FAQ:
      await handleFaq(conv, t);
      break;
    case ConversationStep.LOYALTY:
      await handleLoyalty(conv, t);
      break;
    case ConversationStep.CSAT:
      await handleCsat(conv, t);
      break;
    case ConversationStep.BOOKING_RATING:
      await handleBookingRating(conv, t);
      break;
    case ConversationStep.HANDOFF:
    case ConversationStep.CLOSED:
      if (ctx(conv).handoffByStaff) {
        // A human agent explicitly claimed this conversation — stay silent.
        // Message is already recorded; dashboard SSE has already been emitted.
        logger.info({ convId: conv.id, step: conv.step }, 'bot_silent_handoff');
        return;
      }
      // Bot-error HANDOFF with no staff claim — auto-recover so the customer
      // isn't stuck indefinitely.
      logger.info({ convId: conv.id }, 'bot_auto_recover_handoff');
      await saveCtx(conv.id, { errorCount: undefined }, ConversationStep.MENU);
      await reply(conv, mainMenu(salon));
      return;
    default:
      await saveCtx(conv.id, {}, ConversationStep.MENU);
      await reply(conv, mainMenu(salon));
  }
}

async function handleMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const salon = conv.salon;
  const choice = text.trim();

  if (choice === '1') {
    // EC-09/EC-18: Wipe stale booking fields before starting a fresh flow
    await saveCtx(conv.id, {
      selectedServiceId: undefined,
      selectedStaffId: undefined,
      selectedBranchId: undefined,
      branchOptions: undefined,
      localDateStr: undefined,
      slotStartIso: undefined,
      anyStaff: undefined,
      managingAppointmentId: undefined,
    });

    // Check for multi-branch — if salon has >1 branch, ask which branch first
    const branches = await getTenantDb().branch.findMany({
      where: { salonId: salon.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (branches.length > 1) {
      const lines = branches.map((b, i) => `${i + 1}. ${b.name}${b.city ? ` (${b.city})` : ''}`);
      await saveCtx(conv.id, { branchOptions: branches.map((b) => b.id) }, ConversationStep.PICK_BRANCH);
      await reply(conv, ['Which location?', ...lines, '', 'Reply BACK for menu.'].join('\n'));
      return;
    }

    // Single branch or no branches — go straight to services
    if (branches.length === 1) {
      await saveCtx(conv.id, { selectedBranchId: branches[0].id });
    }

    const services = await getTenantDb().service.findMany({
      where: { salonId: salon.id, active: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (services.length === 0) {
      // EC-05: return to menu so user isn't left in a dead end
      await reply(conv, `No services configured yet. Please contact the salon.\n\n${mainMenu(salon)}`);
      return;
    }
    const lines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
    await saveCtx(conv.id, {}, ConversationStep.PICK_SERVICE);
    await reply(conv, ['Pick a service number:', ...lines, '', 'Reply BACK for menu.'].join('\n'));
    return;
  }

  if (choice === '2') {
    const now = new Date();
    const [upcoming, past] = await Promise.all([
      getTenantDb().appointment.findMany({
        where: {
          customerId: conv.customerId,
          salonId: salon.id,
          start: { gte: now },
          status: { in: ['CONFIRMED', 'HELD', 'PENDING_PAYMENT', 'CONFIRMED_PAID'] },
        },
        orderBy: { start: 'asc' },
        include: { service: true, staff: true },
        take: 10,
      }),
      getTenantDb().appointment.findMany({
        where: {
          customerId: conv.customerId,
          salonId: salon.id,
          start: { lt: now },
          status: { in: ['COMPLETED', 'CONFIRMED', 'CONFIRMED_PAID'] },
        },
        orderBy: { start: 'desc' },
        include: { service: true, staff: true },
        take: 20,
      }),
    ]);

    const fmtAppt = (a: typeof upcoming[0], i: number) =>
      `${i + 1}. ${sanitize(a.service.name)}\n   ${fmtDt(a.start, salon.timezone)} with ${sanitize(a.staff.name)}`;

    const lines: string[] = [];

    if (upcoming.length > 0) {
      lines.push('📅 *Upcoming appointments:*');
      upcoming.forEach((a, i) => lines.push(fmtAppt(a, i + 1)));
    } else {
      lines.push('No upcoming appointments.');
    }

    if (past.length > 0) {
      lines.push('', '📋 *Past bookings:*');
      past.forEach((a, i) => {
        lines.push(`${i + 1}. ${sanitize(a.service.name)}\n   ${fmtDt(a.start, salon.timezone)} with ${sanitize(a.staff.name)}`);
      });
    }

    if (upcoming.length === 0 && past.length === 0) {
      await reply(conv, `No bookings found yet.\n\n${mainMenu(salon)}`);
      return;
    }

    if (upcoming.length > 0) {
      lines.push('', 'Reply CANCEL 1 or RESCHEDULE 1 to manage (use the upcoming number), or BACK.');
      await saveCtx(conv.id, { manageList: upcoming.map((a) => a.id) }, ConversationStep.MANAGE_BOOKING);
    } else {
      lines.push('', 'Reply BACK for menu.');
      await saveCtx(conv.id, {}, ConversationStep.MENU);
    }

    await reply(conv, lines.join('\n'));
    return;
  }

  if (choice === '3' && salon.botLoyaltyEnabled) {
    await ensureLoyaltyProgram(salon.id);
    const bal = await getStampBalance(salon.id, conv.customerId);
    const stampsPerReward = bal.stampsPerReward ?? 10;
    const stamps = bal.stamps ?? 0;
    const remaining = Math.max(0, stampsPerReward - (stamps % stampsPerReward));

    // Predict date of next reward based on average booking frequency
    const recentBookings = await getTenantDb().appointment.findMany({
      where: {
        customerId: conv.customerId,
        salonId: salon.id,
        status: { in: ['COMPLETED', 'CONFIRMED', 'CONFIRMED_PAID'] },
      },
      orderBy: { start: 'desc' },
      take: stampsPerReward + 2,
    });

    let predictionLine = '';
    if (recentBookings.length >= 2 && remaining > 0) {
      const intervals: number[] = [];
      for (let i = 0; i < recentBookings.length - 1; i++) {
        const msApart = recentBookings[i]!.start.getTime() - recentBookings[i + 1]!.start.getTime();
        if (msApart > 0) intervals.push(msApart);
      }
      if (intervals.length > 0) {
        const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const predictedMs = Date.now() + remaining * avgIntervalMs;
        const predictedDate = new Date(predictedMs);
        predictionLine = `\nAt your current pace, your free cut is estimated around ${fmtDate(predictedDate, salon.timezone)}. 🎉`;
      }
    }

    const redeemable = stamps >= stampsPerReward;
    const progressBar = buildStampBar(stamps % stampsPerReward || (redeemable ? stampsPerReward : 0), stampsPerReward);

    const lines = [
      `⭐ *Your loyalty card* — ${salon.name}`,
      '',
      `Stamps: ${stamps} total`,
      progressBar,
      redeemable
        ? `\n🎊 You've earned a FREE cut! Reply REDEEM to use it on your next booking.`
        : `${remaining} more cut${remaining === 1 ? '' : 's'} until your FREE one!${predictionLine}`,
      '',
      'Reply BACK for menu.',
    ];

    await saveCtx(conv.id, {}, ConversationStep.LOYALTY);
    await reply(conv, lines.join('\n'));
    return;
  }

  if (choice === '4') {
    const faqs = await getTenantDb().faqItem.findMany({
      where: { salonId: salon.id, status: 'APPROVED' },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });
    if (faqs.length === 0) {
      await reply(conv, `No FAQs available yet.\n\n${mainMenu(salon)}`);
      return;
    }
    await saveCtx(conv.id, {}, ConversationStep.FAQ);
    const lines = faqs.map((f, i) => `${i + 1}. ${f.question}`);
    await reply(conv, ['FAQs — reply with a number, or ask a question:', ...lines, '', 'Reply BACK for menu.'].join('\n'));
    return;
  }

  if (choice === '5') {
    await saveCtx(
      conv.id,
      { ratingSubStep: 'stars', ratingStars: undefined, ratingComment: undefined, ratingNps: undefined },
      ConversationStep.RATE_EXPERIENCE,
    );
    await reply(conv, '⭐ *Rate your experience*\n\nHow would you rate your last visit?\nReply with a number:\n1 ⭐ — Poor\n2 ⭐⭐ — Below average\n3 ⭐⭐⭐ — Average\n4 ⭐⭐⭐⭐ — Good\n5 ⭐⭐⭐⭐⭐ — Excellent');
    return;
  }

  if (choice === '6') {
    const parts = [
      `📞 *Contact ${salon.name}*`,
      salon.phoneDisplay ? `Phone: ${salon.phoneDisplay}` : null,
      (salon as unknown as { contactEmail?: string }).contactEmail ? `Email: ${(salon as unknown as { contactEmail?: string }).contactEmail}` : null,
    ].filter(Boolean);
    if (parts.length === 1) parts.push('No contact details on file yet.');
    await reply(conv, parts.join('\n'));
    await reply(conv, mainMenu(salon));
    return;
  }

  if (choice === '7') {
    const open = salon.openTime ?? '09:00';
    const close = salon.closeTime ?? '17:00';
    const isOpen = isWithinBusinessHours(salon);
    await reply(conv, `🕐 *Business hours*\n\nMon–Sat: ${open} – ${close}\n\nWe are currently ${isOpen ? '✅ open' : '🔴 closed'}.`);
    await reply(conv, mainMenu(salon));
    return;
  }

  if (choice === '8') {
    const address = salon.addressLine ?? 'Address not on file.';
    const mapsUrl = (salon as unknown as { mapsUrl?: string }).mapsUrl;
    const lines = [
      `📍 *Find us*`,
      address,
      salon.parkingNotes ? `Parking: ${salon.parkingNotes}` : null,
      salon.accessibility ? `♿ ${salon.accessibility}` : null,
    ].filter(Boolean);

    if (mapsUrl) {
      lines.push('', `📌 Open in maps:\n${mapsUrl}`);
    } else {
      // Generate a Google Maps search link from the address
      const query = encodeURIComponent(`${salon.name} ${address}`);
      lines.push('', `📌 Google Maps: https://maps.google.com/?q=${query}`);
    }

    await reply(conv, lines.join('\n'));
    await reply(conv, mainMenu(salon));
    return;
  }

  if (choice === '0') {
    await saveCtx(conv.id, { otherQueryAnswered: false }, ConversationStep.OTHER_QUERY);
    await reply(conv, "What can I help you with? Go ahead and ask — I'll do my best to answer. 😊");
    return;
  }

  await reply(conv, mainMenu(salon));
}

async function handlePickService(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const n = parseInt(text, 10);
  const services = await getTenantDb().service.findMany({
    where: { salonId: conv.salonId, active: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (!Number.isFinite(n) || n < 1 || n > services.length) {
    const svcLines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
    await reply(conv, [`Invalid choice. Pick a number (1–${services.length}):`, ...svcLines, '', 'Reply BACK for menu.'].join('\n'));
    return;
  }
  const service = services[n - 1]!;
  await saveCtx(
    conv.id,
    { selectedServiceId: service.id },
    ConversationStep.PICK_STAFF,
  );
  const staff = await getStaffForService(conv.salonId, service.id);
  if (staff.length === 0) {
    await reply(conv, 'No staff available for this service yet.');
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    return;
  }
  const lines = [
    ...staff.map((s, i) => `${i + 1}. ${sanitize(s.name)}`),
    `${staff.length + 1}. Any available`,
  ];
  await reply(conv, ['Choose stylist:', ...lines, '', 'BACK'].join('\n'));
}

async function handlePickStaff(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  if (!serviceId) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staffList = await getStaffForService(conv.salonId, service.id);
  // Guard: staff may have been deactivated since service step
  if (staffList.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `Sorry, no staff are currently available for this service. Please try another.\n\n${mainMenu(conv.salon)}`);
    return;
  }

  const n = parseInt(text, 10);
  const anyIdx = staffList.length + 1;
  if (!Number.isFinite(n) || n < 1 || n > anyIdx) {
    await reply(conv, `Invalid choice. Reply with a number from 1 to ${anyIdx}, or BACK.`);
    return;
  }

  const isAny = n === anyIdx;
  let staffId: string;
  if (isAny) {
    // EC-06: Load-balance by selecting staff with the fewest upcoming appointments
    const counts = await Promise.all(
      staffList.map(async (s) => {
        const count = await getTenantDb().appointment.count({
          where: {
            staffId: s.id,
            start: { gte: new Date() },
            status: { notIn: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'] },
          },
        });
        return { id: s.id, count };
      }),
    );
    counts.sort((a, b) => a.count - b.count);
    staffId = counts[0]!.id;
  } else {
    staffId = staffList[n - 1]!.id;
  }

  const dates = await suggestBookingDates(conv.salonId, 14);
  if (dates.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `No available dates found. Please contact us directly to book.\n\n${mainMenu(conv.salon)}`);
    return;
  }

  await saveCtx(conv.id, { selectedStaffId: staffId, anyStaff: isAny }, ConversationStep.PICK_DATE);
  const lines = dates.slice(0, 10).map((d, i) => `${i + 1}. ${d}`);
  await reply(
    conv,
    [
      'Pick a date (next available days):',
      ...lines,
      '',
      'Or type a date YYYY-MM-DD',
      'Reply BACK to return to menu.',
    ].join('\n'),
  );
}

async function handlePickDate(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  const staffId = c.selectedStaffId as string | undefined;
  if (!serviceId || !staffId) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });

  const suggestions = await suggestBookingDates(conv.salonId, 14);

  const showDateList = async (prefix: string) => {
    if (suggestions.length === 0) {
      await saveCtx(conv.id, {}, ConversationStep.MENU);
      await reply(conv, `No available dates found. Please contact us directly to book.\n\n${mainMenu(conv.salon)}`);
      return;
    }
    const dateLines = suggestions.slice(0, 10).map((d, i) => `${i + 1}. ${d}`);
    await reply(
      conv,
      [prefix, ...dateLines, '', 'Or type a date YYYY-MM-DD', 'Reply BACK to return to menu.'].join('\n'),
    );
  };

  let localDateStr: string | undefined;
  const n = parseInt(text, 10);
  if (Number.isFinite(n) && n >= 1 && n <= Math.min(suggestions.length, 10)) {
    localDateStr = suggestions[n - 1];
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
    localDateStr = text.trim();
  }

  if (!localDateStr) {
    await showDateList('Invalid input. Pick a number from the list or enter YYYY-MM-DD:');
    return;
  }

  // EC-11: getAvailableSlots now returns { slots, tooLong }
  const { slots, tooLong } = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr,
  });
  if (tooLong) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `Sorry, this service is too long to fit within business hours. Please contact us directly.\n\n${mainMenu(conv.salon)}`);
    return;
  }
  if (slots.length === 0) {
    await showDateList(`No openings on ${localDateStr}. Please choose another date:`);
    return;
  }

  await saveCtx(conv.id, { localDateStr }, ConversationStep.PICK_SLOT);
  const lines = slots.slice(0, 8).map((s, i) => {
    const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
    return `${i + 1}. ${dt.toFormat('ccc HH:mm')}`;
  });
  await reply(conv, ['Pick a time slot:', ...lines, '', 'Reply BACK to choose a different date.'].join('\n'));
}

async function handlePickSlot(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const quickPick = matchQuickPick(text, c.quickPickOptions);
  if (quickPick) {
    const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: quickPick.serviceId } });
    const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: quickPick.staffId } });
    await saveCtx(
      conv.id,
      {
        selectedServiceId: quickPick.serviceId,
        selectedStaffId: quickPick.staffId,
        localDateStr: quickPick.localDateStr,
        slotStartIso: quickPick.slotStartIso,
        quickPickOptions: undefined,
      },
      ConversationStep.CONFIRM_BOOKING,
    );
    const dt = DateTime.fromISO(quickPick.slotStartIso).setZone(conv.salon.timezone);
    await reply(
      conv,
      [
        `Perfect — let's lock this in:`,
        `${sanitize(service.name)} with ${sanitize(staff.name)}`,
        dt.toFormat('cccc, dd LLL yyyy HH:mm'),
        '',
        `Reply YES to confirm and continue to payment, or BACK.`,
      ].join('\n'),
    );
    return;
  }

  const serviceId = c.selectedServiceId as string | undefined;
  const staffId = c.selectedStaffId as string | undefined;
  const localDateStr = c.localDateStr as string | undefined;
  if (!serviceId || !staffId || !localDateStr) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  // EC-11: getAvailableSlots now returns { slots, tooLong }
  const { slots, tooLong } = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr,
  });
  if (tooLong || slots.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.PICK_DATE);
    await reply(conv, 'No slots are available for this date. Please reply BACK to choose a different date.');
    return;
  }
  const n = parseInt(text, 10);
  if (!Number.isFinite(n) || n < 1 || n > Math.min(slots.length, 8)) {
    const slotLines = slots.slice(0, 8).map((s, i) => {
      const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
      return `${i + 1}. ${dt.toFormat('ccc HH:mm')}`;
    });
    await reply(conv, [`Invalid choice. Pick a slot number (1–${Math.min(slots.length, 8)}):`, ...slotLines, '', 'Reply BACK to choose a different date.'].join('\n'));
    return;
  }
  const slot = slots[n - 1]!;
  await saveCtx(
    conv.id,
    { slotStartIso: slot.start.toISOString() },
    ConversationStep.CONFIRM_BOOKING,
  );
  const dt = DateTime.fromJSDate(slot.start).setZone(conv.salon.timezone);
  await reply(
    conv,
    [
      `Confirm booking?`,
      `${sanitize(service.name)} with ${sanitize(staff.name)}`,
      dt.toFormat('cccc, dd LLL yyyy HH:mm'),
      '',
      `Reply YES to confirm, or BACK.`,
    ].join('\n'),
  );
}

async function handleConfirm(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  // EC-03: accept natural affirmations, not just exact "yes"/"y"
  if (!/^(yes|y|yep|yeah|confirm|ok|sure|absolutely)\b/i.test(text.trim())) {
    await reply(conv, 'Booking not confirmed. Reply YES to confirm, or BACK to return to menu.');
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    return;
  }

  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  const staffId = c.selectedStaffId as string | undefined;
  const slotIso = c.slotStartIso as string | undefined;
  if (!serviceId || !staffId || !slotIso) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  // EC-17: Re-check salon status in case it was suspended after the booking flow started
  const freshSalon = await getTenantDb().salon.findUniqueOrThrow({ where: { id: conv.salonId } });
  if (freshSalon.status === 'SUSPENDED' || freshSalon.status === 'CHURNED') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `Sorry, this salon is not currently accepting bookings. Please try again later.\n\n${mainMenu(conv.salon)}`);
    return;
  }

  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const start = new Date(slotIso);
  const end = new Date(
    start.getTime() + (service.durationMin + service.bufferMin + staff.breakMin) * 60_000,
  );

  // EC-01: Advisory lock to serialise concurrent bookings for the same staff/time slot
  await getTenantDb().$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${staff.id + ':' + start.toISOString()}))`;

  const slotFree = await validateSlotAvailable({
    salonId: conv.salonId,
    staffId: staff.id,
    start,
    end,
    excludeAppointmentId: (ctx(conv).managingAppointmentId as string | undefined),
  });
  if (!slotFree) {
    const localDateStr = c.localDateStr as string | undefined;
    if (localDateStr) {
      // EC-11: destructure new return type
      const { slots: freshSlots } = await getAvailableSlots({ salonId: conv.salonId, service, staff, localDateStr });
      if (freshSlots.length > 0) {
        await saveCtx(conv.id, {}, ConversationStep.PICK_SLOT);
        const slotLines = freshSlots.slice(0, 8).map((s, i) => {
          const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
          return `${i + 1}. ${dt.toFormat('ccc HH:mm')}`;
        });
        await reply(conv, ['Sorry, that slot was just taken. Please pick another time:', ...slotLines, '', 'Reply BACK to choose a different date.'].join('\n'));
        return;
      }
    }
    await saveCtx(conv.id, {}, ConversationStep.PICK_DATE);
    await reply(conv, 'Sorry, that slot was just taken and no others remain that day. Please reply BACK to choose another date.');
    return;
  }

  const tx = getTenantDb();
  const redeem = await redeemForNextBookingTx(tx, {
    salonId: conv.salonId,
    customerId: conv.customerId,
    service,
  });
  const reschedulingId = c.managingAppointmentId as string | undefined;

  const appointment = await tx.appointment.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      serviceId: service.id,
      staffId: staff.id,
      start,
      end,
      status: redeem.redeemed
        ? 'CONFIRMED'
        : service.depositCents || service.fullPay
          ? 'HELD'
          : 'CONFIRMED',
      loyaltyRedeemed: redeem.redeemed,
      rescheduledFromId: reschedulingId ?? undefined,
      confirmedAt: !service.depositCents && !service.fullPay ? new Date() : undefined,
    },
  });

  if (reschedulingId) {
    await tx.appointment.update({
      where: { id: reschedulingId },
      data: {
        status: 'RESCHEDULED',
        cancellationReason: 'CUSTOMER_REQUEST',
        cancelledAt: new Date(),
        cancelledBy: 'customer',
      },
    });
  }

  await tx.auditLog.create({
    data: {
      salonId: conv.salonId,
      action: reschedulingId ? 'appointment_reschedule' : 'appointment_create',
      entity: 'Appointment',
      entityId: appointment.id,
      payload: { source: 'whatsapp', rescheduledFromId: reschedulingId ?? null },
    },
  });
  await tx.analyticsEvent.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: appointment.id,
      type: 'booking_complete',
      payload: { serviceId: service.id },
    },
  });

  await saveCtx(conv.id, { pendingAppointmentId: appointment.id }, ConversationStep.IDLE);

  const needPay =
    !redeem.redeemed && ((service.depositCents ?? 0) > 0 || service.fullPay);
  if (needPay) {
    const sessionUrl = await createDepositCheckoutSession({
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: appointment.id,
      service,
      mode: service.fullPay ? 'full' : 'deposit',
    });
    if (sessionUrl) {
      await reply(
        conv,
        [
          redeem.note ? `${redeem.note}\n` : '',
          `Booking held (${appointment.id.slice(0, 8)}).`,
          `Please complete payment: ${sessionUrl}`,
          'We will confirm once payment succeeds.',
          '',
          mainMenu(conv.salon),
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return;
    }
    await reply(
      conv,
      `Booking created — payment link unavailable. Staff will confirm manually.\n\n${mainMenu(conv.salon)}`,
    );
    return;
  }

  await reply(
    conv,
    [
      redeem.redeemed && redeem.note ? `${redeem.note}\n` : '',
      `Booked! Reference: ${appointment.id.slice(0, 8)}`,
      `${sanitize(service.name)} with ${sanitize(staff.name)}`,
      DateTime.fromJSDate(start).setZone(conv.salon.timezone).toFormat('cccc dd LLL yyyy HH:mm'),
    ]
      .filter(Boolean)
      .join('\n'),
  );
  await saveCtx(conv.id, { pendingAppointmentId: appointment.id }, ConversationStep.BOOKING_RATING);
  await reply(conv, 'How was the booking process? Rate us 1–5 ⭐\n(1 = frustrating, 5 = super easy)');
}

async function handleBookingRating(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const upper = text.trim().toUpperCase();
  if (upper === 'BACK' || upper === 'MENU' || upper === '0') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }
  const rating = parseInt(text.trim(), 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    await reply(conv, 'Please reply with a number between 1 and 5.\n(or type MENU to go back)');
    return;
  }
  const appointmentId = ctx(conv).pendingAppointmentId as string | undefined;
  await getTenantDb().analyticsEvent.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: appointmentId ?? null,
      type: 'booking_process_rating',
      payload: { rating, appointmentId },
    },
  });
  let thankYou: string;
  if (rating === 5) {
    thankYou = 'Amazing! 🌟 So glad it was easy. See you soon!';
  } else if (rating === 4) {
    thankYou = 'Thanks! 😊 Glad that was smooth.';
  } else if (rating === 3) {
    thankYou = 'Thanks for the feedback — we\'ll keep improving.';
  } else {
    thankYou = 'Sorry it wasn\'t easier — we\'ll work on that.';
    await getTenantDb().ticket.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        status: 'OPEN',
        subject: `Poor booking experience (${rating}/5)`,
        messages: {
          create: {
            direction: MessageDirection.INBOUND,
            body: `Customer rated the booking process ${rating}/5.${appointmentId ? ` Appointment ID: ${appointmentId}` : ''}`,
          },
        },
      },
    });
  }
  await reply(conv, thankYou);
  await saveCtx(conv.id, {}, ConversationStep.IDLE);
}

async function handleManageBooking(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const ids = (c.manageList as string[] | undefined) ?? [];
  const lower = text.toLowerCase().trim();

  if (lower === 'back') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  // EC-04: removed $ anchor so trailing whitespace/punctuation doesn't break match
  const cancelMatch = /^cancel\s*(\d+)/i.exec(text.trim());
  const rescheduleMatch = /^reschedule\s*(\d+)/i.exec(text.trim());

  if (cancelMatch) {
    const idx = parseInt(cancelMatch[1]!, 10);
    if (!Number.isFinite(idx) || idx < 1 || idx > ids.length) {
      await reply(conv, 'Invalid booking number.');
      return;
    }
    const id = ids[idx - 1]!;
    const appt = await getTenantDb().appointment.findFirst({
      where: { id, customerId: conv.customerId },
      include: { service: true, staff: true },
    });
    if (!appt) {
      await reply(conv, 'Booking not found.');
      return;
    }
    await getTenantDb().appointment.update({
      where: { id: appt.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: 'CUSTOMER_REQUEST',
        cancelledAt: new Date(),
        cancelledBy: 'customer',
      },
    });
    await getTenantDb().analyticsEvent.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        appointmentId: appt.id,
        type: 'booking_cancel',
        payload: { reason: 'CUSTOMER_REQUEST', source: 'whatsapp' },
      },
    });
    await reply(conv, `Cancelled ${sanitize(appt.service.name)} with ${sanitize(appt.staff.name)}.\n\n${mainMenu(conv.salon)}`);
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    return;
  }

  if (rescheduleMatch) {
    const idx = parseInt(rescheduleMatch[1]!, 10);
    if (!Number.isFinite(idx) || idx < 1 || idx > ids.length) {
      await reply(conv, 'Invalid booking number.');
      return;
    }
    const id = ids[idx - 1]!;
    const appt = await getTenantDb().appointment.findFirst({
      where: { id, customerId: conv.customerId, status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED'] } },
      include: { service: true, staff: true },
    });
    if (!appt) {
      await reply(conv, 'Booking not found or cannot be rescheduled.');
      return;
    }

    await saveCtx(
      conv.id,
      {
        selectedServiceId: appt.serviceId,
        selectedStaffId: appt.staffId,
        managingAppointmentId: appt.id,
      },
      ConversationStep.PICK_DATE,
    );

    const dates = await suggestBookingDates(conv.salonId);
    const dateLines = dates.slice(0, 10).map((d, i) => `${i + 1}. ${d}`);
    await reply(
      conv,
      [
        `Rescheduling ${appt.service.name} with ${appt.staff.name}.`,
        'Pick a new date:',
        ...dateLines,
        '',
        'Or type a date YYYY-MM-DD',
        'Reply BACK to cancel and return to menu.',
      ].join('\n'),
    );
    return;
  }

  await reply(conv, 'Use: CANCEL 1 or RESCHEDULE 1 (number from your list), or BACK.');
}

async function handleComplaint(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  await getTenantDb().ticket.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      status: 'OPEN',
      subject: 'Complaint',
      messages: { create: { direction: MessageDirection.INBOUND, body: text } },
    },
  });
  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await reply(conv, `Thanks — we logged your complaint and will respond shortly.\n\n${mainMenu(conv.salon)}`);
}

// ─── Other / Something Else ────────────────────────────────────────────
// Flow: customer asks anything → AI answers → "Did that help? YES / NO"
//   YES → menu  |  NO → open ticket + IDLE (human picks up)
async function handleOtherQuery(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const answered = c.otherQueryAnswered as boolean | undefined;

  if (text.toUpperCase() === 'BACK' || text.toUpperCase() === 'MENU') {
    await saveCtx(conv.id, { otherQueryAnswered: undefined }, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  // If we already gave an answer and are waiting for YES/NO
  if (answered) {
    const upper = text.toUpperCase();
    if (upper === 'YES' || upper === 'Y') {
      await saveCtx(conv.id, { otherQueryAnswered: undefined }, ConversationStep.MENU);
      await reply(conv, `Great! 😊 Anything else I can help with?\n\n${mainMenu(conv.salon)}`);
      return;
    }
    if (upper === 'NO' || upper === 'N') {
      // Escalate to human
      const isOpen = isWithinBusinessHours(conv.salon);
      await getTenantDb().ticket.create({
        data: {
          salonId: conv.salonId,
          customerId: conv.customerId,
          status: 'OPEN',
          subject: 'Customer needs human help',
          messages: {
            create: {
              direction: MessageDirection.INBOUND,
              body: `Customer was not satisfied with AI answer.\nOriginal query: ${(c.otherQueryText as string | undefined) ?? text}`,
            },
          },
        },
      });
      await saveCtx(conv.id, { otherQueryAnswered: undefined, otherQueryText: undefined }, ConversationStep.IDLE);
      if (isOpen) {
        await reply(conv, "No problem — I've flagged this for a team member who will be with you shortly. 🙏");
      } else {
        await reply(conv, `${afterHoursHumanReply(conv.salon)}\n\nI've noted your question and a team member will follow up when we open.`);
      }
      return;
    }
    // They sent something new — treat it as a follow-up question
  }

  // Try AI assist
  try {
    const aiResult = await tryAiAssist(conv, text, mainMenu(conv.salon));
    if (aiResult.handled && aiResult.reply) {
      await saveCtx(conv.id, { otherQueryAnswered: true, otherQueryText: text });
      await reply(conv, aiResult.reply);
      await reply(conv, 'Did that answer your question? Reply YES or NO.');
      return;
    }
  } catch {
    // AI unavailable — fall through to escalation prompt
  }

  // AI couldn't answer — offer human
  await saveCtx(conv.id, { otherQueryAnswered: true, otherQueryText: text });
  await reply(conv, "I'm not sure I have the answer to that one. Would you like me to pass this on to a team member? Reply YES or NO.");
}

// ─── Post-Handoff Satisfaction Rating ──────────────────────────────────
// Triggered when staff clicks "Query Completed". Bot asked customer to rate 1–10.
async function handleHandoffRating(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const upper = text.trim().toUpperCase();
  if (upper === 'BACK' || upper === 'MENU' || upper === '0') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }
  const rating = parseInt(text.trim(), 10);

  if (isNaN(rating) || rating < 1 || rating > 10) {
    await reply(conv, 'Please reply with a number from 1 to 10.\n(or type MENU to return)');
    return;
  }

  // Record as analytics event
  await getTenantDb().analyticsEvent.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: null,
      type: 'handoff_rating',
      payload: { rating, timestamp: new Date().toISOString() },
    },
  });

  // Open a ticket for low scores so owner is notified
  if (rating <= 5) {
    await getTenantDb().ticket.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        status: 'OPEN',
        subject: `Low support satisfaction (${rating}/10)`,
        messages: {
          create: {
            direction: MessageDirection.INBOUND,
            body: `Customer rated their support experience ${rating}/10.`,
          },
        },
      },
    });
  }

  const salonName = conv.salon.tradingName?.trim() || conv.salon.name;

  let closing: string;
  if (rating >= 9) {
    closing = `${rating}/10 — that's amazing, thank you! 🌟 We're so glad we could help. See you next time at ${salonName}!`;
  } else if (rating >= 7) {
    closing = `${rating}/10 — thanks for the feedback! We'll keep working to make every experience great. 😊`;
  } else if (rating >= 5) {
    closing = `${rating}/10 — thank you for being honest. We'll use this to improve. If there's anything specific we can do better, feel free to let us know.`;
  } else {
    closing = `${rating}/10 — we're really sorry we didn't meet your expectations. Our team will review this and follow up with you. Thank you for letting us know. 🙏`;
  }

  await reply(conv, closing);

  // Move to IDLE — bot stays quiet until customer sends something, then menu restarts
  await saveCtx(conv.id, {
    handoffByStaff: undefined,
    errorCount: undefined,
    otherQueryAnswered: undefined,
    otherQueryText: undefined,
  }, ConversationStep.IDLE);
}

// ─── Rate My Experience ─────────────────────────────────────────────────
// Multi-step: stars → comment → NPS (1–10) → NPS reason → done
async function handleRateExperience(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const subStep = (c.ratingSubStep ?? 'stars') as 'stars' | 'comment' | 'nps' | 'nps_reason';

  if (text.toUpperCase() === 'BACK' || text.toUpperCase() === 'SKIP') {
    await saveCtx(conv.id, { ratingSubStep: undefined, ratingStars: undefined, ratingComment: undefined, ratingNps: undefined }, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  if (subStep === 'stars') {
    const stars = parseInt(text.trim(), 10);
    if (isNaN(stars) || stars < 1 || stars > 5) {
      await reply(conv, 'Please reply with a number from 1 to 5 (1 = Poor, 5 = Excellent), or BACK to cancel.');
      return;
    }
    await saveCtx(conv.id, { ratingStars: stars, ratingSubStep: 'comment' });
    const prompt = stars <= 2
      ? `We're sorry to hear that! 😔 What went wrong? Please leave a comment so we can improve:`
      : `Thanks! 😊 Would you like to leave a comment about your experience? (Or reply SKIP to continue)`;
    await reply(conv, prompt);
    return;
  }

  if (subStep === 'comment') {
    const comment = text.toUpperCase() === 'SKIP' ? '' : text.trim();
    await saveCtx(conv.id, { ratingComment: comment, ratingSubStep: 'nps' });
    await reply(conv, 'On a scale of 1–10, how likely are you to recommend us to a friend?\n(1 = Not at all, 10 = Definitely!)');
    return;
  }

  if (subStep === 'nps') {
    const nps = parseInt(text.trim(), 10);
    if (isNaN(nps) || nps < 1 || nps > 10) {
      await reply(conv, 'Please reply with a number from 1 to 10.');
      return;
    }
    await saveCtx(conv.id, { ratingNps: nps, ratingSubStep: 'nps_reason' });
    const prompt = nps <= 6
      ? `What's the main reason for your score? We really want to improve:`
      : `That means a lot! 🙏 What's the main reason for your high score? (Or reply SKIP)`;
    await reply(conv, prompt);
    return;
  }

  // nps_reason — final step, save everything
  if (subStep === 'nps_reason') {
    const reason = text.toUpperCase() === 'SKIP' ? '' : text.trim();
    const stars = (c.ratingStars ?? 0) as number;
    const comment = (c.ratingComment ?? '') as string;
    const nps = (c.ratingNps ?? 0) as number;

    // Persist as analytics event
    await getTenantDb().analyticsEvent.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        appointmentId: null,
        type: 'experience_rating',
        payload: { stars, comment, nps, npsReason: reason, timestamp: new Date().toISOString() },
      },
    });

    // Open a ticket for bad ratings (stars ≤ 2 or NPS ≤ 6) so owner is notified
    const isBadRating = stars <= 2 || nps <= 6;
    if (isBadRating) {
      const subject = stars <= 2
        ? `Low rating (${stars}★) from customer`
        : `Low NPS (${nps}/10) from customer`;
      const body = [
        `Stars: ${stars}/5`,
        `NPS: ${nps}/10`,
        comment ? `Comment: ${comment}` : null,
        reason ? `NPS reason: ${reason}` : null,
      ].filter(Boolean).join('\n');

      await getTenantDb().ticket.create({
        data: {
          salonId: conv.salonId,
          customerId: conv.customerId,
          status: 'OPEN',
          subject,
          messages: { create: { direction: MessageDirection.INBOUND, body } },
        },
      });
    }

    // Friendly closing message
    let closing: string;
    if (stars === 5 && nps >= 9) {
      closing = `Thank you so much! 🌟 Your kind words mean the world to us. See you next time!`;
    } else if (isBadRating) {
      closing = `Thank you for your honest feedback — it helps us get better. Our team will be in touch shortly to make it right. 🙏`;
    } else {
      closing = `Thank you for the feedback! We're always working to improve and hope to see you again soon. 😊`;
    }

    await saveCtx(conv.id, {
      ratingSubStep: undefined,
      ratingStars: undefined,
      ratingComment: undefined,
      ratingNps: undefined,
    }, ConversationStep.MENU);
    await reply(conv, closing);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  // Fallback — reset
  await saveCtx(conv.id, { ratingSubStep: 'stars' }, ConversationStep.RATE_EXPERIENCE);
  await reply(conv, '⭐ How would you rate your last visit? (1–5)');
}

async function handleFaq(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const n = parseInt(text, 10);
  const faqs = await getTenantDb().faqItem.findMany({
    where: { salonId: conv.salonId, status: 'APPROVED' },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });

  if (Number.isFinite(n) && n >= 1 && n <= faqs.length) {
    const f = faqs[n - 1]!;
    // EC-14: WhatsApp messages cap at ~4096 chars; truncate long answers
    const answer = f.answer.length > 3900 ? f.answer.slice(0, 3900) + '…' : f.answer;
    await reply(conv, `${f.question}\n\n${answer}\n\nReply with another number, ask a question, or BACK.`);
    return;
  }

  // Semantic search + Claude synthesis for free-text questions
  try {
    const { semanticSearch } = await import('../lib/integrations/ai/index.js');
    const { synthesizeFaqAnswer } = await import('./botAssistant.js');
    const results = await semanticSearch(conv.salonId, text, { limit: 3, threshold: 0.65 });
    if (results.length > 0) {
      const chunks = results.map((r) => r.content);
      const synthesized = await synthesizeFaqAnswer(conv.salon, text, chunks);
      const answer = synthesized ?? results[0]!.content;
      const truncated = answer.length > 3900 ? answer.slice(0, 3900) + '…' : answer;
      await reply(conv, `${truncated}\n\nReply with a FAQ number, ask another question, or BACK.`);
      return;
    }
  } catch {
    // AI unavailable — fall through to default message
  }

  await reply(conv, "I couldn't find an answer. Pick a FAQ number, ask differently, or reply BACK.");
}

async function handleLoyalty(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (text.toUpperCase() === 'REDEEM') {
    // Redemption requires a booking context — direct customer to book instead
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `🎊 To use your free cut, simply book your next appointment (option 1) and it will be applied automatically!\n\n${mainMenu(conv.salon)}`);
    return;
  }
  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await reply(conv, mainMenu(conv.salon));
}

// ─── Branch Selection ──────────────────────────────────────────────────
async function handlePickBranch(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (text.toUpperCase() === 'BACK') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  const c = ctx(conv);
  const branchOptions = (c.branchOptions ?? []) as string[];
  const idx = parseInt(text, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= branchOptions.length) {
    await reply(conv, `Please reply with a number (1-${branchOptions.length}) or BACK.`);
    return;
  }

  const branchId = branchOptions[idx];
  await saveCtx(conv.id, { selectedBranchId: branchId }, ConversationStep.PICK_SERVICE);

  const services = await getTenantDb().service.findMany({
    where: { salonId: conv.salon.id, active: true },
    orderBy: { sortOrder: 'asc' },
  });
  // EC-05: guard against empty service list after branch selection
  if (services.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, `No services configured yet. Please contact the salon.\n\n${mainMenu(conv.salon)}`);
    return;
  }
  const lines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  await reply(conv, ['Pick a service number:', ...lines, '', 'Reply BACK for menu.'].join('\n'));
}

// ─── Reschedule ────────────────────────────────────────────────────────
async function handleReschedule(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const appointmentId = c.rescheduleAppointmentId as string | undefined;

  if (text.toUpperCase() === 'CANCEL' || text.toUpperCase() === 'BACK') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  if (!appointmentId) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, 'Something went wrong. Let me take you back to the menu.');
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  // Cancel the old appointment and redirect to booking flow
  await getTenantDb().appointment.update({
    where: { id: appointmentId },
    data: { status: 'RESCHEDULED' },
  });

  await reply(conv, "Got it! Your old booking is cancelled. Let's pick a new time.");
  await saveCtx(conv.id, {}, ConversationStep.PICK_SERVICE);

  const services = await getTenantDb().service.findMany({
    where: { salonId: conv.salon.id, active: true },
    orderBy: { sortOrder: 'asc' },
  });
  const lines = services.map((s, i) => `${i + 1}. ${s.name} (${fmtMoney(s.priceCents)})`);
  await reply(conv, ['Pick a service:', ...lines, '', 'Reply BACK for menu.'].join('\n'));
}

// ─── CSAT Survey ───────────────────────────────────────────────────────
async function handleCsat(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const rating = parseInt(text.trim(), 10);

  if (isNaN(rating) || rating < 1 || rating > 5) {
    await reply(conv, 'Please reply with a number from 1 (poor) to 5 (excellent).');
    return;
  }

  const c = ctx(conv);
  const appointmentId = c.csatAppointmentId as string | undefined;

  // Record the CSAT event
  await getTenantDb().analyticsEvent.create({
    data: {
      salonId: conv.salon.id,
      customerId: conv.customerId,
      appointmentId: appointmentId ?? null,
      type: 'csat',
      payload: { rating, timestamp: new Date().toISOString() },
    },
  });

  const messages: Record<number, string> = {
    1: 'We\'re sorry to hear that. We\'ll work to improve. Thank you for the feedback.',
    2: 'Thank you for letting us know. We\'ll do better next time.',
    3: 'Thanks for the feedback! We appreciate it.',
    4: 'Great to hear! Thank you for your feedback.',
    5: 'Wonderful! So glad you had a great experience! 🌟',
  };

  await reply(conv, messages[rating] ?? 'Thank you!');
  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await reply(conv, mainMenu(conv.salon));
}

function fmtMoney(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

/** EC-13: Strip WhatsApp markdown chars from user-controlled strings to prevent formatting injection. */
function sanitize(s: string): string {
  return s.replace(/[*_~`[\]]/g, '');
}

function fmtDt(d: Date, zone: string): string {
  return DateTime.fromJSDate(d).setZone(zone).toFormat('ccc dd LLL yyyy HH:mm');
}

function fmtDate(d: Date, zone: string): string {
  return DateTime.fromJSDate(d).setZone(zone).toFormat('dd LLL yyyy');
}

function buildStampBar(earned: number, total: number): string {
  const filled = Math.min(earned, total);
  const empty = total - filled;
  return `[${'★'.repeat(filled)}${'☆'.repeat(empty)}] ${filled}/${total}`;
}
