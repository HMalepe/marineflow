import {
  ConversationStep,
  MessageDirection,
  Prisma,
  type Conversation,
  type Customer,
  type Salon,
  type Staff,
} from '@prisma/client';
import { getTenantDb, withTenantContext } from '../lib/db/tenantSession.js';
import { prisma } from '../lib/prisma.js';
import {
  assertTenantActive,
  resolveTenantForInbound,
  type ResolvedTenant,
} from '../lib/tenant.js';
import { salonUsesCloudInteractiveMenu } from '../lib/integrations/messaging/interactiveList.js';
import { sendWithFallback } from './channelRouter.js';
import { buildMainMenuInteractive } from './mainMenuInteractive.js';
import { emitMessageReceived, emitBotEscalation } from '../lib/eventBus.js';
import { normalizeWaId } from '../lib/phone.js';
import { isConversationWakeMessage, staffHandoffExpired } from '../lib/conversationWake.js';
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
  buildMainMenuText,
  buildSubMenuText,
  isMenuCategoryId,
  parseMainMenuChoice,
  parseSubMenuChoice,
  salonDisplayName,
  SERVICE_CATEGORY_ALIASES,
  type MenuCategoryId,
  type ServiceCategoryKey,
} from '../lib/hierarchicalMenu.js';
import {
  afterServiceSelected,
  handleAddonPhase,
  handleReferralMenuItem,
  handleMembershipMenuItem,
  tryCancelWithRules,
  afterAppointmentCancelled,
  onBookingConfirmed,
  tryHandleWaitlistReply,
  computeAppointmentEnd,
} from './botPowerFeatures.js';
import { sendWelcomeJourneyIfNeeded } from './welcomeJourney.js';
import {
  claimReviewIncentive,
  applyReviewCreditTx,
  formatReviewReward,
  sendGoogleReviewFollowUp,
  parseReviewClaimCommand,
  reviewedClaimErrorMessage,
  resolveGoogleReviewSettings,
  prepareGoogleReviewFollowUp,
  isValidGoogleReviewUrl,
} from './reviewIncentive.js';
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
import {
  BIRTHDAY_MSG_LOOKBACK_DAYS,
  BIRTHDAY_TREAT_TAG,
  isWithinBirthdayWindow,
} from './outboundCampaigns.js';
import { incrementCustomerBookingCount } from './noShowRisk.js';
import {
  buildPopiaRightsHint,
  deleteCustomerData,
  exportCustomerData,
  formatMyDataAccessSummary,
  isDeletedCustomer,
  isPopiaDeleteCommand,
  isPopiaMyDataCommand,
  notifyPopiaRightsOnce,
} from './compliance.js';

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
  /** Set when the bot auto-escalated due to negative sentiment — prevents re-escalation loop until staff resolves. */
  negativeSentimentEscalated?: boolean;
  /** AI-suggested quick book slots (A/B/C). */
  quickPickOptions?: QuickPickOption[];
  /**
   * Staff ids in the exact order last rendered in the PICK_STAFF menu.
   * Replies are parsed against this snapshot so the number the customer saw
   * always maps to the stylist they meant, even if the roster (or their
   * preferred stylist) changes between menu render and reply.
   */
  staffOrderIds?: string[];
  /** Hierarchical main-menu sub-section (appointments, services, …). */
  menuCategory?: MenuCategoryId;
  /** When set, PICK_SERVICE only shows these service ids (from Services submenu). */
  serviceFilterIds?: string[];
  /** Hint for manage-booking submenu (view / reschedule / cancel). */
  manageBookingHint?: 'view' | 'reschedule' | 'cancel';
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
  /** Pending profile fields during first-time booking collection (not persisted until POPIA consent). */
  pendingFirstName?: string;
  pendingLastName?: string;
  pendingEmail?: string;
  /** ISO date string YYYY-MM-DD — stored as string to survive JSON round-trip safely. */
  pendingDateOfBirth?: string;
};

const PROFILE_NAME_REGEX = /^[a-zA-Z\s'-]{1,80}$/;
const PROFILE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PENDING_PROFILE_CLEAR: Pick<
  BotContext,
  | 'pendingFirstName'
  | 'pendingLastName'
  | 'pendingEmail'
  | 'pendingDateOfBirth'
  | 'negativeSentimentEscalated'
  | 'otherQueryAnswered'
  | 'otherQueryText'
  | 'menuCategory'
  | 'serviceFilterIds'
  | 'manageBookingHint'
> = {
  pendingFirstName: undefined,
  pendingLastName: undefined,
  pendingEmail: undefined,
  pendingDateOfBirth: undefined,
  negativeSentimentEscalated: undefined,
  otherQueryAnswered: undefined,
  otherQueryText: undefined,
  menuCategory: undefined,
  serviceFilterIds: undefined,
  manageBookingHint: undefined,
};

function isProfileIncomplete(customer: Customer): boolean {
  return !customer.firstName || !customer.lastName || !customer.email || !customer.dateOfBirth;
}

/** Parse DD/MM/YYYY or YYYY-MM-DD.  Returns null for unrecognised formats or impossible dates. */
function parseDOB(text: string): Date | null {
  const t = text.trim();

  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const d = parseInt(slash[1]!), m = parseInt(slash[2]!), y = parseInt(slash[3]!);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
  }

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1]!), m = parseInt(iso[2]!), d = parseInt(iso[3]!);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
  }

  return null;
}

function validateDOBAge(dob: Date): string | null {
  const now = new Date();
  if (dob > now) return 'Date of birth cannot be in the future. Please try again.';
  const age =
    now.getFullYear() -
    dob.getFullYear() -
    (now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
      ? 1
      : 0);
  if (age > 120) return 'Please enter a valid date of birth.';
  return null;
}

function buildBookingPopiaConsentMessage(): string {
  return [
    'Before we continue, we need your consent under *POPIA* (Protection of Personal Information Act).',
    '',
    '*Why we collect this:*',
    '• Process your appointment booking',
    '• Send booking confirmations and reminders',
    '• Age-appropriate service and pricing',
    '',
    '*Your rights:*',
    '• Request access to your personal data at any time',
    '• Ask us to delete your data — reply *DELETE* anytime',
    '',
    'Consent is *required* to complete a booking via WhatsApp.',
    '',
    'Reply *YES* to accept and continue',
    'Reply *NO* to decline (you can phone the salon instead)',
    '',
    'Reply BACK for menu.',
  ].join('\n');
}


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

/** undefined in patch = delete key (Prisma Json rejects undefined values). */
function applyContextPatch(base: BotContext, patch: Partial<BotContext>): BotContext {
  const next: BotContext = { ...base };
  for (const [key, value] of Object.entries(patch) as [keyof BotContext, unknown][]) {
    if (value === undefined) {
      delete next[key];
    } else {
      (next as Record<string, unknown>)[key as string] = value;
    }
  }
  return next;
}

async function saveCtx(convId: string, patch: Partial<BotContext>, step?: ConversationStep) {
  const conv = await getTenantDb().conversation.findUniqueOrThrow({ where: { id: convId } });
  const next = applyContextPatch(ctx(conv), patch);
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
  sendOptions?: { interactive?: ReturnType<typeof buildMainMenuInteractive> },
) {
  let providerSid: string | null = outboundSid ?? null;
  if (!providerSid) {
    try {
      const { result } = await sendWithFallback({
        salonId: conv.salonId,
        to: conv.customer.waId,
        body: text,
        interactive: sendOptions?.interactive,
      });
      providerSid = result.providerMessageId ?? null;
      if (!providerSid) {
        logger.error({ to: conv.customer.waId, salonId: conv.salonId }, 'reply_send_no_provider_id');
        return;
      }
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

async function replyMenu(conv: Conversation & { customer: Customer; salon: Salon }) {
  const body = mainMenu(conv.salon);
  const interactive = salonUsesCloudInteractiveMenu(conv.salon.whatsappPhoneId)
    ? buildMainMenuInteractive(conv.salon)
    : undefined;
  await reply(conv, body, null, interactive ? { interactive } : undefined);
}

async function replyWithMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
  prefix: string,
) {
  await reply(conv, prefix);
  await replyMenu(conv);
}

function mainMenu(salon: Salon): string {
  return buildMainMenuText(salon);
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
  return (
    lower.includes('human') ||
    lower.includes('talk to') ||
    lower.includes('speak to') ||
    lower.includes('real person') ||
    lower.includes('live agent') ||
    lower.includes('speak with') ||
    lower.includes('talk with') ||
    lower.includes('customer service') ||
    lower.includes('staff member') ||
    lower.includes('someone there')
  );
}

type ConvWithRelations = Conversation & { customer: Customer; salon: Salon };

async function sendTenantWhatsApp(salonId: string, waId: string, body: string): Promise<void> {
  try {
    const { result } = await sendWithFallback({ salonId, to: waId, body });
    if (!result.providerMessageId) {
      logger.error({ salonId, waId }, 'tenant_whatsapp_send_no_provider_id');
    }
  } catch (err) {
    logger.error({ err, salonId, waId }, 'tenant_whatsapp_send_failed');
  }
}

async function reloadConversation(convId: string): Promise<ConvWithRelations> {
  return getTenantDb().conversation.findUniqueOrThrow({
    where: { id: convId },
    include: { customer: true, salon: true },
  });
}

/**
 * Recover from silent HANDOFF states (staff claimed, sentiment escalation).
 * Returns handled=true when the bot intentionally stays silent or already replied.
 */
async function tryRecoverFromSilentHandoff(
  conv: ConvWithRelations,
  text: string,
): Promise<{ handled: boolean; conv: ConvWithRelations }> {
  const c = ctx(conv);
  const isSilentStep =
    conv.step === ConversationStep.HANDOFF || conv.step === ConversationStep.CLOSED;
  if (!isSilentStep) return { handled: false, conv };

  if (c.handoffByStaff) {
    const expired = staffHandoffExpired(conv.lastMessageAt);
    const wake = isConversationWakeMessage(text);
    if (!expired && !wake) {
      logger.info({ convId: conv.id }, 'bot_silent_handoff');
      return { handled: true, conv };
    }
    logger.info({ convId: conv.id, expired, wake }, 'bot_handoff_auto_release');
    await saveCtx(
      conv.id,
      { handoffByStaff: undefined, ...PENDING_PROFILE_CLEAR },
      ConversationStep.MENU,
    );
    const updated = await reloadConversation(conv.id);
    if (wake) {
      await replyMenu(updated);
      return { handled: true, conv: updated };
    }
    return { handled: false, conv: updated };
  }

  if (c.negativeSentimentEscalated) {
    if (isConversationWakeMessage(text)) {
      logger.info({ convId: conv.id }, 'bot_sentiment_handoff_wake');
      await saveCtx(
        conv.id,
        { negativeSentimentEscalated: undefined, ...PENDING_PROFILE_CLEAR },
        ConversationStep.MENU,
      );
      const updated = await reloadConversation(conv.id);
      await replyMenu(updated);
      return { handled: true, conv: updated };
    }
    logger.info({ convId: conv.id }, 'bot_silent_sentiment_handoff');
    return { handled: true, conv };
  }

  return { handled: false, conv };
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
    await sendTenantWhatsApp(
      tenant.id,
      waId,
      'This business is not accepting bookings right now. Please try again later.',
    );
    return;
  }

  if (!(await rateLimitOrReject(waId))) {
    await sendTenantWhatsApp(tenant.id, waId, 'Too many messages — please wait a minute and try again.');
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
  } catch (err) {
    logger.error({ err, tenantId: tenant.id, waId }, 'bot_transaction_failed');
    // Last resort — send the menu without persisting (avoid alarming the customer)
    try {
      const salon = await prisma.salon.findUnique({
        where: { id: tenant.id },
        select: {
          name: true,
          welcomeMessage: true,
          botLoyaltyEnabled: true,
          metadata: true,
          openTime: true,
          closeTime: true,
          timezone: true,
          whatsappPhoneId: true,
          addressLine: true,
          phoneDisplay: true,
          parkingNotes: true,
          accessibility: true,
        },
      });
      if (salon) {
        await sendTenantWhatsApp(tenant.id, waId, buildMainMenuText(salon as Salon));
      }
    } catch (fallbackErr) {
      logger.error({ err: fallbackErr }, 'bot_fallback_menu_failed');
    }
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

  let conv: ConvWithRelations;
  const existingConv = await getTenantDb().conversation.findUnique({
    where: { salonId_customerId: { salonId: salon.id, customerId: customer.id } },
    include: { customer: true, salon: true },
  });
  if (!existingConv) {
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
      where: { id: existingConv.id },
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

  const isFirstEverMessage = conv.messageCount === 0;
  if (isFirstEverMessage) {
    void sendWelcomeJourneyIfNeeded({
      salonId: salon.id,
      customerId: customer.id,
      isFirstInteraction: customer.bookingCount === 0,
      send: (body) => reply(conv, body),
    }).catch((err) => logger.warn({ err }, 'welcome_journey_failed'));
  }

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

  // POPIA erasure / access — must run before marketing consent gate (legal priority)
  if (isPopiaDeleteCommand(text)) {
    if (isDeletedCustomer(customer)) {
      await reply(
        conv,
        'Your personal data has already been removed from our records. ' +
          'Reply 1 anytime to book again — we\'ll start fresh.',
      );
      await saveCtx(conv.id, {}, ConversationStep.GREETING);
      return;
    }
    await deleteCustomerData(customer.id, salon.id);
    await reply(
      conv,
      'Your personal data has been removed from our records as requested. ' +
        'Your booking history is retained for legal compliance only. ' +
        'If you\'d like to book again in the future, we\'ll start fresh.',
    );
    await saveCtx(conv.id, {}, ConversationStep.GREETING);
    return;
  }

  if (isPopiaMyDataCommand(text)) {
    const exported = await exportCustomerData(customer.id);
    if (!exported) {
      await reply(conv, 'We could not find your data on file. Reply 1 to get started.');
      return;
    }
    await reply(conv, formatMyDataAccessSummary(exported));
    return;
  }

  const consentHandled = await handleMarketingConsentFlow(conv, text);
  if (consentHandled) return;

  const recovery = await tryRecoverFromSilentHandoff(conv, text);
  if (recovery.handled) return;
  conv = recovery.conv;

  const lower = text.toLowerCase();
  if (lower === 'undo' || lower === 'back') {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }

  const waitlistHandled = await tryHandleWaitlistReply(conv, text, {
    reply: (body) => reply(conv, body),
    saveContext: (patch, step) =>
      saveCtx(conv.id, patch, step as ConversationStep | undefined),
    startBooking: () => startBookingFlow(conv),
  });
  if (waitlistHandled) return;

  // Birthday-campaign treat claim — the outbound message says "reply BIRTHDAY"
  if (lower === 'birthday') {
    await handleBirthdayKeyword(conv);
    return;
  }

  const reviewCmd = parseReviewClaimCommand(text);
  if (reviewCmd) {
    const token = reviewCmd.kind === 'token_only' ? reviewCmd.token : reviewCmd.token;
    await handleReviewedKeyword(conv, token);
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

    // Notify owner — best-effort, never blocks handoff
    void (async () => {
      try {
        const ownerUser = await getTenantDb().staffUser.findFirst({
          where: { salonId: salon.id, role: 'OWNER', active: true },
          select: { phone: true },
          orderBy: { createdAt: 'asc' },
        });
        const ownerPhone = ownerUser?.phone?.trim();
        if (ownerPhone) {
          const customerName = customer.displayName ?? customer.firstName ?? customer.waId;
          await sendWithFallback({
            salonId: salon.id,
            to: ownerPhone,
            body: `🙋 ${sanitize(customerName)} is asking to speak to a person. Check the dashboard to respond.`,
          });
        }
      } catch {
        // never let notification fail the handoff
      }
    })();

    await reply(
      conv,
      'Thanks — a team member will read this chat and respond as soon as possible.',
    );
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.IDLE);
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
    // §4.4/§5 — check negative sentiment FIRST; cannot be bypassed by handled flag
    if (aiResult.negativeSentiment) {
      await escalateNegativeSentiment(conv, text);
      return;
    }
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
        await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
        await replyMenu(conv);
        return;
      }

      const prevCount = (ctx(conv).errorCount as number | undefined) ?? 0;
      const errorCount = prevCount + 1;

      if (errorCount >= 2) {
        // Escalate: move to HANDOFF, notify user, open a ticket, ping dashboard
        await saveCtx(conv.id, { ...PENDING_PROFILE_CLEAR, errorCount }, ConversationStep.HANDOFF);

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
        await saveCtx(conv.id, { ...PENDING_PROFILE_CLEAR, errorCount }, ConversationStep.MENU);
        await replyWithMenu(conv, `Sorry, something went wrong on our end. Let's start over.`);
      }
    } catch (innerErr) {
      logger.error({ innerErr }, 'error_recovery_failed');
    }
  }
}

/**
 * §4.4 / §5 — Auto-escalate when the AI orchestrator detects genuine negative sentiment
 * (anger, threats, abuse, extreme frustration, or distress).
 * Opens a ticket, sends an empathetic holding message, and pings the dashboard.
 * Called before the normal aiResult.handled check so it cannot be bypassed.
 */
async function escalateNegativeSentiment(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  logger.info(
    { convId: conv.id, customerId: conv.customerId },
    'negative_sentiment_escalation',
  );

  const db = getTenantDb();

  await db.ticket.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      status: 'OPEN',
      subject: 'Negative sentiment detected — customer may need urgent help',
      messages: {
        create: {
          direction: MessageDirection.INBOUND,
          body: `AI flagged negative sentiment.\nCustomer message: "${text.slice(0, 300)}"`,
        },
      },
    },
  });

  // Track escalation rate in analytics (best-effort)
  await db.analyticsEvent.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      type: 'negative_sentiment_escalation',
      payload: { lastText: text.slice(0, 200), timestamp: new Date().toISOString() },
    },
  });

  // Set flag BEFORE reply so the HANDOFF handler's silence guard is in place
  // for any concurrent message that arrives while the reply is in-flight.
  // Spread PENDING_PROFILE_CLEAR to discard any dangling profile/query state.
  await saveCtx(
    conv.id,
    { ...PENDING_PROFILE_CLEAR, negativeSentimentEscalated: true },
    ConversationStep.HANDOFF,
  );

  const isOpen = isWithinBusinessHours(conv.salon);
  const holdingMessage = isOpen
    ? "I can hear that you're frustrated, and I'm sorry for any inconvenience. " +
      "I've flagged this for one of our team members who will reach out to you shortly. " +
      "We want to make this right."
    : "I can hear that you're frustrated, and I'm sorry for any inconvenience. " +
      "I've flagged this for our team — we're currently outside business hours but someone will follow up with you as soon as we open. " +
      "We want to make this right.";

  await reply(conv, holdingMessage);

  emitBotEscalation(conv.salonId, conv.customerId, conv.id, {
    reason: 'negative_sentiment',
    lastText: text.slice(0, 200),
  }).catch((err: unknown) => logger.warn({ err }, 'emit_escalation_failed'));
}

const BIRTHDAY_TREAT_TICKET_SUBJECT = 'Birthday treat — apply 50% off';
const DAY_MS = 86_400_000;

/**
 * The birthday campaign promises "reply BIRTHDAY for a special treat" (50% off
 * a service). Guarded by:
 *   1. DOB on file + within ±7 days of birthday (salon timezone)
 *   2. A birthday_sent outbound message in the last 14 days (proves we invited them)
 * Staff apply the discount manually via the ticket this opens.
 */
async function handleBirthdayKeyword(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const db = getTenantDb();
  const fresh = await db.customer.findUnique({
    where: { id: conv.customerId },
    select: { dateOfBirth: true, tags: true, marketingConsentStatus: true },
  });

  if (
    !fresh?.dateOfBirth ||
    !isWithinBirthdayWindow(fresh.dateOfBirth, conv.salon.timezone)
  ) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(
      conv,
      `We'd love to celebrate with you, but the birthday treat is only available around your birthday. 😊`,
    );
    return;
  }

  const recentBirthdayMsg = await db.analyticsEvent.findFirst({
    where: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      type: 'birthday_sent',
      createdAt: { gte: new Date(Date.now() - BIRTHDAY_MSG_LOOKBACK_DAYS * DAY_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!recentBirthdayMsg) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(
      conv,
      `The birthday treat is available after you receive our birthday message. If you think this is a mistake, reply 0 to speak to our team.`,
    );
    return;
  }

  if (!fresh.tags.includes(BIRTHDAY_TREAT_TAG)) {
    await db.customer.update({
      where: { id: conv.customerId },
      data: { tags: { push: BIRTHDAY_TREAT_TAG } },
    });
  }

  const alreadyClaimed = await db.analyticsEvent.findFirst({
    where: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      type: 'birthday_treat_claimed',
      createdAt: { gte: recentBirthdayMsg.createdAt },
    },
  });

  if (!alreadyClaimed) {
    const existingTicket = await db.ticket.findFirst({
      where: {
        customerId: conv.customerId,
        subject: BIRTHDAY_TREAT_TICKET_SUBJECT,
        status: 'OPEN',
      },
    });
    if (!existingTicket) {
      await db.ticket.create({
        data: {
          salonId: conv.salonId,
          customerId: conv.customerId,
          status: 'OPEN',
          subject: BIRTHDAY_TREAT_TICKET_SUBJECT,
          messages: {
            create: {
              direction: MessageDirection.INBOUND,
              body: 'Customer claimed their birthday treat. Apply 50% off one service of their choice on their next booking.',
            },
          },
        },
      });
    }
    await db.analyticsEvent.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        type: 'birthday_treat_claimed',
        payload: { birthdaySentAt: recentBirthdayMsg.createdAt.toISOString() },
      },
    });
    logger.info({ convId: conv.id, customerId: conv.customerId }, 'birthday_treat_claimed');
  }

  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await replyWithMenu(
    conv,
    `🎂 Wonderful! Your birthday treat is locked in — 50% off a service of your choice. Our team will apply it when you visit.\n\nReply 1 to book now!`,
  );
}

async function handleMarketingConsentFlow(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<boolean> {
  const salon = conv.salon;
  const status = conv.customer.marketingConsentStatus;

  // Owner can disable the POPIA consent prompt — skip the whole flow
  if (!salon.botAskMarketingConsent) return false;

  if (isGlobalMarketingOptOut(text)) {
    if (status !== 'DECLINED') {
      await applyMarketingConsentChoice({
        customerId: conv.customerId,
        salonId: salon.id,
        choice: 'decline',
        source: 'whatsapp_stop',
      });
      // Item 30: track opt-out as analytics event for campaign metrics
      void getTenantDb().analyticsEvent.create({
        data: {
          salonId: salon.id,
          customerId: conv.customerId,
          type: 'marketing_opt_out',
          payload: { source: 'whatsapp_stop' },
        },
      }).catch(() => {});
    }
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyWithMenu(conv, buildConsentStopMessage());
    return true;
  }

  if (status === 'DECLINED' && isGlobalMarketingOptIn(text)) {
    await applyMarketingConsentChoice({
      customerId: conv.customerId,
      salonId: salon.id,
      choice: 'accept',
      source: 'whatsapp_opt_in',
    });
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyWithMenu(conv, buildConsentAcceptedMessage());
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
    await replyWithMenu(conv, ack);
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

  switch (conv.step) {
    case ConversationStep.GREETING:
    case ConversationStep.MENU:
    case ConversationStep.IDLE:
      await handleMenu(conv, t);
      break;
    case ConversationStep.MARKETING_CONSENT:
      await handleMarketingConsentFlow(conv, t);
      break;
    case ConversationStep.COLLECT_FIRST_NAME:
      await handleCollectFirstName(conv, t);
      break;
    case ConversationStep.COLLECT_LAST_NAME:
      await handleCollectLastName(conv, t);
      break;
    case ConversationStep.COLLECT_EMAIL:
      await handleCollectEmail(conv, t);
      break;
    case ConversationStep.COLLECT_DATE_OF_BIRTH:
      await handleCollectDateOfBirth(conv, t);
      break;
    case ConversationStep.BOOKING_POPIA_CONSENT:
      await handleBookingPopiaConsent(conv, t);
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
      if (ctx(conv).negativeSentimentEscalated) {
        // Negative-sentiment escalation is pending staff pick-up — stay silent so
        // we do not auto-recover to MENU and trigger a duplicate escalation loop.
        logger.info({ convId: conv.id }, 'bot_silent_sentiment_handoff');
        return;
      }
      // Bot-error HANDOFF with no staff claim — auto-recover so the customer
      // isn't stuck indefinitely.
      logger.info({ convId: conv.id }, 'bot_auto_recover_handoff');
      await saveCtx(conv.id, { errorCount: undefined }, ConversationStep.MENU);
      await replyMenu(conv);
      return;
    default:
      await saveCtx(conv.id, {}, ConversationStep.MENU);
      await replyMenu(conv);
  }
}

async function startBookingFlow(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const salon = conv.salon;

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

  if (branches.length === 1) {
    await saveCtx(conv.id, { selectedBranchId: branches[0].id });
  }

  const services = await getTenantDb().service.findMany({
    where: { salonId: salon.id, active: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (services.length === 0) {
    await replyWithMenu(conv, `No services configured yet. Please contact the salon.`);
    return;
  }
  const lines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  await saveCtx(conv.id, {}, ConversationStep.PICK_SERVICE);
  // Item 29: funnel entry tracking
  void getTenantDb().analyticsEvent.create({
    data: { salonId: salon.id, customerId: conv.customerId, type: 'funnel_pick_service' },
  }).catch(() => {});
  await reply(conv, ['Pick a service number:', ...lines, '', 'Reply BACK for menu.'].join('\n'));
}

async function handleCollectFirstName(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const name = text.trim();
  if (!PROFILE_NAME_REGEX.test(name)) {
    await reply(
      conv,
      'Please enter a valid first name (letters only, up to 80 characters). Reply BACK for menu.',
    );
    return;
  }

  await saveCtx(conv.id, { pendingFirstName: name }, ConversationStep.COLLECT_LAST_NAME);
  await reply(conv, 'Thanks! What is your *surname*?\n(Letters only — reply BACK for menu.)');
}

async function handleCollectLastName(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const name = text.trim();
  if (!PROFILE_NAME_REGEX.test(name)) {
    await reply(
      conv,
      'Please enter a valid surname (letters only, up to 80 characters). Reply BACK for menu.',
    );
    return;
  }

  await saveCtx(conv.id, { pendingLastName: name }, ConversationStep.COLLECT_EMAIL);
  await reply(conv, 'What is your *email address*?\n(Reply BACK for menu.)');
}

async function handleCollectEmail(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const email = text.trim().toLowerCase();
  if (!PROFILE_EMAIL_REGEX.test(email)) {
    await reply(
      conv,
      'Please enter a valid email address (e.g. name@example.com). Reply BACK for menu.',
    );
    return;
  }

  await saveCtx(conv.id, { pendingEmail: email }, ConversationStep.COLLECT_DATE_OF_BIRTH);
  await reply(
    conv,
    'What is your *date of birth*? (DD/MM/YYYY, e.g. 15/06/1990)\n(Reply BACK for menu.)',
  );
}

async function handleCollectDateOfBirth(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const dob = parseDOB(text);
  if (!dob) {
    await reply(
      conv,
      'Please enter your date of birth in DD/MM/YYYY format (e.g. 15/06/1990). Reply BACK for menu.',
    );
    return;
  }
  const ageError = validateDOBAge(dob);
  if (ageError) {
    await reply(conv, `${ageError} Reply BACK for menu.`);
    return;
  }

  const dobStr = `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
  await saveCtx(conv.id, { pendingDateOfBirth: dobStr }, ConversationStep.BOOKING_POPIA_CONSENT);
  await reply(conv, buildBookingPopiaConsentMessage());
}

async function handleBookingPopiaConsent(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const salon = conv.salon;
  const answer = text.trim().toUpperCase();

  if (answer !== 'YES' && answer !== 'NO') {
    await reply(
      conv,
      'Please reply *YES* to accept or *NO* to decline.\n\n' + buildBookingPopiaConsentMessage(),
    );
    return;
  }

  const db = getTenantDb();
  const pending = ctx(conv);

  if (answer === 'NO') {
    // Audit the decline but store NO customer PII.
    await db.auditLog.create({
      data: {
        salonId: salon.id,
        action: 'booking_profile_consent_declined',
        entity: 'Customer',
        entityId: conv.customerId,
        payload: { source: 'whatsapp' },
      },
    });
    const phoneHint = salon.phoneDisplay
      ? ` You can also phone us on ${salon.phoneDisplay} to book.`
      : ' Please contact the salon by phone to book.';
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyWithMenu(
      conv,
      `Understood — we won't store your details without consent.${phoneHint}`,
    );
    return;
  }

  const firstName = pending.pendingFirstName;
  const lastName = pending.pendingLastName;
  const email = pending.pendingEmail;
  const dobStr = pending.pendingDateOfBirth;

  if (
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    typeof email !== 'string' ||
    typeof dobStr !== 'string'
  ) {
    // Context was lost (e.g. previous error recovery) — restart collection cleanly.
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.COLLECT_FIRST_NAME);
    await reply(
      conv,
      [
        'Something went wrong — let\'s collect your details again.',
        '',
        'What is your *first name*? (Reply BACK for menu.)',
      ].join('\n'),
    );
    return;
  }

  const dateOfBirth = new Date(dobStr);

  // Both writes share the outer withTenantContext transaction — always consistent.
  await db.customer.update({
    where: { id: conv.customerId },
    data: {
      firstName,
      lastName,
      email,
      dateOfBirth,
      displayName: `${firstName} ${lastName}`.trim(),
    },
  });

  await db.auditLog.create({
    data: {
      salonId: salon.id,
      action: 'booking_profile_consent_granted',
      entity: 'Customer',
      entityId: conv.customerId,
      payload: { source: 'whatsapp', emailProvided: true, dobProvided: true },
    },
  });

  await saveCtx(conv.id, PENDING_PROFILE_CLEAR);

  const updatedCustomer = await db.customer.findUniqueOrThrow({ where: { id: conv.customerId } });
  await startBookingFlow({ ...conv, customer: updatedCustomer });
}

async function menuActionStartBooking(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  await saveCtx(conv.id, {
    selectedServiceId: undefined,
    selectedStaffId: undefined,
    selectedBranchId: undefined,
    branchOptions: undefined,
    localDateStr: undefined,
    slotStartIso: undefined,
    anyStaff: undefined,
    managingAppointmentId: undefined,
    staffOrderIds: undefined,
    serviceFilterIds: undefined,
    ...PENDING_PROFILE_CLEAR,
  });

  if (isProfileIncomplete(conv.customer)) {
    await saveCtx(conv.id, {}, ConversationStep.COLLECT_FIRST_NAME);
    await reply(
      conv,
      [
        'Great — let\'s get you booked! First, we need a few details.',
        '',
        'What is your *first name*?',
        '(Letters only — reply BACK for menu.)',
      ].join('\n'),
    );
    return;
  }

  await startBookingFlow(conv);
}

async function menuActionViewBookings(
  conv: Conversation & { customer: Customer; salon: Salon },
  hint: 'view' | 'reschedule' | 'cancel' = 'view',
): Promise<void> {
  const salon = conv.salon;
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
  if (hint === 'reschedule') lines.push('📅 *Reschedule an appointment*');
  else if (hint === 'cancel') lines.push('📅 *Cancel an appointment*');
  else lines.push('📅 *Your appointments*');

  if (upcoming.length > 0) {
    lines.push('', '*Upcoming:*');
    upcoming.forEach((a, i) => lines.push(fmtAppt(a, i + 1)));
  } else {
    lines.push('', 'No upcoming appointments.');
  }

  if (past.length > 0 && hint === 'view') {
    lines.push('', '*Past bookings:*');
    past.forEach((a, i) => {
      lines.push(`${i + 1}. ${sanitize(a.service.name)}\n   ${fmtDt(a.start, salon.timezone)} with ${sanitize(a.staff.name)}`);
    });
  }

  if (upcoming.length === 0 && past.length === 0) {
    await replyWithMenu(conv, 'No bookings found yet.');
    return;
  }

  if (upcoming.length > 0) {
    const actionHint =
      hint === 'cancel'
        ? 'Reply CANCEL 1 (use the upcoming number) to cancel, or BACK.'
        : hint === 'reschedule'
          ? 'Reply RESCHEDULE 1 (use the upcoming number) to reschedule, or BACK.'
          : 'Reply CANCEL 1 or RESCHEDULE 1 to manage (use the upcoming number), or BACK.';
    lines.push('', actionHint);
    await saveCtx(
      conv.id,
      { manageList: upcoming.map((a) => a.id), manageBookingHint: hint, menuCategory: undefined },
      ConversationStep.MANAGE_BOOKING,
    );
  } else {
    lines.push('', 'Reply BACK for menu.');
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
  }

  await reply(conv, lines.join('\n'));
}

async function menuActionLoyaltyBalance(
  conv: Conversation & { customer: Customer; salon: Salon },
  emphasizeRedeem = false,
): Promise<void> {
  const salon = conv.salon;
  if (!salon.botLoyaltyEnabled) {
    await replyWithMenu(conv, 'Rewards are not available at this salon right now.');
    return;
  }

  await ensureLoyaltyProgram(salon.id);
  const bal = await getStampBalance(salon.id, conv.customerId);
  const stampsPerReward = bal.stampsPerReward ?? 10;
  const stamps = bal.stamps ?? 0;
  const remaining = Math.max(0, stampsPerReward - (stamps % stampsPerReward));
  const redeemable = stamps >= stampsPerReward;
  const progressBar = buildStampBar(stamps % stampsPerReward || (redeemable ? stampsPerReward : 0), stampsPerReward);

  const lines = [
    `⭐ *Your rewards* — ${salonDisplayName(salon)}`,
    '',
    `Points: ${stamps} stamp${stamps === 1 ? '' : 's'}`,
    progressBar,
    redeemable
      ? `\n🎊 You've earned a reward! Reply REDEEM on your next booking to use it.`
      : `${remaining} more visit${remaining === 1 ? '' : 's'} until your next reward!`,
    '',
    emphasizeRedeem && redeemable
      ? 'Reply 1 under *Appointments › Book* to redeem on your next visit.'
      : '',
    'Reply BACK for menu.',
  ].filter(Boolean);

  await saveCtx(conv.id, { menuCategory: undefined }, ConversationStep.LOYALTY);
  await reply(conv, lines.join('\n'));
}

async function menuActionShowFaqs(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const faqs = await getTenantDb().faqItem.findMany({
    where: { salonId: conv.salon.id, status: 'APPROVED' },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });
  if (faqs.length === 0) {
    await replyWithMenu(conv, 'No FAQs available yet.');
    return;
  }
  await saveCtx(conv.id, { menuCategory: undefined }, ConversationStep.FAQ);
  const lines = faqs.map((f, i) => `${i + 1}. ${f.question}`);
  await reply(
    conv,
    ['FAQs — reply with a number, or ask a question:', ...lines, '', 'Reply BACK for menu.'].join('\n'),
  );
}

async function menuActionShowContact(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const salon = conv.salon;
  const parts = [
    `📞 *Contact ${salonDisplayName(salon)}*`,
    salon.phoneDisplay ? `Phone: ${salon.phoneDisplay}` : null,
    (salon as unknown as { contactEmail?: string }).contactEmail
      ? `Email: ${(salon as unknown as { contactEmail?: string }).contactEmail}`
      : null,
  ].filter(Boolean);
  if (parts.length === 1) parts.push('No contact details on file yet.');
  await reply(conv, parts.join('\n'));
  await replyMenu(conv);
}

async function menuActionShowHours(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const salon = conv.salon;
  const open = salon.openTime ?? '09:00';
  const close = salon.closeTime ?? '17:00';
  const isOpen = isWithinBusinessHours(salon);
  await reply(
    conv,
    `🕐 *Business hours*\n\nMon–Sat: ${open} – ${close}\n\nWe are currently ${isOpen ? '✅ open' : '🔴 closed'}.`,
  );
  await replyMenu(conv);
}

async function menuActionShowLocation(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const salon = conv.salon;
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
    const query = encodeURIComponent(`${salonDisplayName(salon)} ${address}`);
    lines.push('', `📌 Google Maps: https://maps.google.com/?q=${query}`);
  }

  await reply(conv, lines.join('\n'));
  await replyMenu(conv);
}

async function servicesForCategoryKey(salonId: string, key: ServiceCategoryKey) {
  const aliases = SERVICE_CATEGORY_ALIASES[key];
  const categories = await getTenantDb().serviceCategory.findMany({ where: { salonId } });
  const matchedCatIds = categories
    .filter((c) =>
      aliases.some(
        (a) => c.slug.toLowerCase().includes(a) || c.name.toLowerCase().includes(a),
      ),
    )
    .map((c) => c.id);

  return getTenantDb().service.findMany({
    where: {
      salonId,
      active: true,
      deletedAt: null,
      OR: [
        ...(matchedCatIds.length ? [{ categoryId: { in: matchedCatIds } }] : []),
        ...aliases.map((a) => ({ name: { contains: a, mode: 'insensitive' as const } })),
      ],
    },
    orderBy: { sortOrder: 'asc' },
  });
}

async function menuActionShowServiceCategory(
  conv: Conversation & { customer: Customer; salon: Salon },
  key: ServiceCategoryKey,
): Promise<void> {
  const services = await servicesForCategoryKey(conv.salonId, key);
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  if (services.length === 0) {
    await reply(
      conv,
      `No ${label.toLowerCase()} services listed yet.\n\nTry *Services › Prices* or *Appointments › Book*.\nReply BACK for menu.`,
    );
    return;
  }

  const lines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  await saveCtx(
    conv.id,
    { serviceFilterIds: services.map((s) => s.id), menuCategory: undefined },
    ConversationStep.PICK_SERVICE,
  );
  await reply(
    conv,
    [`*${label} services*`, ...lines, '', 'Reply with a number to book, or BACK.'].join('\n'),
  );
}

async function menuActionShowAllPrices(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const services = await getTenantDb().service.findMany({
    where: { salonId: conv.salonId, active: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
  if (services.length === 0) {
    await replyWithMenu(conv, 'No services listed yet.');
    return;
  }
  const lines = services.map((s) => `• ${sanitize(s.name)} — ${fmtMoney(s.priceCents)}`);
  await reply(
    conv,
    [`*Service prices*`, ...lines, '', 'Reply *Appointments › Book* from the main menu to schedule. Reply BACK.'].join('\n'),
  );
}

async function menuActionShowSpecials(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const meta =
    typeof conv.salon.metadata === 'object' && conv.salon.metadata
      ? (conv.salon.metadata as Record<string, unknown>)
      : {};
  const special = typeof meta.currentSpecial === 'string' ? meta.currentSpecial.trim() : '';
  const body = special
    ? `🌟 *Current specials*\n\n${special}\n\nReply BACK for menu.`
    : `No specials posted right now — check back soon!\n\nReply BACK for menu.`;
  await reply(conv, body);
}

async function menuActionShowTeam(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const team = await getTenantDb().staff.findMany({
    where: { salonId: conv.salonId, active: true, deletedAt: null, isBookable: true },
    orderBy: { sortOrder: 'asc' },
    take: 12,
    select: { name: true, specialties: true },
  });
  if (team.length === 0) {
    await reply(conv, 'Our team list is being updated. Reply BACK for menu.');
    return;
  }
  const lines = team.map((s, i) => {
    const spec = s.specialties.length ? ` — ${s.specialties.slice(0, 2).join(', ')}` : '';
    return `${i + 1}. ${sanitize(s.name)}${spec}`;
  });
  await reply(conv, [`*Our team*`, ...lines, '', 'Reply BACK for menu.'].join('\n'));
}

async function menuActionLeaveReview(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const settings = resolveGoogleReviewSettings(conv.salon.metadata);
  const reviewUrl = conv.salon.googleReviewUrl?.trim();
  if (settings.enabled && reviewUrl && isValidGoogleReviewUrl(reviewUrl)) {
    const { body } = await prepareGoogleReviewFollowUp({
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: null,
      googleReviewUrl: reviewUrl,
      incentiveEnabled: settings.incentiveEnabled,
      incentiveCents: settings.incentiveCents,
    });
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await reply(conv, body);
    return;
  }

  await saveCtx(
    conv.id,
    {
      ratingSubStep: 'stars',
      ratingStars: undefined,
      ratingComment: undefined,
      ratingNps: undefined,
      menuCategory: undefined,
    },
    ConversationStep.RATE_EXPERIENCE,
  );
  await reply(
    conv,
    '⭐ *Leave a review*\n\nHow would you rate your last visit?\nReply with a number:\n1 ⭐ — Poor\n2 ⭐⭐ — Below average\n3 ⭐⭐⭐ — Average\n4 ⭐⭐⭐⭐ — Good\n5 ⭐⭐⭐⭐⭐ — Excellent',
  );
}

async function handleSubMenuChoice(
  conv: Conversation & { customer: Customer; salon: Salon },
  category: MenuCategoryId,
  choice: number,
): Promise<void> {
  switch (category) {
    case 'appointments':
      if (choice === 1) return menuActionStartBooking(conv);
      if (choice === 2) return menuActionViewBookings(conv, 'view');
      if (choice === 3) return menuActionViewBookings(conv, 'reschedule');
      if (choice === 4) return menuActionViewBookings(conv, 'cancel');
      break;
    case 'services':
      if (choice === 1) return menuActionShowServiceCategory(conv, 'hair');
      if (choice === 2) return menuActionShowServiceCategory(conv, 'nails');
      if (choice === 3) return menuActionShowServiceCategory(conv, 'massage');
      if (choice === 4) return menuActionShowServiceCategory(conv, 'beauty');
      if (choice === 5) return menuActionShowAllPrices(conv);
      break;
    case 'rewards':
      if (choice === 1) return menuActionLoyaltyBalance(conv, false);
      if (choice === 2) return menuActionLoyaltyBalance(conv, true);
      if (choice === 3) return handleReferralMenuItem(conv, (body) => reply(conv, body));
      if (choice === 4) {
        await menuActionShowSpecials(conv);
        return;
      }
      break;
    case 'promotions':
      if (choice === 1) return menuActionShowSpecials(conv);
      if (choice === 2) return handleMembershipMenuItem(conv, (body) => reply(conv, body));
      if (choice === 3) {
        await reply(
          conv,
          `🎁 *Gift vouchers*\n\nContact ${salonDisplayName(conv.salon)} to purchase or redeem a gift voucher.${
            conv.salon.phoneDisplay ? `\nPhone: ${conv.salon.phoneDisplay}` : ''
          }\n\nReply BACK for menu.`,
        );
        return;
      }
      break;
    case 'about':
      if (choice === 1) return menuActionShowHours(conv);
      if (choice === 2) return menuActionShowLocation(conv);
      if (choice === 3) return menuActionShowContact(conv);
      if (choice === 4) return menuActionShowTeam(conv);
      break;
    case 'support':
      if (choice === 1) return menuActionShowFaqs(conv);
      if (choice === 2) return menuActionLeaveReview(conv);
      if (choice === 3) {
        await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.COMPLAINT);
        await reply(conv, 'Please describe the issue — our team will follow up shortly.');
        return;
      }
      if (choice === 4) {
        await saveCtx(conv.id, { otherQueryAnswered: false, ...PENDING_PROFILE_CLEAR }, ConversationStep.OTHER_QUERY);
        await reply(conv, 'You\'re through to reception — how can we help you today?');
        return;
      }
      break;
  }

  await reply(conv, 'Invalid choice. Reply BACK for main menu.');
}

async function handleMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'REFERRAL') {
    await handleReferralMenuItem(conv, (body) => reply(conv, body));
    return;
  }

  const activeCategory = ctx(conv).menuCategory;
  if (isMenuCategoryId(activeCategory)) {
    const subChoice = parseSubMenuChoice(trimmed);
    if (subChoice != null) {
      await handleSubMenuChoice(conv, activeCategory, subChoice);
      return;
    }
    await reply(conv, buildSubMenuText(activeCategory));
    return;
  }

  const mainCategory = parseMainMenuChoice(trimmed);
  if (mainCategory) {
    await saveCtx(conv.id, { menuCategory: mainCategory }, ConversationStep.MENU);
    await reply(conv, buildSubMenuText(mainCategory));
    return;
  }

  await replyMenu(conv);
}

/**
 * §6.1 — Preferred staff memory.
 * Returns the bookable staff for a service with the customer's preferred stylist
 * (the one they last explicitly booked) moved to index 0, deduped.
 * `preferredId` is non-null only when that stylist is still in the list
 * (i.e. still active, bookable, not deleted, and performs this service).
 * Both the menu rendering and the reply parsing use this same ordering, so
 * numbering stays consistent without any offset bookkeeping.
 */
async function getStaffListWithPreference(
  conv: Conversation & { customer: Customer; salon: Salon },
  serviceId: string,
): Promise<{ staffList: Staff[]; preferredId: string | null }> {
  const staffList = await getStaffForService(conv.salonId, serviceId);
  // Re-read from DB — conv.customer may be stale within a long conversation.
  const fresh = await getTenantDb().customer.findUnique({
    where: { id: conv.customerId },
    select: { preferredStaffId: true },
  });
  const preferredId = fresh?.preferredStaffId ?? null;
  if (!preferredId) return { staffList, preferredId: null };

  const idx = staffList.findIndex((s) => s.id === preferredId);
  if (idx < 0) return { staffList, preferredId: null }; // no longer offered — plain list
  if (idx === 0) return { staffList, preferredId };
  return {
    staffList: [staffList[idx]!, ...staffList.slice(0, idx), ...staffList.slice(idx + 1)],
    preferredId,
  };
}

function staffMenuLines(staffList: Staff[], preferredId: string | null): string[] {
  return [
    ...staffList.map(
      (s, i) => `${i + 1}. ${sanitize(s.name)}${s.id === preferredId ? ' (your last stylist)' : ''}`,
    ),
    `${staffList.length + 1}. Any available`,
  ];
}

async function handlePickService(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  if (c.addonPhase) {
    const handled = await handleAddonPhase(conv, text, {
      reply: (body) => reply(conv, body),
      saveContext: (patch) => saveCtx(conv.id, patch),
      continueToStaff: () => continueAfterServicePick(conv, (ctx(conv).selectedServiceId as string) ?? ''),
    });
    if (handled) return;
  }

  const n = parseInt(text, 10);
  const filterIds = ctx(conv).serviceFilterIds;
  const services = await getTenantDb().service.findMany({
    where: {
      salonId: conv.salonId,
      active: true,
      deletedAt: null,
      ...(Array.isArray(filterIds) && filterIds.length
        ? { id: { in: filterIds as string[] } }
        : {}),
    },
    orderBy: { sortOrder: 'asc' },
  });
  if (!Number.isFinite(n) || n < 1 || n > services.length) {
    const svcLines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
    await reply(conv, [`Invalid choice. Pick a number (1–${services.length}):`, ...svcLines, '', 'Reply BACK for menu.'].join('\n'));
    return;
  }
  const service = services[n - 1]!;

  await afterServiceSelected(conv, service.id, {
    reply: (body) => reply(conv, body),
    saveContext: (patch) => saveCtx(conv.id, patch),
    continueToStaff: () => continueAfterServicePick(conv, service.id),
  });
}

async function continueAfterServicePick(
  conv: Conversation & { customer: Customer; salon: Salon },
  serviceId: string,
) {
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });

  if (!conv.salon.botAllowStaffPick) {
    const { staffList: availableStaff } = await getStaffListWithPreference(conv, service.id);
    if (availableStaff.length === 0) {
      await replyWithMenu(conv, `No staff available for this service yet.`);
      await saveCtx(conv.id, {}, ConversationStep.MENU);
      return;
    }
    const assignedStaff = availableStaff[0]!;
    await saveCtx(
      conv.id,
      { selectedServiceId: service.id, selectedStaffId: assignedStaff.id, anyStaff: true },
      ConversationStep.PICK_DATE,
    );
    await handlePickDate(conv, '');
    return;
  }

  const { staffList: staff, preferredId } = await getStaffListWithPreference(conv, service.id);
  if (staff.length === 0) {
    await replyWithMenu(conv, `No staff available for this service yet.`);
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    return;
  }
  await saveCtx(
    conv.id,
    { selectedServiceId: service.id, staffOrderIds: staff.map((s) => s.id) },
    ConversationStep.PICK_STAFF,
  );
  const header = preferredId
    ? `Last time you booked with ${sanitize(staff[0]!.name)}. Reply 1 to book with them again.\n\nChoose stylist:`
    : 'Choose stylist:';
  await reply(conv, [header, ...staffMenuLines(staff, preferredId), '', 'BACK'].join('\n'));
}

async function handlePickStaff(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  if (!serviceId) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  // §6.1 — same preferred-first ordering as the menu the customer was shown,
  // so the number they reply with maps to the stylist they saw at that position.
  const { staffList, preferredId } = await getStaffListWithPreference(conv, service.id);
  // Guard: staff may have been deactivated since service step
  if (staffList.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(conv, `Sorry, no staff are currently available for this service. Please try another.`);
    return;
  }

  // Parse against the order the customer was actually shown; fall back to the
  // fresh list for conversations created before staffOrderIds existed.
  const savedOrder = c.staffOrderIds as string[] | undefined;
  const renderedIds =
    Array.isArray(savedOrder) && savedOrder.length > 0 ? savedOrder : staffList.map((s) => s.id);

  const rerenderMenu = async (prefix: string) => {
    await saveCtx(conv.id, { staffOrderIds: staffList.map((s) => s.id) });
    await reply(
      conv,
      [prefix, ...staffMenuLines(staffList, preferredId), '', 'Reply BACK for menu.'].join('\n'),
    );
  };

  const n = parseInt(text, 10);
  const anyIdx = renderedIds.length + 1;
  if (!Number.isFinite(n) || n < 1 || n > anyIdx) {
    await rerenderMenu(`Invalid choice. Pick a number (1–${staffList.length + 1}):`);
    return;
  }

  const isAny = n === anyIdx;
  let staffId: string;
  if (!isAny) {
    const chosen = staffList.find((s) => s.id === renderedIds[n - 1]);
    if (!chosen) {
      // That stylist became unavailable between menu render and reply —
      // never silently book whoever shifted into their slot number.
      await rerenderMenu('Sorry, that stylist just became unavailable. Here are the current options:');
      return;
    }
    staffId = chosen.id;
  } else {
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
  }

  const dates = await suggestBookingDates(conv.salonId, 14);
  if (dates.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(conv, `No available dates found. Please contact us directly to book.`);
    return;
  }

  await saveCtx(
    conv.id,
    { selectedStaffId: staffId, anyStaff: isAny, staffOrderIds: undefined },
    ConversationStep.PICK_DATE,
  );
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
    await replyMenu(conv);
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });

  const suggestions = await suggestBookingDates(conv.salonId, 14);

  const showDateList = async (prefix: string) => {
    if (suggestions.length === 0) {
      await saveCtx(conv.id, {}, ConversationStep.MENU);
      await replyWithMenu(conv, `No available dates found. Please contact us directly to book.`);
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
    await replyWithMenu(conv, `Sorry, this service is too long to fit within business hours. Please contact us directly.`);
    return;
  }
  if (slots.length === 0) {
    await showDateList(`No openings on ${localDateStr}. Please choose another date:`);
    return;
  }

  await saveCtx(conv.id, { localDateStr }, ConversationStep.PICK_SLOT);
  // Item 29: funnel progression tracking
  void getTenantDb().analyticsEvent.create({
    data: { salonId: conv.salonId, customerId: conv.customerId, type: 'funnel_pick_slot' },
  }).catch(() => {});
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
        // §6.1 — quick-pick staff is auto-assigned unless the customer named
        // them; anyStaff=true suppresses the preference write in handleConfirm.
        anyStaff: !quickPick.explicitStaff,
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
    await replyMenu(conv);
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
    await replyMenu(conv);
    return;
  }

  // EC-17: Re-check salon status in case it was suspended after the booking flow started
  const freshSalon = await getTenantDb().salon.findUniqueOrThrow({ where: { id: conv.salonId } });
  if (freshSalon.status === 'SUSPENDED' || freshSalon.status === 'CHURNED') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(conv, `Sorry, this salon is not currently accepting bookings. Please try again later.`);
    return;
  }

  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const start = new Date(slotIso);
  const addonIds = (c.selectedAddonIds as string[] | undefined) ?? [];
  const end = await computeAppointmentEnd({
    start,
    serviceDurationMin: service.durationMin,
    serviceBufferMin: service.bufferMin,
    staffBreakMin: staff.breakMin,
    addonServiceIds: addonIds,
    salonId: conv.salonId,
  });

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

  // EC-DUP: Prevent customer from booking two overlapping appointments
  {
    const reschedulingId = c.managingAppointmentId as string | undefined;
    const customerOverlap = await getTenantDb().appointment.findFirst({
      where: {
        customerId: conv.customerId,
        status: { notIn: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'] },
        start: { lt: end },
        end: { gt: start },
        ...(reschedulingId ? { NOT: { id: reschedulingId } } : {}),
      },
      include: { service: true },
    });
    if (customerOverlap) {
      const dt = DateTime.fromJSDate(new Date(customerOverlap.start)).setZone(conv.salon.timezone);
      await reply(
        conv,
        `You already have a booking at that time — ${sanitize(customerOverlap.service.name)} at ${dt.toFormat('HH:mm')}. Reply BACK to choose a different slot, or MANAGE to view your bookings.`,
      );
      return;
    }
  }

  const tx = getTenantDb();
  const redeem = await redeemForNextBookingTx(tx, {
    salonId: conv.salonId,
    customerId: conv.customerId,
    service,
  });

  let bookingTotalCents = service.priceCents;
  if (addonIds.length) {
    const addonServices = await tx.service.findMany({
      where: { id: { in: addonIds }, salonId: conv.salonId },
      select: { priceCents: true },
    });
    bookingTotalCents += addonServices.reduce((sum, a) => sum + a.priceCents, 0);
  }

  const needPay =
    conv.salon.botRequireDepositStep &&
    !redeem.redeemed &&
    ((service.depositCents ?? 0) > 0 || service.fullPay);

  const reviewCredit = await applyReviewCreditTx(tx, {
    customerId: conv.customerId,
    servicePriceCents: bookingTotalCents,
    atVisitOnly: needPay,
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
      addonServiceIds: (c.selectedAddonIds as string[] | undefined) ?? [],
      status: redeem.redeemed
        ? 'CONFIRMED'
        : (conv.salon.botRequireDepositStep && (service.depositCents || service.fullPay))
          ? 'HELD'
          : 'CONFIRMED',
      loyaltyRedeemed: redeem.redeemed,
      rescheduledFromId: reschedulingId ?? undefined,
      confirmedAt: (!conv.salon.botRequireDepositStep || (!service.depositCents && !service.fullPay)) ? new Date() : undefined,
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

  if (reviewCredit.appliedCents > 0) {
    await tx.analyticsEvent.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        appointmentId: appointment.id,
        type: 'review_credit_applied',
        payload: { appliedCents: reviewCredit.appliedCents },
      },
    });
  }

  // Track booking count for no-show risk scoring (best-effort — must not fail booking)
  const isFirstBooking = conv.customer.bookingCount === 0;
  try {
    await incrementCustomerBookingCount(conv.customerId, tx);
  } catch (err) {
    logger.warn({ err, customerId: conv.customerId }, 'booking_count_increment_failed');
  }

  // Item 16: Notify owner on new booking — best-effort, never blocks booking
  void (async () => {
    try {
      const ownerUser = await getTenantDb().staffUser.findFirst({
        where: { salonId: conv.salonId, role: 'OWNER', active: true },
        select: { phone: true },
        orderBy: { createdAt: 'asc' },
      });
      const ownerPhone = ownerUser?.phone?.trim();
      if (ownerPhone) {
        const dt = DateTime.fromJSDate(start).setZone(conv.salon.timezone);
        const customerName = conv.customer.displayName ?? conv.customer.firstName ?? conv.customer.waId;
        await sendWithFallback({
          salonId: conv.salonId,
          to: ownerPhone,
          body: [
            `📅 New booking (${appointment.id.slice(0, 8)})`,
            `Customer: ${sanitize(customerName)}`,
            `Service: ${sanitize(service.name)} with ${sanitize(staff.name)}`,
            dt.toFormat('cccc, dd LLL yyyy HH:mm'),
          ].join('\n'),
        });
      }
    } catch {
      // never let owner notification fail the booking flow
    }
  })();

  // §6.1 — remember the stylist for next booking, but only when the customer
  // explicitly chose them this booking. Skipped for:
  //  - "Any available" / auto-assigned staff (anyStaff)
  //  - reschedules, which silently reuse the original appointment's staff —
  //    if that staff was explicitly chosen the preference is already stored.
  // Awaited with try/catch rather than fire-and-forget: getTenantDb() is a
  // transaction client, so a dangling promise could outlive the transaction.
  // A failure here must never fail the booking itself.
  if (!c.anyStaff && !reschedulingId) {
    try {
      await tx.customer.update({
        where: { id: conv.customerId },
        data: { preferredStaffId: staff.id },
      });
    } catch (err) {
      logger.warn(
        { err, convId: conv.id, customerId: conv.customerId, staffId: staff.id },
        'preferred_staff_update_failed',
      );
    }
  }

  await saveCtx(conv.id, { pendingAppointmentId: appointment.id }, ConversationStep.IDLE);

  const bookingNotes = [redeem.note, reviewCredit.note].filter(Boolean).join('\n');
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
          bookingNotes ? `${bookingNotes}\n` : '',
          `Booking held (${appointment.id.slice(0, 8)}).`,
          `Please complete payment: ${sessionUrl}`,
          'We will confirm once payment succeeds.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      if (isFirstBooking) {
        await notifyPopiaRightsOnce(conv.id, () => reply(conv, buildPopiaRightsHint()));
      }
      await replyMenu(conv);
      return;
    }
    await replyWithMenu(
      conv,
      `Booking created — payment link unavailable. Staff will confirm manually.`,
    );
    if (isFirstBooking) {
      await notifyPopiaRightsOnce(conv.id, () => reply(conv, buildPopiaRightsHint()));
    }
    return;
  }

  await reply(
    conv,
    [
      bookingNotes ? `${bookingNotes}\n` : '',
      `Booked! Reference: ${appointment.id.slice(0, 8)}`,
      `${sanitize(service.name)} with ${sanitize(staff.name)}`,
      DateTime.fromJSDate(start).setZone(conv.salon.timezone).toFormat('cccc dd LLL yyyy HH:mm'),
    ]
      .filter(Boolean)
      .join('\n'),
  );
  void onBookingConfirmed({
    id: appointment.id,
    salonId: conv.salonId,
    start,
    status: appointment.status,
    salon: conv.salon,
  }).catch((err) => logger.warn({ err, appointmentId: appointment.id }, 'reminder_schedule_failed'));
  if (isFirstBooking) {
    await notifyPopiaRightsOnce(conv.id, () => reply(conv, buildPopiaRightsHint()));
  }
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
    await replyMenu(conv);
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
    await replyMenu(conv);
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

    const cancelCheck = await tryCancelWithRules({
      salon: conv.salon,
      appointment: appt,
    });
    if (!cancelCheck.ok) {
      // Record penalty attempted so the dashboard can surface it — tenant context is live here
      if (cancelCheck.penaltyApplies) {
        void getTenantDb().appointment.update({
          where: { id: appt.id },
          data: { cancellationPenaltyApplied: true },
        }).catch(() => {});
      }
      await reply(conv, cancelCheck.message);
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

    await afterAppointmentCancelled({
      salonId: conv.salonId,
      salon: conv.salon,
      serviceId: appt.serviceId,
      staffId: appt.staffId,
      start: appt.start,
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
    await replyWithMenu(conv, `Cancelled ${sanitize(appt.service.name)} with ${sanitize(appt.staff.name)}.`);
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

    const { checkCancellationAllowed } = await import('./cancellationRules.js');
    const rescheduleCheck = checkCancellationAllowed({
      salon: conv.salon,
      appointment: appt,
      action: 'reschedule',
    });
    if (!rescheduleCheck.allowed) {
      await reply(conv, rescheduleCheck.message);
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
  await replyWithMenu(conv, `Thanks — we logged your complaint and will respond shortly.`);
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
    await saveCtx(conv.id, { otherQueryAnswered: undefined, otherQueryText: undefined }, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }

  // If we already gave an answer and are waiting for YES/NO
  if (answered) {
    const upper = text.toUpperCase();
    if (upper === 'YES' || upper === 'Y') {
      await saveCtx(conv.id, { otherQueryAnswered: undefined, otherQueryText: undefined }, ConversationStep.MENU);
      await replyWithMenu(conv, `Great! 😊 Anything else I can help with?`);
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
    // §4.4/§5 — negative sentiment detected: escalate immediately, skip FAQ loop
    if (aiResult.negativeSentiment) {
      await escalateNegativeSentiment(conv, text);
      return;
    }
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
    await replyMenu(conv);
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
    await replyMenu(conv);
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
    await replyMenu(conv);
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
    await replyWithMenu(conv, `🎊 To use your free cut, simply book your next appointment (option 1) and it will be applied automatically!`);
    return;
  }
  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await replyMenu(conv);
}

// ─── Branch Selection ──────────────────────────────────────────────────
async function handlePickBranch(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (text.toUpperCase() === 'BACK') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyMenu(conv);
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
    await replyWithMenu(conv, `No services configured yet. Please contact the salon.`);
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
    await replyMenu(conv);
    return;
  }

  if (!appointmentId) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, 'Something went wrong. Let me take you back to the menu.');
    await replyMenu(conv);
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

  // Persist the rating score on the appointment for easy querying.
  // Use updateMany so no error is thrown if the appointment was deleted between
  // the CSAT request being sent and the customer replying.
  if (appointmentId) {
    await getTenantDb().appointment.updateMany({
      where: { id: appointmentId },
      data: { csatScore: rating },
    });
  }

  const reviewSettings = resolveGoogleReviewSettings(conv.salon.metadata);
  let reviewRequestSentAt: Date | null = null;
  if (appointmentId) {
    const appt = await getTenantDb().appointment.findUnique({
      where: { id: appointmentId },
      select: { reviewRequestSentAt: true },
    });
    reviewRequestSentAt = appt?.reviewRequestSentAt ?? null;
  }

  const messages: Record<number, string> = {
    1: "We're sorry to hear that. We'll work to improve. Thank you for the feedback.",
    2: "Thank you for letting us know. We'll do better next time.",
    3: 'Thanks for the feedback! We appreciate it.',
    4: 'Great to hear! Thank you for your feedback.',
    5: 'Wonderful! So glad you had a great experience! 🌟',
  };

  await reply(conv, messages[rating] ?? 'Thank you!');

  if (conv.salon.googleReviewUrl) {
    await sendGoogleReviewFollowUp({
      salonId: conv.salon.id,
      customerId: conv.customerId,
      appointmentId: appointmentId ?? null,
      googleReviewUrl: conv.salon.googleReviewUrl,
      googleReviewEnabled: reviewSettings.enabled,
      incentiveEnabled: reviewSettings.incentiveEnabled,
      incentiveCents: reviewSettings.incentiveCents,
      marketingConsentStatus: conv.customer.marketingConsentStatus,
      reviewRequestSentAt,
      reply: (body) => reply(conv, body),
    });
  }

  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await replyMenu(conv);
}

async function handleReviewedKeyword(
  conv: Conversation & { customer: Customer; salon: Salon },
  token?: string,
): Promise<void> {
  const result = await claimReviewIncentive({
    salonId: conv.salon.id,
    customerId: conv.customerId,
    token,
  });

  if (!result.ok) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(conv, reviewedClaimErrorMessage(result.reason));
    return;
  }

  const reward = formatReviewReward(result.rewardCents);
  if (result.alreadyClaimed) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(
      conv,
      `You've already claimed your ${reward} review reward — it's waiting on your next booking! 💈`,
    );
    return;
  }

  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await replyWithMenu(
    conv,
    `Thanks for leaving a review! 🎉\n\nYour ${reward} reward is saved and will come off your next booking automatically.\n\nReply 1 anytime to book.`,
  );
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

function buildStampBar(earned: number, total: number): string {
  const filled = Math.min(earned, total);
  const empty = total - filled;
  return `[${'★'.repeat(filled)}${'☆'.repeat(empty)}] ${filled}/${total}`;
}
