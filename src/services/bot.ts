import {
  ConversationStep,
  MessageDirection,
  Prisma,
  type AppointmentStatus,
  type Conversation,
  type Customer,
  type Salon,
  type Service,
  type Staff,
} from '@prisma/client';
import { getTenantDb, tryDbSavepoint, withTenantContext } from '../lib/db/tenantSession.js';
import { prisma } from '../lib/prisma.js';
import {
  assertTenantActive,
  resolveTenantForInbound,
  type ResolvedTenant,
} from '../lib/tenant.js';
import { recordCampaignReply } from './campaignMetrics.js';
import { sendWithFallback } from './channelRouter.js';
import { buildMainMenuInteractive } from './mainMenuInteractive.js';
import { emitMessageReceived, emitBotEscalation } from '../lib/eventBus.js';
import { normalizeWaId } from '../lib/phone.js';
import { isConversationWakeMessage, shouldResetConversationOnWake, staffHandoffExpired } from '../lib/conversationWake.js';
import {
  getBotRequestStore,
  queuePendingWelcomeJourney,
  runWithBotRequest,
  takePendingWelcomeJourney,
  type PendingOutbound,
} from '../lib/botRequestContext.js';
import { checkBotRateLimits } from '../lib/botRateLimit.js';
import { BOT_DEBUG, debugMsg } from '../lib/botDebug.js';
import { logger } from '../lib/logger.js';
import { redis, touchBotSession } from '../lib/redis.js';
import { logMessageLog } from './messageLog.js';
import { handleFaq as runFaqHandler } from '../bot/faqHandler.js';
import { DateTime } from 'luxon';
import { getAvailableSlots, getNextAvailableSlots, getStaffForService, suggestBookingDates, validateSlotAvailable } from './slots.js';
import { parseNaturalDateTime, isDateMenuNumber } from './naturalDateTime.js';
import {
  ensureLoyaltyProgram,
  getStampBalance,
  redeemForNextBookingTx,
} from './loyalty.js';
import { createPaymentCheckoutSession, resolvePostConfirmPayment, salonRequiresPostConfirmPayment } from './payments.js';
import { startNextChainedBooking } from './chainedBooking.js';
import {
  matchQuickPick,
  matchServiceInText,
  tryAiAssist,
  tryDirectDateTimeBooking,
  isBrowseServicesRequest,
  type QuickPickOption,
} from './botAssistant.js';
import { notifyAppointmentBookedLater, notifyAppointmentChangedLater } from './rosterSync.js';
import { isBackCommand, isBackToMainMenuCommand, isMainMenuCommand, isContinueCommand, isWriteReviewCommand } from '../lib/botNavigation.js';
import { scheduleConversationActivity, cancelConversationInactivity } from '../lib/inngest/functions/conversationInactivity.js';
import { shouldScheduleInactivityReminder } from '../lib/inactivityReminder.js';
import { getTimeGreeting, getOccasionLine, isBirthdayToday, pickCompliment } from './personalization.js';
import {
  buildMainMenuText,
  buildSubMenuText,
  getSubMenuItemCount,
  isValidSubMenuChoice,
  normalizeMenuCategoryId,
  parseMainMenuSelection,
  parseSubMenuChoice,
  parseFreeTextSupportIntent,
  salonDisplayName,
  type MenuCategoryId,
  type LegacyMenuCategoryId,
} from '../lib/hierarchicalMenu.js';
import { getIndustryTemplate } from '../lib/industryTemplates.js';
import { recordBotPlatformAlert } from './platformInbox.js';
import { emitPlatformEvent } from './platformEvents.js';
import {
  afterServiceSelected,
  handleReferralMenuItem,
  handleMembershipMenuItem,
  startMembershipPlanCheckout,
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
  deliverGoogleReviewRequest,
  isValidGoogleReviewUrl,
} from './reviewIncentive.js';
import {
  applyMarketingConsentChoice,
  buildCombinedConsentMessage,
  buildConsentAcceptedMessage,
  buildConsentDeclinedMessage,
  buildConsentStopMessage,
  flushPendingConsentAudits,
  isGlobalMarketingOptIn,
  isGlobalMarketingOptOut,
  marketingConsentGatePending,
  needsMarketingConsentPrompt,
  parseCombinedConsentReply,
} from './marketingConsent.js';
import {
  BIRTHDAY_MSG_LOOKBACK_DAYS,
  BIRTHDAY_TREAT_TAG,
  isWithinBirthdayWindow,
} from './outboundCampaigns.js';
import {
  buildServicesSubMenuText,
  loadServiceSubMenuOptions,
  loadServicesForSubMenuOption,
  SERVICE_SUBMENU_PRICES,
} from './serviceMenuCatalog.js';
import {
  buildBookingRatingInteractive,
  buildNpsRatingPromptBody,
  buildStarRatingPromptBody,
  buildBranchPickerInteractive,
  buildCategoryServiceListInteractive,
  buildCombinedConsentInteractive,
  buildCategorySubMenuInteractive,
  buildCombinedSlotPickerInteractive,
  buildConfirmBookingInteractive,
  buildConfirmCancelInteractive,
  buildDatePickerInteractive,
  buildBookingPopiaInteractive,
  buildFaqListInteractive,
  buildNpsRatingInteractive,
  buildSkipOnlyInteractive,
  buildStarRatingInteractive,
  buildTeamListInteractive,
  buildManageBookingActionsInteractive,
  buildManageBookingListInteractive,
  buildQuickPickInteractive,
  buildServiceCategoryPickerInteractive,
  buildServicePickerInteractive,
  buildServicesSubMenuInteractive,
  buildSlotPickerInteractive,
  buildStaffPickerInteractive,
  buildPaymentCashOptionInteractive,
} from './botInteractiveMenus.js';
import type { InteractiveMessage } from '../lib/integrations/messaging/types.js';
import {
  buildCashPaymentNudgeBody,
  buildPaymentCheckoutCta,
  buildPaymentMethodFallbackText,
  buildSecurePaymentPromptBody,
} from '../lib/paymentPromptCopy.js';
import {
  buildCategorizedPriceLines,
  loadSalonServiceCatalog,
  filterBookableCatalogServices,
} from './serviceCatalogDisplay.js';
import { formatCentsZar } from '../lib/formatPrice.js';
import {
  cancelGoogleReviewForAppointment,
} from '../lib/googleReviewSchedule.js';
import { incrementCustomerBookingCount } from './noShowRisk.js';
import { recordSupportTicketMessage, tryRecordSupportTicket } from './supportTickets.js';
import {
  deleteCustomerData,
  exportCustomerData,
  formatMyDataAccessSummary,
  isDeletedCustomer,
  isPopiaDeleteCommand,
  isPopiaMyDataCommand,
} from './compliance.js';

export type BotContext = Record<string, unknown> & {
  selectedServiceId?: string;
  selectedStaffId?: string;
  selectedBranchId?: string;
  branchOptions?: string[];
  localDateStr?: string;
  slotStartIso?: string;
  pendingAppointmentId?: string;
  /** Amount due for the post-confirm payment step, shown while the customer picks a payment method. */
  pendingPaymentAmountCents?: number;
  /** Carried through CHOOSE_PAYMENT_METHOD so the first-booking POPIA hint still fires once. */
  pendingPaymentIsFirstBooking?: boolean;
  /** Customer chose cash — waiting for CASH confirm or switch to PayFast (1). */
  awaitingCashConfirm?: boolean;
  /** PayFast checkout URL created at booking confirm — reused when customer replies 1. */
  pendingPaymentCheckoutUrl?: string;
  /** Group booking headcount set at CONFIRM_BOOKING; defaults to 1 (no group). */
  partySize?: number;
  rescheduleAppointmentId?: string;
  csatAppointmentId?: string;
  anyStaff?: boolean;
  manageList?: string[];
  /** Past appointment ids shown alongside manageList during a 'view' bookings listing — lets REDO/CHOOSE AGAIN reference them by number. */
  managePastList?: string[];
  managingAppointmentId?: string;
  /** Consecutive unhandled-error count — triggers staff escalation at 2 */
  errorCount?: number;
  /** True when a human agent explicitly took over via the dashboard (keeps bot silent). */
  handoffByStaff?: boolean;
  /** Set when the bot auto-escalated due to negative sentiment — prevents re-escalation loop until staff resolves. */
  negativeSentimentEscalated?: boolean;
  /** AI-suggested quick book slots (A/B/C). */
  quickPickOptions?: QuickPickOption[];
  /** Flattened date+time options shown by the combined PICK_DATE picker — one tap books both. */
  flatSlotOptions?: { startIso: string; localDateStr: string }[];
  /** True once the customer tapped "More dates" and is now browsing the date-only list. */
  awaitingDateList?: boolean;
  /**
   * Staff ids in the exact order last rendered in the PICK_STAFF menu.
   * Replies are parsed against this snapshot so the number the customer saw
   * always maps to the stylist they meant, even if the roster (or their
   * preferred stylist) changes between menu render and reply.
   */
  staffOrderIds?: string[];
  /** Hierarchical main-menu sub-section (my_appointments, services, …). */
  menuCategory?: MenuCategoryId | LegacyMenuCategoryId;
  /** VIP membership plan ids shown while awaiting a numbered reply. */
  membershipPlanOptions?: string[];
  /** Category ids shown during PICK_SERVICE_CATEGORY step. */
  serviceCategoryOptions?: string[];
  /** When set, PICK_SERVICE only shows these service ids (from Services submenu or chosen category). */
  serviceFilterIds?: string[];
  /** Current pagination page (0-based) for PICK_SERVICE long lists. */
  servicePage?: number;
  /** Hint for manage-booking submenu (view / reschedule / cancel). */
  manageBookingHint?: 'view' | 'reschedule' | 'cancel';
  pendingManageIdx?: number;
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
  /** Appointment ID pending customer confirmation before cancel fires. */
  pendingCancelApptId?: string;
  /** Legacy addon upsell phase flag — cleared when stale. */
  addonPhase?: boolean;
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

const BOOKING_CTX_CLEAR: Partial<BotContext> = {
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
  quickPickOptions: undefined,
  manageList: undefined,
  managePastList: undefined,
  addonPhase: undefined,
  ...PENDING_PROFILE_CLEAR,
};

function isProfileIncomplete(customer: Customer): boolean {
  // Only firstName is required. email and dateOfBirth are optional — requiring them
  // caused the POPIA gate to re-trigger every session for customers who skipped those fields.
  return !customer.firstName;
}

/** Max time slots shown in one WhatsApp list (was 8 — too restrictive on busy days). */
const MAX_SLOT_OPTIONS = 12;

function formatSlotMenuLines(
  slots: { start: Date }[],
  timezone: string,
): string[] {
  return slots.slice(0, MAX_SLOT_OPTIONS).map((s, i) => {
    const dt = DateTime.fromJSDate(s.start).setZone(timezone);
    return `${i + 1}. ${dt.toFormat('ccc HH:mm')}`;
  });
}

function visibleSlotCount(slotCount: number): number {
  return Math.min(slotCount, MAX_SLOT_OPTIONS);
}

function formatFlatSlotMenuLines(
  slots: { start: Date; localDateStr: string }[],
  timezone: string,
  hasMore: boolean,
): string[] {
  const today = DateTime.now().setZone(timezone).startOf('day');
  const lines = slots.slice(0, 9).map((s, i) => {
    const dt = DateTime.fromJSDate(s.start).setZone(timezone);
    const dayDiff = Math.round(dt.startOf('day').diff(today, 'days').days);
    const dayLabel = dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : dt.toFormat('ccc dd LLL');
    return `${i + 1}. ${dayLabel} ${dt.toFormat('HH:mm')}`;
  });
  if (hasMore) {
    lines.push(`${lines.length + 1}. More dates`);
  }
  return lines;
}

const WHATSAPP_MENU_STEPS: ConversationStep[] = [
  ConversationStep.GREETING,
  ConversationStep.MENU,
  ConversationStep.IDLE,
];

const WHATSAPP_BOOKING_STEPS: ConversationStep[] = [
  ConversationStep.COLLECT_FIRST_NAME,
  ConversationStep.COLLECT_EMAIL,
  ConversationStep.COLLECT_DATE_OF_BIRTH,
  ConversationStep.BOOKING_POPIA_CONSENT,
  ConversationStep.PICK_BRANCH,
  ConversationStep.PICK_SERVICE_CATEGORY,
  ConversationStep.PICK_SERVICE,
  ConversationStep.PICK_STAFF,
  ConversationStep.PICK_DATE,
  ConversationStep.PICK_SLOT,
  ConversationStep.CONFIRM_BOOKING,
];

async function loadActiveServicesForBooking(salonId: string) {
  const catalog = await tryDbSavepoint(
    'services_catalog',
    () => loadSalonServiceCatalog(salonId).then(filterBookableCatalogServices),
    null,
  );
  if (catalog) return catalog;

  return tryDbSavepoint(
    'services_catalog_fallback',
    () =>
      getTenantDb().service.findMany({
        where: { salonId, active: true },
        orderBy: { sortOrder: 'asc' },
        include: { category: true },
      }).then(filterBookableCatalogServices),
    [],
  );
}

/** Live service list for picker — drops stale filter ids when dashboard catalog changed mid-flow. */
async function resolveServicesForPicker(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<{ services: Awaited<ReturnType<typeof loadActiveServicesForBooking>>; clearedStaleFilter: boolean }> {
  const filterIds = ctx(conv).serviceFilterIds;
  const all = await loadActiveServicesForBooking(conv.salonId);
  if (!Array.isArray(filterIds) || filterIds.length === 0) {
    return { services: all, clearedStaleFilter: false };
  }
  const filtered = all.filter((s) => (filterIds as string[]).includes(s.id));
  if (filtered.length > 0) {
    return { services: filtered, clearedStaleFilter: false };
  }
  await saveCtx(conv.id, { serviceFilterIds: undefined });
  syncConvContext(conv, { serviceFilterIds: undefined });
  return { services: all, clearedStaleFilter: true };
}

const APPOINTMENT_DATE_HINT =
  '💬 Or type your date & time — e.g. *Saturday 15:00*, *25/06 14:30*, or *next Friday at 2pm*.';
const APPOINTMENT_SLOT_HINT =
  '💬 Or type a time — e.g. *14:00* or *2pm* — or a full date & time for another day.';
const APPOINTMENT_DATE_MISPARSE =
  "Hmm, I couldn't quite place that. Try e.g. *Saturday 15:00*, *25/06 14:30*, or *next Friday at 2pm*, or pick a number below:";

/** WhatsApp list body — title plus type-to-book hint (shown above the tap button). */
function bookingInteractiveBody(title: string, hint = APPOINTMENT_DATE_HINT): string {
  return `${title}\n\n${hint}`;
}

function isoDateFromParts(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

/** YYYY-MM-DD → DD/MM/YYYY for customer-facing prompts. */
function formatDisplayLocalDate(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Parse DD/MM/YYYY or YYYY-MM-DD into YYYY-MM-DD for slot lookup. */
function parseAppointmentLocalDate(text: string): string | null {
  const t = text.trim();
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return isoDateFromParts(
      parseInt(slash[3]!, 10),
      parseInt(slash[2]!, 10),
      parseInt(slash[1]!, 10),
    );
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return isoDateFromParts(
      parseInt(iso[1]!, 10),
      parseInt(iso[2]!, 10),
      parseInt(iso[3]!, 10),
    );
  }
  return null;
}

function formatDateMenuLines(isoDates: string[]): string[] {
  return isoDates.map((d, i) => `${i + 1}. ${formatDisplayLocalDate(d)}`);
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
const RATE_SALON_KEY_PREFIX = 'ratelimit:salon:';

async function rateLimitOrReject(waId: string, salonId: string): Promise<boolean> {
  try {
    const waKey = `${RATE_KEY_PREFIX}${waId}`;
    const salonKey = `${RATE_SALON_KEY_PREFIX}${salonId}`;
    const waN = await redis.incr(waKey);
    if (waN === 1) await redis.pexpire(waKey, 60_000);
    const salonN = await redis.incr(salonKey);
    if (salonN === 1) await redis.pexpire(salonKey, 60_000);
    return checkBotRateLimits(waN, salonN);
  } catch {
    return true; // Allow through if Redis is unavailable
  }
}

function ctx(conv: Conversation): BotContext {
  return (conv.context ?? {}) as BotContext;
}

/** Slot queries scoped to this customer — excludes times they already booked elsewhere. */
function customerSlotScope(conv: Conversation) {
  const c = ctx(conv);
  return {
    customerId: conv.customerId,
    excludeAppointmentId: c.managingAppointmentId as string | undefined,
  };
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

async function saveCtx(
  convId: string,
  patch: Partial<BotContext>,
  step?: ConversationStep,
  baseContext?: BotContext,
) {
  const base = baseContext ?? ctx(
    await getTenantDb().conversation.findUniqueOrThrow({ where: { id: convId } }),
  );
  const next = applyContextPatch(base, patch);
  await getTenantDb().conversation.update({
    where: { id: convId },
    data: {
      context: next as object,
      ...(step ? { step } : {}),
      ...(step === ConversationStep.HANDOFF ? { resolvedAt: null } : {}),
    },
  });
}

function syncConvContext(
  conv: Conversation,
  patch: Partial<BotContext>,
  step?: ConversationStep,
): void {
  conv.context = applyContextPatch(ctx(conv), patch) as object;
  if (step) conv.step = step;
}

function salonInteractive(
  _salon: Salon,
  interactive: InteractiveMessage | null | undefined,
): InteractiveMessage | undefined {
  if (!interactive) return undefined;
  return interactive;
}

async function replyMaybeInteractive(
  conv: Conversation & { customer: Customer; salon: Salon },
  body: string,
  interactive?: InteractiveMessage | null,
): Promise<void> {
  const msg = salonInteractive(conv.salon, interactive);
  await reply(conv, body, null, msg ? { interactive: msg } : undefined);
}

async function recordOutboundMessage(
  msg: PendingOutbound,
  providerSid: string,
): Promise<void> {
  await getTenantDb().message.create({
    data: {
      conversationId: msg.convId,
      customerId: msg.customerId,
      direction: MessageDirection.OUTBOUND,
      body: msg.body,
      providerSid,
    },
  });
  await getTenantDb().conversation.update({
    where: { id: msg.convId },
    data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
  });
}

async function deliverOutboundNow(msg: PendingOutbound): Promise<void> {
  try {
    const { result } = await sendWithFallback({
      salonId: msg.salonId,
      to: msg.waId,
      body: msg.body,
      interactive: msg.interactive,
    });
    const providerSid = result.providerMessageId ?? null;
    if (!providerSid) {
      logger.error({ to: msg.waId, salonId: msg.salonId }, 'reply_send_no_provider_id');
      return;
    }
    await withTenantContext(msg.salonId, async () => {
      await recordOutboundMessage(msg, providerSid);
    });
  } catch (err) {
    logger.error({ err, to: msg.waId, salonId: msg.salonId }, 'reply_send_failed');
    void recordBotPlatformAlert({
      salonId: msg.salonId,
      title: 'WhatsApp reply failed',
      body: err instanceof Error ? err.message : String(err),
      metadata: { waId: msg.waId, event: 'reply_send_failed' },
    }).catch(() => {});
  }
}

async function flushPendingOutbound(): Promise<void> {
  const store = getBotRequestStore();
  if (!store?.pendingOutbound.length) return;
  const queue = [...store.pendingOutbound];
  store.pendingOutbound.length = 0;
  for (const msg of queue) {
    await deliverOutboundNow(msg);
  }
}

function hasPendingOutboundForConv(convId: string): boolean {
  return getBotRequestStore()?.pendingOutbound.some((m) => m.convId === convId) ?? false;
}

async function reply(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
  outboundSid?: string | null,
  sendOptions?: { interactive?: InteractiveMessage },
): Promise<void> {
  const deferQueue = getBotRequestStore()?.pendingOutbound;
  if (!outboundSid && deferQueue) {
    deferQueue.push({
      salonId: conv.salonId,
      convId: conv.id,
      customerId: conv.customerId,
      waId: conv.customer.waId,
      body: text,
      interactive: sendOptions?.interactive,
    });
    return;
  }

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
  await recordOutboundMessage(
    {
      salonId: conv.salonId,
      convId: conv.id,
      customerId: conv.customerId,
      waId: conv.customer.waId,
      body: text,
      interactive: sendOptions?.interactive,
    },
    providerSid,
  );
}

async function startMarketingConsentGate(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  await saveCtx(conv.id, {}, ConversationStep.MARKETING_CONSENT);
  syncConvContext(conv, {}, ConversationStep.MARKETING_CONSENT);
  const store = getBotRequestStore();
  if (store) store.pendingWelcomeJourney = null;
  const body = buildCombinedConsentMessage(salonDisplayName(conv.salon));
  await replyMaybeInteractive(
    conv,
    body,
    buildCombinedConsentInteractive(conv.salon, body),
  );
}

/** Shared booking summary + confirm prompt. Body is also used as the Twilio
 *  interactive card text (plain `body` is not shown when buttons are sent). */
function buildConfirmBookingBody(
  conv: Conversation & { customer: Customer; salon: Salon },
  serviceName: string,
  staffName: string,
  dt: DateTime,
  partySize?: number,
  options?: { priceCents?: number; endDt?: DateTime },
): string {
  const firstName = conv.customer.firstName?.trim();
  const opener = firstName
    ? `${pickCompliment()} *${sanitize(firstName)}*, please check your booking:`
    : `${pickCompliment()} Please check your booking:`;
  const endLine = options?.endDt
    ? `🕐 ${dt.toFormat('HH:mm')} – ${options.endDt.toFormat('HH:mm')}`
    : `🕐 ${dt.toFormat('HH:mm')}`;
  const priceLine = options?.priceCents != null ? `💰 ${fmtMoney(options.priceCents)}` : null;
  const confirmFooter = salonRequiresPostConfirmPayment(conv.salon)
    ? "Tap *Yes, confirm* below to book — we'll send your PayFast payment link next."
    : 'Tap *Yes, confirm* below to complete your booking.';
  const groupLine = partySize && partySize > 1 ? `👥 Party size: ${partySize}` : null;
  const groupHint = !groupLine ? '_Booking for a group? Reply the number of people instead of YES (e.g. 3)._' : null;
  return [
    opener,
    '',
    `📋 *${sanitize(serviceName)}*`,
    `👤 with ${sanitize(staffName)}`,
    `📅 ${dt.toFormat('cccc, d MMMM yyyy')}`,
    endLine,
    ...(priceLine ? [priceLine] : []),
    ...(groupLine ? [groupLine] : []),
    '',
    confirmFooter,
    ...(groupHint ? ['', groupHint] : []),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

async function buildConfirmBookingBodyForService(
  conv: Conversation & { customer: Customer; salon: Salon },
  service: { name: string; priceCents: number; durationMin: number; bufferMin: number },
  staff: { name: string; breakMin: number },
  slotStart: Date,
  partySize?: number,
): Promise<string> {
  const dt = DateTime.fromJSDate(slotStart).setZone(conv.salon.timezone);
  const end = await computeAppointmentEnd({
    start: slotStart,
    serviceDurationMin: service.durationMin,
    serviceBufferMin: service.bufferMin,
    staffBreakMin: staff.breakMin,
    addonServiceIds: (ctx(conv).selectedAddonIds as string[] | undefined) ?? [],
    salonId: conv.salonId,
  });
  const endDt = DateTime.fromJSDate(end).setZone(conv.salon.timezone);
  return buildConfirmBookingBody(conv, service.name, staff.name, dt, partySize, {
    priceCents: service.priceCents,
    endDt,
  });
}

async function sendConfirmBookingPrompt(
  conv: Conversation & { customer: Customer; salon: Salon },
  confirmBody: string,
): Promise<void> {
  await replyMaybeInteractive(conv, confirmBody, buildConfirmBookingInteractive(conv.salon, confirmBody));
}

function shouldPromptMarketingConsentBeforeMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
): boolean {
  return marketingConsentGatePending(conv.salon, conv.customer.marketingConsentStatus);
}

async function customerHasSucceededPayments(customerId: string, salonId: string): Promise<boolean> {
  const count = await getTenantDb().payment.count({
    where: { customerId, salonId, status: 'SUCCEEDED' },
  });
  return count > 0;
}

async function sendReceptionistGreeting(conv: Conversation & { customer: Customer; salon: Salon }) {
  const salon = conv.salon;
  const salonName = salon.tradingName?.trim() || salon.name;
  const customer = conv.customer;
  const localNow = DateTime.now().setZone(salon.timezone);
  const timeGreeting = getTimeGreeting(localNow);
  const occasionLine = getOccasionLine(localNow);

  if (isProfileIncomplete(customer)) {
    await saveCtx(conv.id, { menuCategory: undefined }, ConversationStep.MENU);
    syncConvContext(conv, { menuCategory: undefined }, ConversationStep.MENU);
    let interactive: ReturnType<typeof buildMainMenuInteractive> | undefined;
    try {
      interactive = buildMainMenuInteractive(conv.salon);
    } catch (err) {
      logger.warn({ err, convId: conv.id }, 'main_menu_interactive_build_failed');
    }
    await reply(
      conv,
      [
        `${timeGreeting}! 👋 Welcome to *${salonName}* — we're happy to have you!`,
        ...(occasionLine ? [occasionLine] : []),
        '',
        `Let's get you set up.`,
      ].join('\n'),
      null,
      interactive ? { interactive } : undefined,
    );
    return;
  }

  // Returning customer — personalise only after at least one successful payment.
  const firstName = customer.firstName?.trim() ?? 'there';
  const birthdayToday = isBirthdayToday(localNow, customer.dateOfBirth);
  const hasPaymentHistory = await customerHasSucceededPayments(customer.id, salon.id);
  let usualLine = 'What can we do for you today?';
  if (hasPaymentHistory) {
    const lastAppt = await getTenantDb().appointment.findFirst({
      where: {
        customerId: customer.id,
        salonId: salon.id,
        status: { in: ['CONFIRMED', 'CONFIRMED_PAID', 'COMPLETED'] },
        start: { lt: new Date() },
      },
      orderBy: { start: 'desc' },
      include: { service: { select: { name: true } } },
    });
    if (lastAppt?.service?.name) {
      usualLine = `The usual *${sanitize(lastAppt.service.name)}*? Or something different today?`;
    }
  }

  await saveCtx(conv.id, { menuCategory: undefined }, ConversationStep.MENU);
  syncConvContext(conv, { menuCategory: undefined }, ConversationStep.MENU);
  let interactive: ReturnType<typeof buildMainMenuInteractive> | undefined;
  try {
    interactive = buildMainMenuInteractive(conv.salon);
  } catch (err) {
    logger.warn({ err, convId: conv.id }, 'main_menu_interactive_build_failed');
  }
  const greetingLine = birthdayToday
    ? `🎉 Happy birthday, *${sanitize(firstName)}*! Hope it's a great one.`
    : `${timeGreeting}! Welcome back, *${sanitize(firstName)}* 😊`;
  await reply(
    conv,
    [
      greetingLine,
      ...(!birthdayToday && occasionLine ? [occasionLine] : []),
      '',
      `Great to see you again. ${usualLine}`,
    ].join('\n'),
    null,
    interactive ? { interactive } : undefined,
  );
}

async function recoverBookingFlowToMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
  userMessage: string,
): Promise<void> {
  syncConvContext(conv, BOOKING_CTX_CLEAR, ConversationStep.MENU);
  await tryDbSavepoint('booking_flow_recovery', async () => {
    await saveCtx(conv.id, BOOKING_CTX_CLEAR, ConversationStep.MENU, ctx(conv));
  }, undefined);
  await reply(conv, userMessage);
  const body = mainMenu(conv.salon);
  let interactive: ReturnType<typeof buildMainMenuInteractive> | undefined;
  try {
    interactive = buildMainMenuInteractive(conv.salon);
  } catch (err) {
    logger.warn({ err, convId: conv.id }, 'main_menu_interactive_build_failed');
  }
  await reply(conv, body, null, interactive ? { interactive } : undefined);
}

async function replyMenu(conv: Conversation & { customer: Customer; salon: Salon }) {
  await saveCtx(conv.id, { menuCategory: undefined }, ConversationStep.MENU);
  syncConvContext(conv, { menuCategory: undefined }, ConversationStep.MENU);
  const body = mainMenu(conv.salon);
  let interactive: ReturnType<typeof buildMainMenuInteractive> | undefined;
  try {
    interactive = buildMainMenuInteractive(conv.salon);
  } catch (err) {
    logger.warn({ err, convId: conv.id }, 'main_menu_interactive_build_failed');
  }
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
  if (salon.afterHoursMessage?.trim()) return salon.afterHoursMessage.trim();
  const open = salon.openTime ?? '09:00';
  const close = salon.closeTime ?? '17:00';
  return [
    `🌙 We're closed right now — our team is offline until we open at *${open}* tomorrow.`,
    '',
    `You can still:`,
    `• Book an appointment (we'll confirm when we open)`,
    `• Check your loyalty balance`,
    `• Browse our FAQs`,
    '',
    `_Our hours are ${open} – ${close}. We'll reply to messages as soon as we open. 😊_`,
  ].join('\n');
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
    void recordBotPlatformAlert({
      salonId,
      title: 'WhatsApp send failed',
      body: err instanceof Error ? err.message : String(err),
      metadata: { waId, event: 'tenant_whatsapp_send_failed' },
    }).catch(() => {});
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

  let inboundStatus: 'DELIVERED' | 'FAILED' | 'UNHANDLED' = 'DELIVERED';
  let inboundSalonId: string | null = null;
  let lockAcquired = false;
  let lockKey = '';

  try {
    const tenant = await resolveTenantForInbound({
      twilioTo: input.twilioTo,
      metaPhoneNumberId: input.metaPhoneNumberId,
    });
    logger.info({ tenantId: tenant?.id ?? null, tenantSlug: tenant?.slug ?? null, twilioTo: input.twilioTo }, 'bot_tenant_resolved');
    if (!tenant) {
      logger.error({ twilioTo: input.twilioTo }, 'tenant_not_resolved');
      inboundStatus = 'UNHANDLED';
      return;
    }

    inboundSalonId = tenant.id;
    await touchBotSession(tenant.id, waId);

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

    if (!(await rateLimitOrReject(waId, tenant.id))) {
      await sendTenantWhatsApp(tenant.id, waId, 'Too many messages — please wait a minute and try again.');
      return;
    }

    logger.info({ tenantId: tenant.id, waId, textLen: text.length }, 'bot_processing');

    // EC-19: Per-user Redis mutex to serialise concurrent messages from the same number
    lockKey = `conv:lock:${tenant.id}:${waId}`;
    try {
      let acquired: string | null = null;
      try {
        acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
      } catch {
        // Redis unavailable — skip deduplication, process anyway
        acquired = 'OK';
      }
      lockAcquired = acquired === 'OK';
      if (!lockAcquired) {
        logger.warn({ tenantId: tenant.id, waId }, 'concurrent_message_blocked');
        await sendTenantWhatsApp(
          tenant.id,
          waId,
          'Still working on your last message — please wait a moment before sending another. 🙂',
        );
        return;
      }
      await runWithBotRequest(async () => {
        try {
          await withTenantContext(tenant.id, async () => {
            await processInboundWhatsApp(tenant, { waId, text, messageSid: input.messageSid });
          });
        } finally {
          await flushPendingOutbound();
          await flushPendingConsentAudits();
          const job = takePendingWelcomeJourney();
          if (job) {
            void withTenantContext(job.salonId, () =>
              sendWelcomeJourneyIfNeeded({
                salonId: job.salonId,
                customerId: job.customerId,
                isFirstInteraction: job.isFirstInteraction,
                send: (body) => sendTenantWhatsApp(job.salonId, job.waId, body),
              }),
            ).catch((err) => logger.warn({ err }, 'welcome_journey_failed'));
          }
        }
      });
    } catch (err) {
      inboundStatus = 'FAILED';
      const errCode = err instanceof Prisma.PrismaClientKnownRequestError ? err.code : 'unknown';
      logger.error({ err, errCode, tenantId: tenant.id, waId }, 'bot_transaction_failed');
      void recordBotPlatformAlert({
        salonId: tenant.id,
        title: 'Bot transaction failed',
        body: err instanceof Error ? err.message : String(err),
        metadata: { errCode, waId, event: 'bot_transaction_failed' },
      }).catch(() => {});
      // Last resort — send an error notice so users know something went wrong (not a silent menu)
      try {
        const salon = await prisma.salon.findUnique({
          where: { id: tenant.id },
          select: {
            name: true,
            tradingName: true,
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
        if (BOT_DEBUG) {
          const dbgText = debugMsg('bot_transaction_failed', err, { errCode, tenantId: tenant.id });
          await sendTenantWhatsApp(tenant.id, waId, dbgText);
        } else if (salon) {
          await sendTenantWhatsApp(tenant.id, waId, buildMainMenuText(salon as Salon));
        }
      } catch (fallbackErr) {
        logger.error({ err: fallbackErr }, 'bot_fallback_send_failed');
      }
    } finally {
      if (lockAcquired && lockKey) {
        await redis.del(lockKey).catch(() => {});
      }
    }
  } finally {
    logMessageLog({
      salonId: inboundSalonId,
      direction: 'INBOUND',
      status: inboundStatus,
    });
    if (inboundStatus === 'UNHANDLED') {
      emitPlatformEvent({
        type: 'BOT_UNHANDLED',
        salonId: inboundSalonId,
        metadata: { twilioTo: input.twilioTo ?? null },
      });
    } else if (inboundStatus === 'FAILED') {
      emitPlatformEvent({
        type: 'BOT_ERROR',
        salonId: inboundSalonId,
        metadata: { twilioTo: input.twilioTo ?? null },
      });
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

  void recordCampaignReply(salon.id, customer.id).catch(() => {});

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

  // Use upsert to avoid P2002 on providerSid if the same wamid arrives twice (Meta retries)
  if (messageSid) {
    await getTenantDb().message.upsert({
      where: { providerSid: messageSid },
      create: {
        conversationId: conv.id,
        customerId: customer.id,
        direction: MessageDirection.INBOUND,
        body: text,
        providerSid: messageSid,
      },
      update: {},
    });
  } else {
    await getTenantDb().message.create({
      data: {
        conversationId: conv.id,
        customerId: customer.id,
        direction: MessageDirection.INBOUND,
        body: text,
      },
    });
  }

  await getTenantDb().conversation.update({
    where: { id: conv.id },
    data: {
      lastMessageAt: new Date(),
      lastCustomerMessageAt: new Date(),
      messageCount: { increment: 1 },
    },
  });

  getTenantDb().analyticsEvent.create({
    data: {
      salonId: salon.id,
      customerId: customer.id,
      type: 'whatsapp_inbound',
      payload: { len: text.length },
    },
  }).catch((err) => logger.warn({ err }, 'analytics_event_create_failed'));

  // Notify the dashboard SSE stream — fire-and-forget, must not block the transaction
  emitMessageReceived(salon.id, customer.id, text).catch((err) =>
    logger.warn({ err }, 'sse_emit_failed'),
  );

  const inboundAt = new Date().toISOString();
  if (shouldScheduleInactivityReminder(conv.step)) {
    scheduleConversationActivity({
      conversationId: conv.id,
      salonId: salon.id,
      customerWaId: waId,
      activityAt: inboundAt,
    }).catch(() => {});
  } else {
    cancelConversationInactivity(conv.id).catch(() => {});
  }

  if (
    (salon.status === 'ACTIVE' || salon.status === 'TRIAL') &&
    conv.step !== ConversationStep.HANDOFF
  ) {
    tryRecordSupportTicket({
      salonId: salon.id,
      customerId: customer.id,
      text,
      step: conv.step,
      context: conv.context,
      bookingFlowSteps: WHATSAPP_BOOKING_STEPS,
    }).catch((err) => logger.warn({ err }, 'support_ticket_record_failed'));
  }

  const isFirstEverMessage = conv.messageCount === 0;
  if (isFirstEverMessage) {
    queuePendingWelcomeJourney({
      salonId: salon.id,
      customerId: customer.id,
      isFirstInteraction: customer.bookingCount === 0,
      waId,
    });
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

  const recovery = await tryRecoverFromSilentHandoff(conv, text);
  if (recovery.handled) return;
  conv = recovery.conv;

  const lower = text.toLowerCase();

  // ── WhatsApp core flows (always win over dashboard marketing / follow-up settings) ──
  if (isBackToMainMenuCommand(text) && !WHATSAPP_BOOKING_STEPS.includes(conv.step)) {
    await goBackToMainMenu(conv);
    return;
  }

  // Tapped "Continue" on the inactivity reminder — re-show the step they were on.
  if (isContinueCommand(text)) {
    await reply(conv, "Great — pick up right where you left off 👍");
    await repromptCurrentStep(conv);
    return;
  }

  // Legacy quick-reply title from old review messages — URL buttons open the browser
  // directly now, so ignore this tap (no thank-you reply).
  if (lower === 'leave google review') {
    return;
  }

  // Tapped "Write Feedback" on the review follow-up.
  if (isWriteReviewCommand(text)) {
    await saveCtx(conv.id, {}, ConversationStep.WRITE_REVIEW);
    await reply(conv, "We'd love to hear it — please type your feedback below:");
    return;
  }

  if (isConversationWakeMessage(text) && shouldResetConversationOnWake(conv.step)) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.GREETING);
    syncConvContext(conv, PENDING_PROFILE_CLEAR, ConversationStep.GREETING);
    conv = await reloadConversation(conv.id);
    if (shouldPromptMarketingConsentBeforeMenu(conv)) {
      await startMarketingConsentGate(conv);
      return;
    }
    await sendReceptionistGreeting(conv);
    return;
  }

  if (WHATSAPP_BOOKING_STEPS.includes(conv.step)) {
    try {
      await routeConversation(conv, text);
    } catch (err) {
      logger.error({ err, convId: conv.id, step: conv.step }, 'booking_flow_error');
      if (!hasPendingOutboundForConv(conv.id)) {
        const userMessage = BOT_DEBUG
          ? debugMsg('booking_flow_error', err, { step: conv.step, convId: conv.id })
          : 'Sorry — something went wrong with your booking. Starting fresh:';
        await recoverBookingFlowToMenu(conv, userMessage);
      }
    }
    return;
  }

  if (conv.step === ConversationStep.MARKETING_CONSENT) {
    await handleMarketingConsentFlow(conv, text);
    return;
  }

  if (WHATSAPP_MENU_STEPS.includes(conv.step)) {
    try {
      conv = await reloadConversation(conv.id);

      if (isBackToMainMenuCommand(text)) {
        await goBackToMainMenu(conv);
        return;
      }

      if (shouldPromptMarketingConsentBeforeMenu(conv)) {
        await startMarketingConsentGate(conv);
        return;
      }

      const supportIntent = parseFreeTextSupportIntent(text);
      if (supportIntent) {
        await handleFreeTextSupportIntent(conv, supportIntent);
        return;
      }

      // AI assist runs first — catches negative sentiment and natural language inputs.
      // Numeric menu choices pass through unhandled and fall to handleMenu below.
      const aiResult = await tryAiAssist(conv, text);
      if (aiResult.negativeSentiment) {
        await escalateNegativeSentiment(conv, text);
        return;
      }
      if (aiResult.handled && aiResult.reply) {
        await saveCtx(conv.id, aiResult.contextPatch ?? {}, aiResult.step ?? ConversationStep.MENU);
        syncConvContext(conv, aiResult.contextPatch ?? {}, aiResult.step ?? ConversationStep.MENU);
        const quickOpts = (aiResult.contextPatch?.quickPickOptions ??
          ctx(conv).quickPickOptions) as QuickPickOption[] | undefined;
        const interactive =
          quickOpts?.length
            ? buildQuickPickInteractive(quickOpts, conv.salon)
            : null;
        await replyMaybeInteractive(conv, aiResult.reply, interactive);
        return;
      }
      await handleMenu(conv, text);
      if ((ctx(conv).errorCount ?? 0) > 0) {
        await saveCtx(conv.id, { errorCount: undefined }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, convId: conv.id, step: conv.step }, 'menu_handler_error');
      if (!hasPendingOutboundForConv(conv.id)) {
        if (BOT_DEBUG) {
          await reply(conv, debugMsg('menu_handler_error', err, { step: conv.step, convId: conv.id }));
        } else {
          await reply(conv, 'Something went wrong. Reply *MENU* to see the menu and try again.');
        }
      }
    }
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

    // Within hours — open a support ticket and hand off
    await recordSupportTicketMessage({
      salonId: salon.id,
      customerId: customer.id,
      text: `Customer requested human support.\nLast message: ${text}`,
      subject: 'Human handoff requested',
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

  // AI assist runs first for menu/greeting/idle/faq steps — catches negative sentiment
  // and handles natural language before falling through to structured menu routing.
  const aiSteps: ConversationStep[] = [
    ConversationStep.GREETING,
    ConversationStep.MENU,
    ConversationStep.IDLE,
    ConversationStep.FAQ,
  ];
  if (aiSteps.includes(conv.step)) {
    const aiResult = await tryAiAssist(conv, text);
    // §4.4/§5 — check negative sentiment FIRST; cannot be bypassed by handled flag
    if (aiResult.negativeSentiment) {
      await escalateNegativeSentiment(conv, text);
      return;
    }
    if (aiResult.handled && aiResult.reply) {
      await saveCtx(conv.id, aiResult.contextPatch ?? {}, aiResult.step ?? ConversationStep.MENU);
      syncConvContext(conv, aiResult.contextPatch ?? {}, aiResult.step ?? ConversationStep.MENU);
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
        logger.error(
          { err, code: (err as Prisma.PrismaClientKnownRequestError).code, step: conv.step },
          'route_conversation_infra_error',
        );
        await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU).catch(() => {});
        syncConvContext(conv, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
        if (BOT_DEBUG) {
          await reply(conv, debugMsg('route_conversation_infra_error', err, { step: conv.step, convId: conv.id }));
        }
        await replyMenu(conv);
        return;
      }

      const prevCount = (ctx(conv).errorCount as number | undefined) ?? 0;
      const errorCount = prevCount + 1;

      if (BOT_DEBUG) {
        await reply(conv, debugMsg('route_conversation_error', err, { step: conv.step, convId: conv.id, errorCount })).catch(() => {});
      }

      if (errorCount >= 2) {
        // Escalate: move to HANDOFF, notify user, open a ticket, ping dashboard
        await saveCtx(conv.id, { ...PENDING_PROFILE_CLEAR, errorCount }, ConversationStep.HANDOFF).catch(
          () => {},
        );

        if (!BOT_DEBUG) {
          await reply(
            conv,
            'Oops! We ran into an unexpected problem and couldn\'t complete your request. ' +
            'A team member has been notified and will reach out to you shortly. ' +
            'We apologise for the inconvenience.',
          );
        }

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
        }).catch(() => {});

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
        // First failure — inform user and show menu
        await saveCtx(conv.id, { ...PENDING_PROFILE_CLEAR, errorCount }, ConversationStep.MENU).catch(
          () => {},
        );
        syncConvContext(conv, { ...PENDING_PROFILE_CLEAR, errorCount }, ConversationStep.MENU);
        if (!BOT_DEBUG) {
          await reply(conv, "Sorry, something went wrong. Let's start fresh:");
        }
        await replyMenu(conv);
      }
    } catch (innerErr) {
      logger.error({ innerErr }, 'error_recovery_failed');
      if (BOT_DEBUG) {
        await reply(conv, debugMsg('error_recovery_failed', innerErr, { convId: conv.id })).catch(() => {});
      }
      await replyMenu(conv).catch(() => {});
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
          direction: 'in',
          body: `Upset language detected.\nCustomer message: "${text.slice(0, 300)}"`,
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

  if (isGlobalMarketingOptOut(text)) {
    if (status !== 'DECLINED') {
      const newStatus = await applyMarketingConsentChoice({
        customerId: conv.customerId,
        salonId: salon.id,
        choice: 'decline',
        source: 'whatsapp_stop',
      });
      conv.customer.marketingConsentStatus = newStatus;
      void getTenantDb().analyticsEvent.create({
        data: {
          salonId: salon.id,
          customerId: conv.customerId,
          type: 'marketing_opt_out',
          payload: { source: 'whatsapp_stop' },
        },
      }).catch(() => {});
    }
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU, ctx(conv));
    await replyWithMenu(conv, buildConsentStopMessage());
    return true;
  }

  if (status === 'DECLINED' && isGlobalMarketingOptIn(text)) {
    const newStatus = await applyMarketingConsentChoice({
      customerId: conv.customerId,
      salonId: salon.id,
      choice: 'accept',
      source: 'whatsapp_opt_in',
    });
    conv.customer.marketingConsentStatus = newStatus;
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU, ctx(conv));
    await replyWithMenu(conv, buildConsentAcceptedMessage());
    return true;
  }

  if (!salon.botAskMarketingConsent || conv.step !== ConversationStep.MARKETING_CONSENT) {
    return false;
  }

  if (!needsMarketingConsentPrompt(status)) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU, ctx(conv));
    await replyMenu(conv);
    return true;
  }

  const choice = parseCombinedConsentReply(text);
  if (choice) {
    if (choice === 'decline') {
      const newStatus = await applyMarketingConsentChoice({
        customerId: conv.customerId,
        salonId: salon.id,
        choice: 'decline',
        source: 'whatsapp',
      });
      conv.customer.marketingConsentStatus = newStatus;
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU, ctx(conv));
      await replyWithMenu(
        conv,
        'No problem — we won\'t store your details or send marketing messages for now. ' +
          'You\'re welcome to browse, and we\'ll ask again if you decide to book. Reply ACCEPT anytime to opt in.',
      );
      return true;
    }

    const marketingChoice = choice === 'accept_all' ? 'accept' : 'decline';
    const newStatus = await applyMarketingConsentChoice({
      customerId: conv.customerId,
      salonId: salon.id,
      choice: marketingChoice,
      source: 'whatsapp',
    });
    conv.customer.marketingConsentStatus = newStatus;

    await getTenantDb().customer.update({
      where: { id: conv.customerId },
      data: { popiaConsentAt: new Date() },
    });
    conv.customer.popiaConsentAt = new Date();
    await getTenantDb().auditLog.create({
      data: {
        salonId: salon.id,
        action: 'booking_profile_consent_granted',
        entity: 'Customer',
        entityId: conv.customerId,
        payload: { source: 'whatsapp_combined_gate' },
      },
    }).catch(() => {});

    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU, ctx(conv));
    const ack = choice === 'accept_all' ? buildConsentAcceptedMessage() : buildConsentDeclinedMessage();
    await replyWithMenu(conv, ack);
    return true;
  }

  const reprompt = buildCombinedConsentMessage(salonDisplayName(conv.salon));
  await replyMaybeInteractive(
    conv,
    'Please tap an option below.\n\n' + reprompt,
    buildCombinedConsentInteractive(conv.salon, reprompt),
  );
  return true;
}

const BOOKING_FLOW_STEPS = new Set<ConversationStep>([
  ConversationStep.COLLECT_FIRST_NAME,
  ConversationStep.COLLECT_EMAIL,
  ConversationStep.COLLECT_DATE_OF_BIRTH,
  ConversationStep.BOOKING_POPIA_CONSENT,
  ConversationStep.PICK_BRANCH,
  ConversationStep.PICK_SERVICE_CATEGORY,
  ConversationStep.PICK_SERVICE,
  ConversationStep.PICK_STAFF,
  ConversationStep.PICK_DATE,
  ConversationStep.PICK_SLOT,
  ConversationStep.CONFIRM_BOOKING,
  ConversationStep.MANAGE_BOOKING,
  ConversationStep.CONFIRM_CANCEL,
  ConversationStep.RESCHEDULE,
]);

const SESSION_STALE_MS = 30 * 60 * 1000; // 30 minutes

async function goBackToMainMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  await saveCtx(conv.id, BOOKING_CTX_CLEAR, ConversationStep.MENU, ctx(conv));
  syncConvContext(conv, BOOKING_CTX_CLEAR, ConversationStep.MENU);
  await replyMenu(conv);
}

async function repromptPickBranch(conv: Conversation & { customer: Customer; salon: Salon }) {
  const branches = await getTenantDb().branch.findMany({
    where: { salonId: conv.salonId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (branches.length <= 1) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }
  const lines = branches.map((b, i) => `${i + 1}. ${b.name}${b.city ? ` (${b.city})` : ''}`);
  await saveCtx(conv.id, { branchOptions: branches.map((b) => b.id) }, ConversationStep.PICK_BRANCH);
  syncConvContext(conv, { branchOptions: branches.map((b) => b.id) }, ConversationStep.PICK_BRANCH);
  await replyMaybeInteractive(
    conv,
    ['Which location?', ...lines, '', 'Reply BACK for main menu.'].join('\n'),
    buildBranchPickerInteractive(branches, conv.salon),
  );
}

async function repromptPickServiceCategory(conv: Conversation & { customer: Customer; salon: Salon }) {
  const c = ctx(conv);
  const catIds = (c.serviceCategoryOptions ?? []) as string[];
  const allServices = await loadActiveServicesForBooking(conv.salonId);
  const categories = new Map<string, { name: string; sortOrder: number }>();
  const uncategorised: typeof allServices = [];
  for (const s of allServices) {
    if (s.category && catIds.includes(s.category.id)) {
      categories.set(s.category.id, { name: s.category.name, sortOrder: s.category.sortOrder });
    } else if (!s.category) {
      uncategorised.push(s);
    }
  }
  const catList = [...categories.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([id, cat]) => ({ id, ...cat }));
  const lines = catList.map((cat, i) => `${i + 1}. ${sanitize(cat.name)}`);
  if (uncategorised.length > 0) lines.push(`${catList.length + 1}. Other / Uncategorised`);
  await replyMaybeInteractive(
    conv,
    ['What type of service are you looking for?', '', ...lines, '', 'Reply BACK to go back.'].join('\n'),
    buildServiceCategoryPickerInteractive(catList, uncategorised.length > 0, conv.salon),
  );
}

async function repromptPickService(conv: Conversation & { customer: Customer; salon: Salon }) {
  const { services, clearedStaleFilter } = await resolveServicesForPicker(conv);
  if (services.length === 0) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyWithMenu(conv, 'No services are available to book right now.');
    return;
  }
  const lines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  const header = clearedStaleFilter
    ? 'That service list changed — pick again:'
    : services.length > 8
      ? `We have ${services.length} services — pick a number:`
      : 'Pick a service:';
  const page = (ctx(conv).servicePage as number | undefined) ?? 0;
  await replyMaybeInteractive(
    conv,
    [header, ...lines, '', 'Reply BACK to go back.'].join('\n'),
    buildServicePickerInteractive(services, page, SVC_PAGE_SIZE, conv.salon, header),
  );
}

async function repromptPickStaff(conv: Conversation & { customer: Customer; salon: Salon }) {
  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  if (!serviceId) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const { staffList, preferredId } = await getStaffListWithPreference(conv, service.id);
  if (staffList.length === 0) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyWithMenu(conv, `Sorry, no staff are available for *${sanitize(service.name)}* right now.`);
    return;
  }
  await saveCtx(conv.id, { staffOrderIds: staffList.map((s) => s.id) });
  const providerNoun = getIndustryTemplate(conv.salon.industryTemplate).providerNoun;
  const header = preferredId
    ? `Last time you booked with ${sanitize(staffList[0]!.name)}. Reply 1 to book with them again.\n\nChoose ${providerNoun}:`
    : `Choose ${providerNoun}:`;
  await replyMaybeInteractive(
    conv,
    [header, ...staffMenuLines(staffList, preferredId, providerNoun), '', 'Reply BACK to go back.'].join('\n'),
    buildStaffPickerInteractive(staffList, preferredId, conv.salon, header),
  );
}

async function repromptPickDate(conv: Conversation & { customer: Customer; salon: Salon }) {
  const c = ctx(conv);
  const flatSlotOptions = c.flatSlotOptions as { startIso: string; localDateStr: string }[] | undefined;
  const awaitingDateList = c.awaitingDateList as boolean | undefined;
  if (flatSlotOptions?.length && !awaitingDateList) {
    await repromptFlatSlotPicker(conv);
    return;
  }

  const dates = await suggestBookingDates(conv.salonId, 14);
  if (dates.length === 0) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    const phone = conv.salon.phoneDisplay?.trim();
    const msg = phone
      ? `We don't have any open slots in the next 2 weeks. 😔\n\nPlease call us on *${phone}* and we'll find a time that works for you!`
      : `We don't have any open slots in the next 2 weeks. Please contact us directly to arrange a booking.`;
    await replyWithMenu(conv, msg);
    return;
  }
  const lines = formatDateMenuLines(dates.slice(0, 10));
  const prefix = 'Pick a date (next available days):';
  await replyMaybeInteractive(
    conv,
    [prefix, ...lines, '', APPOINTMENT_DATE_HINT, 'Reply BACK to go back.'].join('\n'),
    buildDatePickerInteractive(dates.slice(0, 10), conv.salon.timezone, conv.salon, bookingInteractiveBody(prefix)),
  );
}

async function repromptPickSlot(conv: Conversation & { customer: Customer; salon: Salon }) {
  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  const staffId = c.selectedStaffId as string | undefined;
  const localDateStr = c.localDateStr as string | undefined;
  if (!serviceId || !staffId || !localDateStr) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const { slots, tooLong } = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr,
    ...customerSlotScope(conv),
  });
  if (tooLong || slots.length === 0) {
    await saveCtx(conv.id, { localDateStr: undefined, slotStartIso: undefined }, ConversationStep.PICK_DATE);
    syncConvContext(conv, { localDateStr: undefined, slotStartIso: undefined }, ConversationStep.PICK_DATE);
    await repromptPickDate(conv);
    return;
  }
  const lines = formatSlotMenuLines(slots, conv.salon.timezone);
  const extra =
    slots.length > MAX_SLOT_OPTIONS
      ? `\n_${slots.length - MAX_SLOT_OPTIONS} more times available — reply BACK to try another date._`
      : '';
  const header = bookingInteractiveBody('Pick a time slot:', APPOINTMENT_SLOT_HINT);
  await replyMaybeInteractive(
    conv,
    ['Pick a time slot:', ...lines, extra, '', APPOINTMENT_SLOT_HINT, '', 'Reply BACK to choose a different date.'].join('\n'),
    buildSlotPickerInteractive(slots, conv.salon.timezone, conv.salon, header),
  );
}

/** Re-show the combined next-available date+time picker (after staff pick or Continue). */
async function repromptFlatSlotPicker(conv: Conversation & { customer: Customer; salon: Salon }) {
  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  const staffId = c.selectedStaffId as string | undefined;
  if (!serviceId || !staffId) {
    await saveCtx(conv.id, { flatSlotOptions: undefined, awaitingDateList: undefined });
    syncConvContext(conv, { flatSlotOptions: undefined, awaitingDateList: undefined });
    const dates = await suggestBookingDates(conv.salonId, 14);
    if (dates.length === 0) {
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      await replyWithMenu(conv, 'No services are available to book right now.');
      return;
    }
    const lines = formatDateMenuLines(dates.slice(0, 10));
    const prefix = 'Pick a date (next available days):';
    await replyMaybeInteractive(
      conv,
      [prefix, ...lines, '', APPOINTMENT_DATE_HINT, 'Reply BACK to go back.'].join('\n'),
      buildDatePickerInteractive(dates.slice(0, 10), conv.salon.timezone, conv.salon, bookingInteractiveBody(prefix)),
    );
    return;
  }

  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const { slots: flatSlots, tooLong, hasMore } = await getNextAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    ...customerSlotScope(conv),
  });
  if (tooLong || flatSlots.length === 0) {
    await saveCtx(conv.id, { flatSlotOptions: undefined, awaitingDateList: undefined });
    syncConvContext(conv, { flatSlotOptions: undefined, awaitingDateList: undefined });
    const dates = await suggestBookingDates(conv.salonId, 14);
    if (dates.length === 0) {
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      const phone = conv.salon.phoneDisplay?.trim();
      const msg = phone
        ? `We don't have any open slots in the next 2 weeks. 😔\n\nPlease call us on *${phone}* and we'll find a time that works for you!`
        : `We don't have any open slots in the next 2 weeks. Please contact us directly to arrange a booking.`;
      await replyWithMenu(conv, msg);
      return;
    }
    const lines = formatDateMenuLines(dates.slice(0, 10));
    const prefix = 'Pick a date (next available days):';
    await replyMaybeInteractive(
      conv,
      [prefix, ...lines, '', APPOINTMENT_DATE_HINT, 'Reply BACK to go back.'].join('\n'),
      buildDatePickerInteractive(dates.slice(0, 10), conv.salon.timezone, conv.salon, bookingInteractiveBody(prefix)),
    );
    return;
  }

  await saveCtx(conv.id, {
    flatSlotOptions: flatSlots.map((s) => ({ startIso: s.start.toISOString(), localDateStr: s.localDateStr })),
    awaitingDateList: undefined,
  });
  syncConvContext(conv, {
    flatSlotOptions: flatSlots.map((s) => ({ startIso: s.start.toISOString(), localDateStr: s.localDateStr })),
    awaitingDateList: undefined,
  });
  const prefix = '⚡ *Soonest available times* — tap one below:';
  const lines = formatFlatSlotMenuLines(flatSlots, conv.salon.timezone, hasMore);
  await replyMaybeInteractive(
    conv,
    [prefix, ...lines, '', APPOINTMENT_DATE_HINT, '', 'Reply BACK to go back.'].join('\n'),
    buildCombinedSlotPickerInteractive(flatSlots, conv.salon.timezone, conv.salon, {
      hasMore,
      header: bookingInteractiveBody(prefix),
    }),
  );
}

async function repromptConfirmBooking(conv: Conversation & { customer: Customer; salon: Salon }) {
  const c = ctx(conv);
  const serviceId = c.selectedServiceId as string | undefined;
  const staffId = c.selectedStaffId as string | undefined;
  const slotIso = c.slotStartIso as string | undefined;
  if (!serviceId || !staffId || !slotIso) {
    await repromptPickSlot(conv);
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const confirmBody = await buildConfirmBookingBodyForService(conv, service, staff, new Date(slotIso));
  await sendConfirmBookingPrompt(conv, confirmBody);
}

async function repromptQuickPickSlot(conv: Conversation & { customer: Customer; salon: Salon }) {
  const quickOptions = ctx(conv).quickPickOptions as QuickPickOption[] | undefined;
  if (!quickOptions?.length) {
    await repromptPickSlot(conv);
    return;
  }
  await replyMaybeInteractive(
    conv,
    [
      'Here are times I can hold for you — reply with A, B, or C:',
      ...quickOptions.map((o) => o.label),
      '',
      'Or reply BACK for the main menu.',
    ].join('\n'),
    buildQuickPickInteractive(quickOptions, conv.salon),
  );
}

/** Re-show the prompt for whatever step the customer was on (e.g. after tapping Continue). */
async function repromptCurrentStep(conv: Conversation & { customer: Customer; salon: Salon }): Promise<void> {
  switch (conv.step) {
    case ConversationStep.PICK_BRANCH:
      await repromptPickBranch(conv);
      return;
    case ConversationStep.PICK_SERVICE_CATEGORY:
      await repromptPickServiceCategory(conv);
      return;
    case ConversationStep.PICK_SERVICE:
      await repromptPickService(conv);
      return;
    case ConversationStep.PICK_STAFF:
      await repromptPickStaff(conv);
      return;
    case ConversationStep.PICK_DATE:
      await repromptPickDate(conv);
      return;
    case ConversationStep.PICK_SLOT:
      if ((ctx(conv).quickPickOptions as QuickPickOption[] | undefined)?.length) {
        await repromptQuickPickSlot(conv);
      } else {
        await repromptPickSlot(conv);
      }
      return;
    case ConversationStep.CONFIRM_BOOKING:
      await repromptConfirmBooking(conv);
      return;
    case ConversationStep.COLLECT_FIRST_NAME:
      await reply(conv, 'What is your *first name*? (letters only)\n\nReply BACK for main menu.');
      return;
    case ConversationStep.COLLECT_EMAIL:
      await reply(
        conv,
        [
          'What is your *email address*?',
          '_We\'ll send your booking confirmation and appointment reminders here — no spam, ever._',
          '',
          'Reply BACK to go back.',
        ].join('\n'),
      );
      return;
    case ConversationStep.COLLECT_DATE_OF_BIRTH:
      await reply(
        conv,
        [
          'What is your *date of birth*? (DD/MM/YYYY, e.g. 15/06/1990)',
          '',
          '_We use your DOB for age-based pricing and birthday rewards. 🎂_',
          '',
          'Reply *SKIP* to skip · *BACK* for menu.',
        ].join('\n'),
      );
      return;
    case ConversationStep.BOOKING_POPIA_CONSENT:
      await replyMaybeInteractive(
        conv,
        buildBookingPopiaConsentMessage(),
        buildBookingPopiaInteractive(conv.salon),
      );
      return;
    case ConversationStep.MENU:
    case ConversationStep.IDLE:
    case ConversationStep.GREETING:
      await replyMenu(conv);
      return;
    default:
      await replyMenu(conv);
  }
}

/** Step back one level in the booking funnel and re-show the previous prompt. */
async function goBackOneStep(conv: Conversation & { customer: Customer; salon: Salon }): Promise<void> {
  switch (conv.step) {
    case ConversationStep.CONFIRM_BOOKING:
      await saveCtx(
        conv.id,
        { slotStartIso: undefined, quickPickOptions: undefined },
        ConversationStep.PICK_SLOT,
      );
      syncConvContext(conv, { slotStartIso: undefined, quickPickOptions: undefined }, ConversationStep.PICK_SLOT);
      await repromptPickSlot(conv);
      return;

    case ConversationStep.PICK_SLOT:
      await saveCtx(conv.id, { localDateStr: undefined, slotStartIso: undefined }, ConversationStep.PICK_DATE);
      syncConvContext(conv, { localDateStr: undefined, slotStartIso: undefined }, ConversationStep.PICK_DATE);
      await repromptPickDate(conv);
      return;

    case ConversationStep.PICK_DATE:
      if (conv.salon.botAllowStaffPick) {
        await saveCtx(
          conv.id,
          { selectedStaffId: undefined, anyStaff: undefined, staffOrderIds: undefined },
          ConversationStep.PICK_STAFF,
        );
        syncConvContext(
          conv,
          { selectedStaffId: undefined, anyStaff: undefined, staffOrderIds: undefined },
          ConversationStep.PICK_STAFF,
        );
        await repromptPickStaff(conv);
      } else {
        await saveCtx(
          conv.id,
          { selectedServiceId: undefined, serviceFilterIds: undefined },
          ConversationStep.PICK_SERVICE,
        );
        syncConvContext(
          conv,
          { selectedServiceId: undefined, serviceFilterIds: undefined },
          ConversationStep.PICK_SERVICE,
        );
        await repromptPickService(conv);
      }
      return;

    case ConversationStep.PICK_STAFF:
      await saveCtx(conv.id, { selectedServiceId: undefined }, ConversationStep.PICK_SERVICE);
      syncConvContext(conv, { selectedServiceId: undefined }, ConversationStep.PICK_SERVICE);
      await repromptPickService(conv);
      return;

    case ConversationStep.PICK_SERVICE: {
      const c = ctx(conv);
      if (Array.isArray(c.serviceFilterIds) && (c.serviceFilterIds as string[]).length > 0) {
        await saveCtx(conv.id, { serviceFilterIds: undefined }, ConversationStep.PICK_SERVICE_CATEGORY);
        syncConvContext(conv, { serviceFilterIds: undefined }, ConversationStep.PICK_SERVICE_CATEGORY);
        await repromptPickServiceCategory(conv);
        return;
      }
      const branchCount = await getTenantDb().branch.count({
        where: { salonId: conv.salonId, isActive: true },
      });
      if (branchCount > 1) {
        await saveCtx(
          conv.id,
          { selectedBranchId: undefined, serviceCategoryOptions: undefined },
          ConversationStep.PICK_BRANCH,
        );
        syncConvContext(
          conv,
          { selectedBranchId: undefined, serviceCategoryOptions: undefined },
          ConversationStep.PICK_BRANCH,
        );
        await repromptPickBranch(conv);
        return;
      }
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      syncConvContext(conv, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      await replyMenu(conv);
      return;
    }

    case ConversationStep.PICK_SERVICE_CATEGORY: {
      const branchCount = await getTenantDb().branch.count({
        where: { salonId: conv.salonId, isActive: true },
      });
      if (branchCount > 1) {
        await saveCtx(
          conv.id,
          { serviceCategoryOptions: undefined, serviceFilterIds: undefined },
          ConversationStep.PICK_BRANCH,
        );
        syncConvContext(
          conv,
          { serviceCategoryOptions: undefined, serviceFilterIds: undefined },
          ConversationStep.PICK_BRANCH,
        );
        await repromptPickBranch(conv);
        return;
      }
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      syncConvContext(conv, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      await replyMenu(conv);
      return;
    }

    case ConversationStep.PICK_BRANCH:
      await saveCtx(
        conv.id,
        {
          branchOptions: undefined,
          selectedBranchId: undefined,
          serviceCategoryOptions: undefined,
          serviceFilterIds: undefined,
        },
        ConversationStep.MENU,
      );
      syncConvContext(
        conv,
        {
          branchOptions: undefined,
          selectedBranchId: undefined,
          serviceCategoryOptions: undefined,
          serviceFilterIds: undefined,
        },
        ConversationStep.MENU,
      );
      await replyMenu(conv);
      return;

    case ConversationStep.COLLECT_DATE_OF_BIRTH:
      await saveCtx(conv.id, { pendingEmail: undefined }, ConversationStep.COLLECT_EMAIL);
      syncConvContext(conv, { pendingEmail: undefined }, ConversationStep.COLLECT_EMAIL);
      await reply(
        conv,
        [
          'What is your *email address*?',
          '_We\'ll send your booking confirmation and appointment reminders here — no spam, ever._',
          '',
          'Reply BACK to go back.',
        ].join('\n'),
      );
      return;

    case ConversationStep.COLLECT_EMAIL:
      await saveCtx(conv.id, { pendingFirstName: undefined }, ConversationStep.COLLECT_FIRST_NAME);
      syncConvContext(conv, { pendingFirstName: undefined }, ConversationStep.COLLECT_FIRST_NAME);
      await reply(conv, 'What is your *first name*? (letters only)\n\nReply BACK for main menu.');
      return;

    case ConversationStep.COLLECT_FIRST_NAME:
    case ConversationStep.BOOKING_POPIA_CONSENT:
    default:
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      syncConvContext(conv, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      await replyMenu(conv);
  }
}

async function routeConversation(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const t = text.trim();

  // Stale session guard — if user was mid-booking 30+ minutes ago, reset to menu
  if (
    (BOOKING_FLOW_STEPS as Set<string>).has(conv.step) &&
    conv.lastMessageAt &&
    Date.now() - new Date(conv.lastMessageAt).getTime() > SESSION_STALE_MS
  ) {
    await saveCtx(conv.id, BOOKING_CTX_CLEAR, ConversationStep.IDLE);
    syncConvContext(conv, BOOKING_CTX_CLEAR, ConversationStep.IDLE);
    await replyWithMenu(conv, '👋 It\'s been a while — your previous session has ended. Here\'s the menu to start fresh:');
    return;
  }

  if (isMainMenuCommand(t)) {
    await goBackToMainMenu(conv);
    return;
  }

  if (isBackCommand(t)) {
    await goBackOneStep(conv);
    return;
  }

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
    case ConversationStep.COLLECT_EMAIL:
      await handleCollectEmail(conv, t);
      break;
    case ConversationStep.COLLECT_DATE_OF_BIRTH:
      await handleCollectDateOfBirth(conv, t);
      break;
    case ConversationStep.BOOKING_POPIA_CONSENT:
      await handleBookingPopiaConsent(conv, t);
      break;
    case ConversationStep.PICK_SERVICE_CATEGORY:
      await handlePickServiceCategory(conv, t);
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
    case ConversationStep.CHOOSE_PAYMENT_METHOD:
      await handlePaymentMethodChoice(conv, t);
      break;
    case ConversationStep.PICK_BRANCH:
      await handlePickBranch(conv, t);
      break;
    case ConversationStep.MANAGE_BOOKING:
      await handleManageBooking(conv, t);
      break;
    case ConversationStep.CONFIRM_CANCEL:
      await handleConfirmCancel(conv, t);
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
    case ConversationStep.WRITE_REVIEW:
      await handleWriteReview(conv, t);
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

  await saveCtx(conv.id, BOOKING_CTX_CLEAR, undefined, ctx(conv));
  syncConvContext(conv, BOOKING_CTX_CLEAR, conv.step);

  const branches = await getTenantDb().branch.findMany({
    where: { salonId: salon.id, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (branches.length > 1) {
    const lines = branches.map((b, i) => `${i + 1}. ${b.name}${b.city ? ` (${b.city})` : ''}`);
    await saveCtx(conv.id, { branchOptions: branches.map((b) => b.id) }, ConversationStep.PICK_BRANCH);
    await replyMaybeInteractive(
      conv,
      ['Which location?', ...lines, '', 'Reply BACK for menu.'].join('\n'),
      buildBranchPickerInteractive(branches, conv.salon),
    );
    return;
  }

  if (branches.length === 1) {
    await saveCtx(conv.id, { selectedBranchId: branches[0].id }, ConversationStep.PICK_SERVICE);
    syncConvContext(conv, { selectedBranchId: branches[0].id }, ConversationStep.PICK_SERVICE);
  }

  const services = await loadActiveServicesForBooking(salon.id);
  if (services.length === 0) {
    const phone = salon.phoneDisplay?.trim();
    const msg = phone
      ? `We don't have any services set up for online booking yet.\n\nTo book, please call us on *${phone}* and we'll sort you out! 😊\n\nReply MENU to go back.`
      : `We don't have any services set up for online booking just yet.\n\nPlease contact the salon directly to make a booking.\n\nReply MENU to go back.`;
    await replyWithMenu(conv, msg);
    return;
  }

  // Item 29: funnel entry tracking
  void getTenantDb().analyticsEvent.create({
    data: { salonId: salon.id, customerId: conv.customerId, type: 'funnel_pick_service' },
  }).catch(() => {});

  // Group by category — if multiple categories exist, show category picker first.
  const categories = new Map<string, { name: string; sortOrder: number; ids: string[] }>();
  const uncategorised: typeof services = [];
  for (const s of services) {
    if (s.category) {
      const entry = categories.get(s.category.id) ?? { name: s.category.name, sortOrder: s.category.sortOrder, ids: [] };
      entry.ids.push(s.id);
      categories.set(s.category.id, entry);
    } else {
      uncategorised.push(s);
    }
  }

  const catList = [...categories.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([id, cat]) => ({ id, ...cat }));

  if (catList.length > 1) {
    // Show categories — customer picks one, then sees services within it.
    const lines = catList.map((c, i) => `${i + 1}. ${sanitize(c.name)}`);
    if (uncategorised.length > 0) lines.push(`${catList.length + 1}. Other / Uncategorised`);
    const catIds = catList.map((c) => c.id);
    await saveCtx(conv.id, { serviceCategoryOptions: catIds }, ConversationStep.PICK_SERVICE_CATEGORY);
    syncConvContext(conv, { serviceCategoryOptions: catIds }, ConversationStep.PICK_SERVICE_CATEGORY);
    const catNames = catList.map((c) => ({ name: c.name }));
    await replyMaybeInteractive(
      conv,
      ['What type of service are you looking for?', '', ...lines, '', 'Reply BACK for menu.'].join('\n'),
      buildServiceCategoryPickerInteractive(catNames, uncategorised.length > 0, conv.salon),
    );
    return;
  }

  // Single category or no categories — show paginated list (8 per page).
  const page = 0;
  await saveCtx(conv.id, { servicePage: page }, ConversationStep.PICK_SERVICE);
  syncConvContext(conv, { servicePage: page }, ConversationStep.PICK_SERVICE);
  const pageText = buildServicePage(services, page);
  await replyMaybeInteractive(
    conv,
    pageText,
    buildServicePickerInteractive(services, page, SVC_PAGE_SIZE, conv.salon),
  );
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

  await saveCtx(conv.id, { pendingFirstName: name }, ConversationStep.COLLECT_EMAIL);
  await reply(
    conv,
    [
      `Nice to meet you, *${name}*! 😊`,
      '',
      'What is your *email address*?',
      '_We\'ll send your booking confirmation and appointment reminders here — no spam, ever._',
      '',
      'Reply BACK for menu.',
    ].join('\n'),
  );
}

async function handleCollectEmail(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const upper = text.trim().toUpperCase();

  if (upper === 'SKIP') {
    await saveCtx(conv.id, { pendingEmail: undefined }, ConversationStep.COLLECT_DATE_OF_BIRTH);
    await reply(
      conv,
      [
        'No problem! Last question — what is your *date of birth*? (DD/MM/YYYY, e.g. 15/06/1990)',
        '',
        '_We use your DOB for age-based pricing and birthday rewards. 🎂_',
        '',
        'Reply *SKIP* to skip · *BACK* for menu.',
      ].join('\n'),
    );
    return;
  }

  const email = text.trim().toLowerCase();
  if (!PROFILE_EMAIL_REGEX.test(email)) {
    await reply(
      conv,
      'Please enter a valid email address (e.g. name@example.com).\n\nReply *SKIP* to skip this step · *BACK* for menu.',
    );
    return;
  }

  await saveCtx(conv.id, { pendingEmail: email }, ConversationStep.COLLECT_DATE_OF_BIRTH);
  await reply(
    conv,
    [
      'Almost done!',
      '',
      '*Date of birth* is optional (for birthday treats 🎂).',
      'Reply DD/MM/YYYY (e.g. 15/06/1990), or *SKIP* to continue booking.',
      '',
      'Reply *SKIP* to skip · *BACK* for menu.',
    ].join('\n'),
  );
}

async function commitPendingProfileAndContinueBooking(
  conv: Conversation & { customer: Customer; salon: Salon },
  data: { firstName: string; email: string; dateOfBirth?: Date },
): Promise<void> {
  const db = getTenantDb();
  await db.customer.update({
    where: { id: conv.customerId },
    data: {
      firstName: data.firstName,
      email: data.email,
      ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
      displayName: data.firstName,
    },
  });
  await saveCtx(conv.id, PENDING_PROFILE_CLEAR);
  const updatedCustomer = await db.customer.findUniqueOrThrow({ where: { id: conv.customerId } });
  await startBookingFlow({ ...conv, customer: updatedCustomer });
}

async function handleCollectDateOfBirth(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const pending = ctx(conv);
  const firstName = pending.pendingFirstName as string | undefined;
  const email = pending.pendingEmail as string | undefined;

  if (!firstName || !email) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.BOOKING_POPIA_CONSENT);
    await replyMaybeInteractive(
      conv,
      ['Something went wrong — let\'s start over.', '', buildBookingPopiaConsentMessage()].join('\n'),
      buildBookingPopiaInteractive(conv.salon),
    );
    return;
  }

  if (/^skip$/i.test(text.trim())) {
    await commitPendingProfileAndContinueBooking(conv, { firstName, email });
    return;
  }

  const dob = parseDOB(text);
  if (!dob) {
    await reply(
      conv,
      'Please enter your date of birth in DD/MM/YYYY format (e.g. 15/06/1990).\n\nReply *SKIP* to skip · *BACK* for menu.',
    );
    return;
  }
  const ageError = validateDOBAge(dob);
  if (ageError) {
    await reply(conv, `${ageError} Reply BACK for menu.`);
    return;
  }

  const dobStr = `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;

  await commitPendingProfileAndContinueBooking(conv, {
    firstName,
    email,
    dateOfBirth: new Date(dobStr),
  });
}

async function handleBookingPopiaConsent(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
): Promise<void> {
  const salon = conv.salon;
  const answer = text.trim().toUpperCase();

  if (answer !== 'YES' && answer !== 'NO') {
    await replyMaybeInteractive(
      conv,
      'Please reply *YES* to accept or *NO* to decline.\n\n' + buildBookingPopiaConsentMessage(),
      buildBookingPopiaInteractive(conv.salon),
    );
    return;
  }

  const db = getTenantDb();

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

  // POPIA accepted — now collect profile details before booking.
  await db.auditLog.create({
    data: {
      salonId: salon.id,
      action: 'booking_profile_consent_granted',
      entity: 'Customer',
      entityId: conv.customerId,
      payload: { source: 'whatsapp' },
    },
  });
  await db.customer.update({
    where: { id: conv.customerId },
    data: { popiaConsentAt: new Date() },
  });

  await saveCtx(conv.id, {}, ConversationStep.COLLECT_FIRST_NAME);
  await reply(
    conv,
    [
      'Thank you! Let\'s get your details set up.',
      '',
      'What is your *first name*?',
      '(Letters only — reply BACK for menu.)',
    ].join('\n'),
  );
}

async function menuActionStartBooking(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  try {
    await saveCtx(conv.id, BOOKING_CTX_CLEAR, ConversationStep.MENU);
    syncConvContext(conv, BOOKING_CTX_CLEAR, ConversationStep.MENU);

    const customer = await getTenantDb().customer.findUniqueOrThrow({
      where: { id: conv.customerId },
    });

    if (isProfileIncomplete(customer)) {
      if (customer.popiaConsentAt) {
        // Already gave POPIA consent at the combined first-contact gate — go
        // straight to collecting their name instead of asking again.
        await saveCtx(conv.id, BOOKING_CTX_CLEAR, ConversationStep.COLLECT_FIRST_NAME);
        syncConvContext(conv, BOOKING_CTX_CLEAR, ConversationStep.COLLECT_FIRST_NAME);
        await reply(
          conv,
          ['Let\'s get your details set up.', '', 'What is your *first name*?', '(Letters only — reply BACK for menu.)'].join('\n'),
        );
        return;
      }
      await saveCtx(conv.id, BOOKING_CTX_CLEAR, ConversationStep.BOOKING_POPIA_CONSENT);
      syncConvContext(conv, BOOKING_CTX_CLEAR, ConversationStep.BOOKING_POPIA_CONSENT);
      await replyMaybeInteractive(
        conv,
        buildBookingPopiaConsentMessage(),
        buildBookingPopiaInteractive(conv.salon),
      );
      return;
    }

    await startBookingFlow({ ...conv, customer });
  } catch (err) {
    logger.error({ err, convId: conv.id }, 'menu_action_start_booking_failed');
    if (!hasPendingOutboundForConv(conv.id)) {
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU).catch(() => {});
      syncConvContext(conv, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      if (BOT_DEBUG) {
        await reply(conv, debugMsg('menu_action_start_booking_failed', err, { convId: conv.id }));
      } else {
        const phone = conv.salon.phoneDisplay?.trim();
        const msg = phone
          ? `We couldn't start your booking just now. Please try again or call us on ${phone}.`
          : "We couldn't start your booking just now. Please try again in a moment.";
        await reply(conv, msg);
      }
      await replyMenu(conv);
    }
  }
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
    lines.push('', 'Want one of these again? Reply *REDO 1* or *CHOOSE AGAIN 1* (use the past-bookings number).');
  }

  if (upcoming.length === 0 && past.length === 0) {
    await replyWithMenu(conv, 'No bookings found yet.');
    return;
  }

  const managePastList = hint === 'view' ? past.map((a) => a.id) : undefined;

  if (upcoming.length > 0) {
    const actionHint =
      hint === 'cancel'
        ? 'Tap a booking to cancel, or reply CANCEL 1 (use the upcoming number), or BACK.'
        : hint === 'reschedule'
          ? 'Tap a booking to reschedule, or reply RESCHEDULE 1 (use the upcoming number), or BACK.'
          : 'Tap a booking to manage, or reply CANCEL 1 / RESCHEDULE 1, or BACK.';
    lines.push('', actionHint);
    await saveCtx(
      conv.id,
      {
        manageList: upcoming.map((a) => a.id),
        managePastList,
        manageBookingHint: hint,
        menuCategory: undefined,
        pendingManageIdx: undefined,
      },
      ConversationStep.MANAGE_BOOKING,
    );
    const header = lines.join('\n');
    await replyMaybeInteractive(
      conv,
      header,
      buildManageBookingListInteractive(
        upcoming.map((a) => ({
          serviceName: sanitize(a.service.name),
          whenLabel: fmtDt(a.start, salon.timezone),
        })),
        salon,
        header,
      ),
    );
    return;
  } else if (managePastList && managePastList.length > 0) {
    lines.push('', 'Reply BACK for menu.');
    await saveCtx(
      conv.id,
      { ...PENDING_PROFILE_CLEAR, manageList: undefined, managePastList, manageBookingHint: hint },
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
  const body = ['FAQs — reply with a number, or ask a question:', ...lines, '', 'Reply BACK for menu.'].join('\n');
  await replyMaybeInteractive(conv, body, buildFaqListInteractive(faqs, conv.salon));
}

async function menuActionShowContact(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const salon = conv.salon;
  const parts = [
    `📞 *Contact ${salonDisplayName(salon)}*`,
    salon.phoneDisplay ? `Phone: ${salon.phoneDisplay}` : null,
    salon.contactEmail ? `Email: ${salon.contactEmail}` : null,
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

async function prepareServicesSubMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<{ options: Awaited<ReturnType<typeof loadServiceSubMenuOptions>>; text: string }> {
  const options = await loadServiceSubMenuOptions(conv.salonId);
  const optionIds = options.map((o) => o.id);
  await saveCtx(
    conv.id,
    { menuCategory: 'services', serviceCategoryOptions: optionIds },
    ConversationStep.MENU,
    ctx(conv),
  );
  syncConvContext(conv, { menuCategory: 'services', serviceCategoryOptions: optionIds }, ConversationStep.MENU);
  return { options, text: buildServicesSubMenuText(options) };
}

async function menuActionShowServicesForOption(
  conv: Conversation & { customer: Customer; salon: Salon },
  optionId: string,
): Promise<void> {
  if (optionId === SERVICE_SUBMENU_PRICES) {
    await menuActionShowAllPrices(conv);
    return;
  }

  const { label, services } = await loadServicesForSubMenuOption(conv.salonId, optionId);
  if (services.length === 0) {
    await reply(
      conv,
      `No ${label.toLowerCase()} services listed yet.\n\nTry *Services › Prices* or *Book an appointment*.\nReply BACK for menu.`,
    );
    return;
  }

  const lines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  const filterPatch = {
    serviceFilterIds: services.map((s) => s.id),
    menuCategory: undefined,
    selectedServiceId: undefined,
    selectedStaffId: undefined,
    localDateStr: undefined,
    slotStartIso: undefined,
    quickPickOptions: undefined,
    anyStaff: undefined,
    staffOrderIds: undefined,
  };
  await saveCtx(conv.id, filterPatch, ConversationStep.PICK_SERVICE, ctx(conv));
  syncConvContext(conv, filterPatch, ConversationStep.PICK_SERVICE);
  const body = [`*${sanitize(label)}*`, ...lines, '', 'Reply with a number to book, or BACK.'].join('\n');
  await replyMaybeInteractive(
    conv,
    body,
    buildCategoryServiceListInteractive(label, services, conv.salon),
  );
}

async function menuActionShowAllPrices(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const services = await loadSalonServiceCatalog(conv.salonId);
  if (services.length === 0) {
    await replyWithMenu(conv, 'No services listed yet.');
    return;
  }
  const lines = buildCategorizedPriceLines(services, sanitize);
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
  const body = [`*Our team*`, ...lines, '', 'Reply BACK for menu.'].join('\n');
  await replyMaybeInteractive(
    conv,
    body,
    buildTeamListInteractive(
      team.map((s) => ({ name: sanitize(s.name), specialties: s.specialties })),
      conv.salon,
    ),
  );
}

async function menuActionLeaveReview(
  conv: Conversation & { customer: Customer; salon: Salon },
): Promise<void> {
  const settings = resolveGoogleReviewSettings(conv.salon.metadata);
  const reviewUrl = conv.salon.googleReviewUrl?.trim();
  if (settings.enabled && reviewUrl && isValidGoogleReviewUrl(reviewUrl) && conv.customer.waId) {
    const { claimUrl } = await prepareGoogleReviewFollowUp({
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: null,
      googleReviewUrl: reviewUrl,
      incentiveEnabled: settings.incentiveEnabled,
      incentiveCents: settings.incentiveCents,
    });
    await deliverGoogleReviewRequest({
      salonId: conv.salonId,
      to: conv.customer.waId,
      googleReviewUrl: reviewUrl,
      incentiveEnabled: settings.incentiveEnabled,
      incentiveCents: settings.incentiveCents,
      claimUrl,
    });
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
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
  const ratingBody = buildStarRatingPromptBody();
  await replyMaybeInteractive(conv, ratingBody, buildStarRatingInteractive(conv.salon));
}

async function handleSubMenuChoice(
  conv: Conversation & { customer: Customer; salon: Salon },
  category: MenuCategoryId | LegacyMenuCategoryId,
  choice: number,
): Promise<void> {
  // Legacy submenu had Book as option 1 under "Appointments"
  if (category === 'appointments') {
    if (choice === 1) return menuActionStartBooking(conv);
    if (choice === 2) return menuActionViewBookings(conv, 'view');
    if (choice === 3) return menuActionViewBookings(conv, 'reschedule');
    if (choice === 4) return menuActionViewBookings(conv, 'cancel');
    await replyMaybeInteractive(
      conv,
      'Invalid choice. Pick an option below, or reply BACK for main menu.\n\n' + buildSubMenuText('appointments'),
      buildCategorySubMenuInteractive('appointments', conv.salon),
    );
    return;
  }

  switch (category) {
    case 'my_appointments':
      if (choice === 1) return menuActionViewBookings(conv, 'view');
      if (choice === 2) return menuActionViewBookings(conv, 'reschedule');
      if (choice === 3) return menuActionViewBookings(conv, 'cancel');
      break;
    case 'services': {
      const options = await loadServiceSubMenuOptions(conv.salonId);
      const idx = choice - 1;
      if (idx >= 0 && idx < options.length) {
        await menuActionShowServicesForOption(conv, options[idx]!.id);
        return;
      }
      break;
    }
    case 'rewards':
      if (choice === 1) return menuActionLoyaltyBalance(conv, false);
      if (choice === 2) return menuActionLoyaltyBalance(conv, true);
      if (choice === 3) return handleReferralMenuItem(conv, (body) => reply(conv, body));
      break;
    case 'promotions':
      if (choice === 1) return menuActionShowSpecials(conv);
      if (choice === 2)
        return handleMembershipMenuItem(conv, (body) => reply(conv, body), {
          onPlansShown: async (planIds) => {
            await saveCtx(conv.id, { membershipPlanOptions: planIds }, ConversationStep.IDLE);
            syncConvContext(conv, { membershipPlanOptions: planIds }, ConversationStep.IDLE);
          },
        });
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
        await recordSupportTicketMessage({
          salonId: conv.salonId,
          customerId: conv.customerId,
          text: 'Customer opened Speak to Reception from the Support menu.',
          subject: 'Support — speak to reception',
        });
        await saveCtx(conv.id, { otherQueryAnswered: false, ...PENDING_PROFILE_CLEAR }, ConversationStep.OTHER_QUERY);
        await reply(conv, 'You\'re through to reception — how can we help you today?');
        return;
      }
      break;
  }

  await replyMaybeInteractive(
    conv,
    'Invalid choice. Pick an option below, or reply BACK for main menu.\n\n' + buildSubMenuText(category),
    buildCategorySubMenuInteractive(category, conv.salon),
  );
}

async function handleMainMenuSelection(
  conv: Conversation & { customer: Customer; salon: Salon },
  selection: NonNullable<ReturnType<typeof parseMainMenuSelection>>,
): Promise<void> {
  if (selection.kind === 'direct' && selection.action === 'book') {
    await menuActionStartBooking(conv);
    return;
  }
  if (selection.kind === 'category') {
    if (selection.id === 'rewards' && !conv.salon.botLoyaltyEnabled) {
      await replyWithMenu(conv, 'Rewards are not available at this salon right now.');
      return;
    }
    if (selection.id === 'services') {
      const { text, options } = await prepareServicesSubMenu(conv);
      await replyMaybeInteractive(conv, text, buildServicesSubMenuInteractive(options, conv.salon));
      return;
    }
    await saveCtx(conv.id, { menuCategory: selection.id }, ConversationStep.MENU);
    syncConvContext(conv, { menuCategory: selection.id }, ConversationStep.MENU);
    const subText = buildSubMenuText(selection.id);
    await replyMaybeInteractive(
      conv,
      subText,
      buildCategorySubMenuInteractive(selection.id, conv.salon),
    );
    return;
  }
}

async function handleFreeTextSupportIntent(
  conv: Conversation & { customer: Customer; salon: Salon },
  intent: NonNullable<ReturnType<typeof parseFreeTextSupportIntent>>,
): Promise<void> {
  if (intent === 'leave_review') {
    await menuActionLeaveReview(conv);
    return;
  }
  if (intent === 'report_issue') {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.COMPLAINT);
    await reply(conv, 'Please describe the issue — our team will follow up shortly.');
    return;
  }
  await saveCtx(conv.id, { menuCategory: 'support', ...PENDING_PROFILE_CLEAR }, ConversationStep.MENU);
  syncConvContext(conv, { menuCategory: 'support' }, ConversationStep.MENU);
  const subText = buildSubMenuText('support');
  await replyMaybeInteractive(conv, subText, buildCategorySubMenuInteractive('support', conv.salon));
}

async function handleMenu(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();

  const membershipPlanIds = ctx(conv).membershipPlanOptions as string[] | undefined;
  if (membershipPlanIds?.length) {
    if (isBackToMainMenuCommand(trimmed) || upper === 'BACK') {
      await saveCtx(conv.id, { membershipPlanOptions: undefined }, ConversationStep.MENU);
      syncConvContext(conv, { membershipPlanOptions: undefined }, ConversationStep.MENU);
      await replyMenu(conv);
      return;
    }
    const pick = parseInt(trimmed, 10);
    if (Number.isFinite(pick) && pick >= 1 && pick <= membershipPlanIds.length) {
      const planId = membershipPlanIds[pick - 1]!;
      await saveCtx(conv.id, { membershipPlanOptions: undefined }, ConversationStep.IDLE);
      syncConvContext(conv, { membershipPlanOptions: undefined }, ConversationStep.IDLE);
      await startMembershipPlanCheckout(
        conv,
        planId,
        (body, interactive) => replyMaybeInteractive(conv, body, interactive),
        (body) => reply(conv, body),
      );
      return;
    }
    await reply(
      conv,
      `Reply with a number 1–${membershipPlanIds.length} to subscribe, or BACK for menu.`,
    );
    return;
  }

  if (upper === 'REFERRAL') {
    await handleReferralMenuItem(conv, (body) => reply(conv, body));
    return;
  }

  if (isBackToMainMenuCommand(trimmed)) {
    await goBackToMainMenu(conv);
    return;
  }

  const rawCategory = ctx(conv).menuCategory;
  const activeCategory =
    rawCategory === 'appointments' ? 'appointments' : normalizeMenuCategoryId(rawCategory);
  if (activeCategory) {
    const subChoice = parseSubMenuChoice(trimmed);
    if (activeCategory === 'services') {
      const options = await loadServiceSubMenuOptions(conv.salonId);
      if (subChoice != null && subChoice >= 1 && subChoice <= options.length) {
        await menuActionShowServicesForOption(conv, options[subChoice - 1]!.id);
        return;
      }
    } else if (subChoice != null && isValidSubMenuChoice(activeCategory, subChoice)) {
      await handleSubMenuChoice(conv, activeCategory, subChoice);
      return;
    }
    const mainSelection = parseMainMenuSelection(trimmed, conv.salon);
    if (mainSelection) {
      await saveCtx(conv.id, { menuCategory: undefined }, ConversationStep.MENU);
      syncConvContext(conv, { menuCategory: undefined }, ConversationStep.MENU);
      await handleMainMenuSelection(conv, mainSelection);
      return;
    }
    const count =
      activeCategory === 'services'
        ? (await loadServiceSubMenuOptions(conv.salonId)).length
        : getSubMenuItemCount(activeCategory);
    if (activeCategory === 'services') {
      const { text: freshServicesMenu, options } = await prepareServicesSubMenu(conv);
      const freshCount = (ctx(conv).serviceCategoryOptions ?? []).length;
      const hint =
        subChoice != null
          ? `That number isn't on this menu — pick 1–${freshCount} below, or reply BACK for the main menu.`
          : `I didn't recognise that — pick 1–${freshCount} from the list below, or reply BACK for the main menu.`;
      await replyMaybeInteractive(
        conv,
        [hint, '', freshServicesMenu].join('\n'),
        buildServicesSubMenuInteractive(options, conv.salon),
      );
      return;
    }
    const hint =
      subChoice != null
        ? `That number isn't on this menu — pick 1–${count} below, or reply BACK for the main menu.`
        : `I didn't recognise that — pick 1–${count} from the list below, or reply BACK for the main menu.`;
    const subText = buildSubMenuText(activeCategory);
    await replyMaybeInteractive(
      conv,
      [hint, '', subText].join('\n'),
      buildCategorySubMenuInteractive(activeCategory, conv.salon),
    );
    return;
  }

  const selection = parseMainMenuSelection(trimmed, conv.salon);
  if (selection) {
    try {
      await handleMainMenuSelection(conv, selection);
    } catch (err) {
      logger.error({ err, convId: conv.id, selection }, 'main_menu_selection_failed');
      if (!hasPendingOutboundForConv(conv.id)) {
        if (BOT_DEBUG) {
          await reply(conv, debugMsg('main_menu_selection_failed', err, { convId: conv.id, selection }));
        } else {
          await reply(conv, 'That option isn\'t available right now. Reply *MENU* to try again.');
        }
      }
    }
    return;
  }

  if (isConversationWakeMessage(trimmed)) {
    await replyMenu(conv);
    return;
  }

  const supportIntent = parseFreeTextSupportIntent(trimmed);
  if (supportIntent) {
    await handleFreeTextSupportIntent(conv, supportIntent);
    return;
  }

  const bookingExample = getIndustryTemplate(conv.salon.industryTemplate).bookingExample;
  await reply(
    conv,
    [
      'I\'m not sure I caught that — I\'m best at helping with bookings, prices, and salon info. 😊',
      '',
      'Type *MENU* to see everything I can help with, or just ask me something like:',
      `• "I want to ${bookingExample}"`,
      '• "What are your prices?"',
      '• "What time do you open?"',
    ].join('\n'),
  );
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
  const hasPaymentHistory = await customerHasSucceededPayments(conv.customerId, conv.salonId);
  if (!hasPaymentHistory) return { staffList, preferredId: null };

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

function staffMenuLines(
  staffList: Staff[],
  preferredId: string | null,
  providerNoun = 'stylist',
): string[] {
  return [
    ...staffList.map(
      (s, i) => `${i + 1}. ${sanitize(s.name)}${s.id === preferredId ? ` (your last ${providerNoun})` : ''}`,
    ),
    `${staffList.length + 1}. Any available`,
  ];
}

const SVC_PAGE_SIZE = 8;

function buildServicePage(services: { id: string; name: string; priceCents: number }[], page: number): string {
  const start = page * SVC_PAGE_SIZE;
  const slice = services.slice(start, start + SVC_PAGE_SIZE);
  const hasMore = start + SVC_PAGE_SIZE < services.length;
  const lines = slice.map((s, i) => `${start + i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  const header = page === 0
    ? (services.length > SVC_PAGE_SIZE ? `We have ${services.length} services. Here are the first ${SVC_PAGE_SIZE}:` : 'Pick a service:')
    : `Services ${start + 1}–${start + slice.length} of ${services.length}:`;
  const footer = hasMore
    ? ['', 'Reply a *number* to pick · *MORE* to see more · *BACK* for menu.']
    : ['', 'Reply a *number* to pick · *BACK* for menu.'];
  return [header, ...lines, ...footer].join('\n');
}

/** Leave slot/quick-pick flow and show the full service catalog. */
async function beginAllServicesPicker(
  conv: Conversation & { customer: Customer; salon: Salon },
  intro = 'Here are our services:',
) {
  const { services } = await resolveServicesForPicker(conv);
  await saveCtx(
    conv.id,
    {
      selectedServiceId: undefined,
      selectedStaffId: undefined,
      localDateStr: undefined,
      slotStartIso: undefined,
      quickPickOptions: undefined,
      anyStaff: undefined,
      staffOrderIds: undefined,
      serviceFilterIds: undefined,
      servicePage: 0,
    },
    ConversationStep.PICK_SERVICE,
  );
  syncConvContext(
    conv,
    {
      selectedServiceId: undefined,
      selectedStaffId: undefined,
      localDateStr: undefined,
      slotStartIso: undefined,
      quickPickOptions: undefined,
      anyStaff: undefined,
      staffOrderIds: undefined,
      serviceFilterIds: undefined,
      servicePage: 0,
    },
    ConversationStep.PICK_SERVICE,
  );
  await replyMaybeInteractive(
    conv,
    `${intro}\n\n${buildServicePage(services, 0)}`,
    buildServicePickerInteractive(services, 0, SVC_PAGE_SIZE, conv.salon),
  );
}

async function handlePickServiceCategory(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (isBackCommand(text)) {
    await goBackOneStep(conv);
    return;
  }

  const c = ctx(conv);
  const catIds = (c.serviceCategoryOptions ?? []) as string[];
  const allServices = await loadActiveServicesForBooking(conv.salonId);

  // Build same category list as shown to the customer.
  const categories = new Map<string, { name: string; sortOrder: number; ids: string[] }>();
  const uncategorised: typeof allServices = [];
  for (const s of allServices) {
    if (s.category && catIds.includes(s.category.id)) {
      const entry = categories.get(s.category.id) ?? { name: s.category.name, sortOrder: s.category.sortOrder, ids: [] };
      entry.ids.push(s.id);
      categories.set(s.category.id, entry);
    } else if (!s.category) {
      uncategorised.push(s);
    }
  }
  const catList = [...categories.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([id, cat]) => ({ id, ...cat }));
  const totalOptions = catList.length + (uncategorised.length > 0 ? 1 : 0);

  const n = parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > totalOptions) {
    const lines = catList.map((c, i) => `${i + 1}. ${sanitize(c.name)}`);
    if (uncategorised.length > 0) lines.push(`${catList.length + 1}. Other / Uncategorised`);
    await replyMaybeInteractive(
      conv,
      [`Please reply with a number (1–${totalOptions}):`, ...lines, '', 'Reply BACK for menu.'].join('\n'),
      buildServiceCategoryPickerInteractive(
        catList.map((c) => ({ name: c.name })),
        uncategorised.length > 0,
        conv.salon,
      ),
    );
    return;
  }

  // Determine which services are in the chosen category.
  let filterIds: string[];
  let chosenName: string;
  if (n <= catList.length) {
    const chosen = catList[n - 1]!;
    filterIds = chosen.ids;
    chosenName = chosen.name;
  } else {
    filterIds = uncategorised.map((s) => s.id);
    chosenName = 'Other services';
  }

  const filtered = allServices.filter((s) => filterIds.includes(s.id));
  if (filtered.length === 0) {
    await reply(conv, `No services found in that category. Reply BACK to choose again.`);
    return;
  }

  const lines = filtered.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  await saveCtx(conv.id, { serviceFilterIds: filterIds }, ConversationStep.PICK_SERVICE);
  syncConvContext(conv, { serviceFilterIds: filterIds }, ConversationStep.PICK_SERVICE);
  const body = [`*${sanitize(chosenName)}*`, ...lines, '', 'Reply with a number to book, or BACK to change category.'].join('\n');
  await replyMaybeInteractive(conv, body, buildCategoryServiceListInteractive(chosenName, filtered, conv.salon));
}

async function handlePickService(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);

  // Clear any stale addonPhase from old conversation contexts
  if (c.addonPhase) {
    await saveCtx(conv.id, { addonPhase: undefined });
  }

  const { services, clearedStaleFilter } = await resolveServicesForPicker(conv);

  // "MORE" — advance to next page
  if (text.trim().toUpperCase() === 'MORE') {
    const currentPage = (ctx(conv).servicePage as number | undefined) ?? 0;
    const nextPage = currentPage + 1;
    const hasMore = (nextPage + 1) * SVC_PAGE_SIZE < services.length;
    if (!hasMore && nextPage * SVC_PAGE_SIZE >= services.length) {
      await reply(conv, `You've seen all ${services.length} services. Reply a number to pick one, or BACK for menu.`);
      return;
    }
    await saveCtx(conv.id, { servicePage: nextPage }, ConversationStep.PICK_SERVICE);
    syncConvContext(conv, { servicePage: nextPage }, ConversationStep.PICK_SERVICE);
    const pageText = buildServicePage(services, nextPage);
    await replyMaybeInteractive(
      conv,
      pageText,
      buildServicePickerInteractive(services, nextPage, SVC_PAGE_SIZE, conv.salon),
    );
    return;
  }

  const n = parseInt(text, 10);
  const page = (ctx(conv).servicePage as number | undefined) ?? 0;
  const pageStart = page * SVC_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + SVC_PAGE_SIZE, services.length);
  let service: (typeof services)[number] | undefined;
  let matchedByFreeText = false;
  if (Number.isFinite(n) && n >= pageStart + 1 && n <= pageEnd) {
    service = services[n - 1];
  } else {
    const byName = matchServiceInText(
      services.map((s) => ({ id: s.id, name: s.name })),
      text,
    );
    if (byName) {
      service = services.find((s) => s.id === byName);
      matchedByFreeText = true;
    }
  }

  // Free-text request named the service and a date/time in the same message
  // (e.g. "High top fade next Friday at 3 o'clock") — skip straight to a
  // confirm prompt instead of re-running the staff/date/slot picker steps.
  if (service && matchedByFreeText) {
    const direct = await tryDirectDateTimeBooking(conv, text, service.id, null);
    if (direct) {
      await saveCtx(conv.id, direct.contextPatch ?? {}, direct.step);
      syncConvContext(conv, direct.contextPatch ?? {}, direct.step);
      if (direct.reply) await reply(conv, direct.reply);
      return;
    }
  }

  if (!service) {
    if (clearedStaleFilter) {
      await saveCtx(conv.id, { servicePage: 0 }, ConversationStep.PICK_SERVICE);
      syncConvContext(conv, { servicePage: 0 }, ConversationStep.PICK_SERVICE);
      const svcLines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
      await replyMaybeInteractive(
        conv,
        ['That service list changed — here is what is available now:', ...svcLines, '', 'Reply BACK for menu.'].join('\n'),
        buildServicePickerInteractive(services, 0, SVC_PAGE_SIZE, conv.salon),
      );
    } else {
      const page = (ctx(conv).servicePage as number | undefined) ?? 0;
      const pageText = `Please reply with a number (1–${services.length}).\n\n${buildServicePage(services, page)}`;
      await replyMaybeInteractive(
        conv,
        pageText,
        buildServicePickerInteractive(services, page, SVC_PAGE_SIZE, conv.salon),
      );
    }
    return;
  }

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
      await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
      await replyWithMenu(conv, `No one is available for that service right now. Try another service or contact the salon.`);
      return;
    }
    const assignedStaff = availableStaff[0]!;
    await saveCtx(
      conv.id,
      {
        selectedServiceId: service.id,
        selectedStaffId: assignedStaff.id,
        anyStaff: true,
        quickPickOptions: undefined,
      },
      ConversationStep.PICK_DATE,
    );
    await handlePickDate(conv, '');
    return;
  }

  const { staffList: staff, preferredId } = await getStaffListWithPreference(conv, service.id);
  if (staff.length === 0) {
    await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
    const phone = conv.salon.phoneDisplay?.trim();
    const noStaffMsg = phone
      ? `Sorry, we don't have any staff available for *${sanitize(service.name)}* at the moment.\n\nPlease call us on *${phone}* to arrange a booking, or choose a different service.`
      : `Sorry, we don't have any staff available for *${sanitize(service.name)}* at the moment. Please try another service or contact the salon directly.`;
    await replyWithMenu(conv, noStaffMsg);
    return;
  }
  await saveCtx(
    conv.id,
    {
      selectedServiceId: service.id,
      staffOrderIds: staff.map((s) => s.id),
      quickPickOptions: undefined,
    },
    ConversationStep.PICK_STAFF,
  );
  const providerNoun = getIndustryTemplate(conv.salon.industryTemplate).providerNoun;
  const header = preferredId
    ? `*${sanitize(service.name)}*\nLast time you booked with ${sanitize(staff[0]!.name)}. Reply 1 to book with them again.\n\nChoose ${providerNoun}:`
    : `*${sanitize(service.name)}*\nChoose ${providerNoun}:`;
  await replyMaybeInteractive(
    conv,
    [header, ...staffMenuLines(staff, preferredId, providerNoun), '', 'BACK'].join('\n'),
    buildStaffPickerInteractive(staff, preferredId, conv.salon, header),
  );
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
    const phone = conv.salon.phoneDisplay?.trim();
    const msg = phone
      ? `Sorry, it looks like the staff member for that service is no longer available.\n\nGive us a call on *${phone}* and we'll find you the next available slot!`
      : `Sorry, it looks like the staff member for that service is no longer available. Please try another service.`;
    await replyWithMenu(conv, msg);
    return;
  }

  // Parse against the order the customer was actually shown; fall back to the
  // fresh list for conversations created before staffOrderIds existed.
  const savedOrder = c.staffOrderIds as string[] | undefined;
  const renderedIds =
    Array.isArray(savedOrder) && savedOrder.length > 0 ? savedOrder : staffList.map((s) => s.id);

  const providerNoun = getIndustryTemplate(conv.salon.industryTemplate).providerNoun;
  const rerenderMenu = async (prefix: string) => {
    await saveCtx(conv.id, { staffOrderIds: staffList.map((s) => s.id) });
    const body = [prefix, ...staffMenuLines(staffList, preferredId, providerNoun), '', 'Reply BACK for menu.'].join('\n');
    await replyMaybeInteractive(
      conv,
      body,
      buildStaffPickerInteractive(staffList, preferredId, conv.salon, prefix),
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
      // That provider became unavailable between menu render and reply —
      // never silently book whoever shifted into their slot number.
      await rerenderMenu(`Sorry, that ${providerNoun} just became unavailable. Here are the current options:`);
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

  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const { slots: flatSlots, tooLong, hasMore } = await getNextAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    ...customerSlotScope(conv),
  });
  if (tooLong) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(conv, `Sorry, this service is too long to fit within business hours. Please contact us directly.`);
    return;
  }
  if (flatSlots.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    const phone = conv.salon.phoneDisplay?.trim();
    const msg = phone
      ? `We don't have any open slots in the next 2 weeks. 😔\n\nPlease call us on *${phone}* and we'll find a time that works for you!`
      : `We don't have any open slots in the next 2 weeks. Please contact us directly to arrange a booking.`;
    await replyWithMenu(conv, msg);
    return;
  }

  await saveCtx(
    conv.id,
    {
      selectedStaffId: staffId,
      anyStaff: isAny,
      staffOrderIds: undefined,
      flatSlotOptions: flatSlots.map((s) => ({ startIso: s.start.toISOString(), localDateStr: s.localDateStr })),
      awaitingDateList: undefined,
    },
    ConversationStep.PICK_DATE,
  );
  syncConvContext(
    conv,
    {
      selectedStaffId: staffId,
      anyStaff: isAny,
      staffOrderIds: undefined,
      flatSlotOptions: flatSlots.map((s) => ({ startIso: s.start.toISOString(), localDateStr: s.localDateStr })),
      awaitingDateList: undefined,
    },
    ConversationStep.PICK_DATE,
  );
  const prefix = '⚡ *Soonest available times* — tap one below:';
  const lines = formatFlatSlotMenuLines(flatSlots, conv.salon.timezone, hasMore);
  await replyMaybeInteractive(
    conv,
    [prefix, ...lines, '', APPOINTMENT_DATE_HINT, '', 'Reply BACK to go back.'].join('\n'),
    buildCombinedSlotPickerInteractive(flatSlots, conv.salon.timezone, conv.salon, {
      hasMore,
      header: bookingInteractiveBody(prefix),
    }),
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
    await saveCtx(conv.id, { flatSlotOptions: undefined, awaitingDateList: true });
    if (suggestions.length === 0) {
      await saveCtx(conv.id, {}, ConversationStep.MENU);
      const phone = conv.salon.phoneDisplay?.trim();
      const anyStaff = (c.anyStaff as boolean | undefined) ?? false;
      const staffNote = anyStaff
        ? `for *${sanitize(service.name)}*`
        : `for *${sanitize(service.name)}* with *${sanitize(staff.name)}*`;
      const msg = [
        `😔 Unfortunately we have no open slots ${staffNote} in the next 2 weeks.`,
        '',
        phone
          ? `📞 Please call us on *${phone}* and we'll find something that works for you.`
          : `Please contact us directly and we'll arrange a time.`,
      ].join('\n');
      await replyWithMenu(conv, msg);
      return;
    }
    const dateLines = formatDateMenuLines(suggestions.slice(0, 10));
    await replyMaybeInteractive(
      conv,
      [prefix, ...dateLines, '', APPOINTMENT_DATE_HINT, 'Reply *BACK* to return to menu.'].join('\n'),
      buildDatePickerInteractive(
        suggestions.slice(0, 10),
        conv.salon.timezone,
        conv.salon,
        bookingInteractiveBody(prefix),
      ),
    );
  };

  const flatSlotOptions = c.flatSlotOptions as { startIso: string; localDateStr: string }[] | undefined;
  const awaitingDateList = c.awaitingDateList as boolean | undefined;

  const tryConfirmExactTime = async (parsed: { localDateStr: string; hour?: number; minute?: number }): Promise<boolean> => {
    if (parsed.hour == null) return false;
    const { slots, tooLong } = await getAvailableSlots({
      salonId: conv.salonId,
      service,
      staff,
      localDateStr: parsed.localDateStr,
      ...customerSlotScope(conv),
    });
    if (tooLong || slots.length === 0) return false;
    const wantedMin = parsed.hour * 60 + (parsed.minute ?? 0);
    const match =
      slots.find((s) => {
        const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
        return dt.hour * 60 + dt.minute === wantedMin;
      }) ??
      slots.find((s) => {
        const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
        return dt.hour * 60 + dt.minute >= wantedMin;
      });
    if (!match) return false;
    await saveCtx(
      conv.id,
      { localDateStr: parsed.localDateStr, slotStartIso: match.start.toISOString(), flatSlotOptions: undefined, awaitingDateList: undefined },
      ConversationStep.CONFIRM_BOOKING,
    );
    void getTenantDb().analyticsEvent.create({
      data: { salonId: conv.salonId, customerId: conv.customerId, type: 'funnel_pick_slot' },
    }).catch(() => {});
    const dt = DateTime.fromJSDate(match.start).setZone(conv.salon.timezone);
    const endDt = DateTime.fromJSDate(match.end).setZone(conv.salon.timezone);
    const confirmBody = buildConfirmBookingBody(conv, service.name, staff.name, dt, undefined, {
      priceCents: service.priceCents,
      endDt,
    });
    await sendConfirmBookingPrompt(conv, confirmBody);
    return true;
  };

  let manualLocalDateStr: string | undefined;

  if (flatSlotOptions && flatSlotOptions.length > 0 && !awaitingDateList) {
    const flatMenuN = isDateMenuNumber(text, flatSlotOptions.length);
    if (flatMenuN != null) {
      const picked = flatSlotOptions[flatMenuN - 1]!;
      await saveCtx(
        conv.id,
        { localDateStr: picked.localDateStr, slotStartIso: picked.startIso, flatSlotOptions: undefined },
        ConversationStep.CONFIRM_BOOKING,
      );
      void getTenantDb().analyticsEvent.create({
        data: { salonId: conv.salonId, customerId: conv.customerId, type: 'funnel_pick_slot' },
      }).catch(() => {});
      const confirmBody = await buildConfirmBookingBodyForService(conv, service, staff, new Date(picked.startIso));
      await sendConfirmBookingPrompt(conv, confirmBody);
      return;
    }
    if (isDateMenuNumber(text, flatSlotOptions.length + 1) === flatSlotOptions.length + 1) {
      await showDateList('📅 Pick a different date:');
      return;
    }
    const explicitDate = parseAppointmentLocalDate(text) ?? undefined;
    if (explicitDate) {
      await saveCtx(conv.id, { flatSlotOptions: undefined, awaitingDateList: true });
      manualLocalDateStr = explicitDate;
    } else {
      const parsed = await parseNaturalDateTime(text, conv.salon.timezone, {
        availableDates: suggestions,
      });
      if (!parsed) {
        await showDateList(APPOINTMENT_DATE_MISPARSE);
        return;
      }
      if (await tryConfirmExactTime(parsed)) return;
      await saveCtx(conv.id, { flatSlotOptions: undefined, awaitingDateList: true });
      manualLocalDateStr = parsed.localDateStr;
    }
  }

  let localDateStr: string | undefined = manualLocalDateStr;
  if (!localDateStr) {
    const menuN = isDateMenuNumber(text, Math.min(suggestions.length, 10));
    if (menuN != null) {
      localDateStr = suggestions[menuN - 1];
    } else if (text.trim()) {
      localDateStr = parseAppointmentLocalDate(text) ?? undefined;
      if (!localDateStr) {
        const parsed = await parseNaturalDateTime(text, conv.salon.timezone, {
          availableDates: suggestions,
        });
        if (parsed) {
          if (await tryConfirmExactTime(parsed)) return;
          localDateStr = parsed.localDateStr;
        }
      }
    }
  }

  if (!localDateStr) {
    const prefix = text.trim()
      ? APPOINTMENT_DATE_MISPARSE
      : `📅 When would you like to come in? Pick a date:`;
    await showDateList(prefix);
    return;
  }

  // EC-11: getAvailableSlots now returns { slots, tooLong }
  const { slots, tooLong } = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr,
    ...customerSlotScope(conv),
  });
  if (tooLong) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(conv, `Sorry, this service is too long to fit within business hours. Please contact us directly.`);
    return;
  }
  if (slots.length === 0) {
    await showDateList(`😔 No openings on ${formatDisplayLocalDate(localDateStr)} — it might be fully booked. Here are the next available dates:`);
    return;
  }

  await saveCtx(conv.id, { localDateStr, quickPickOptions: undefined }, ConversationStep.PICK_SLOT);
  void getTenantDb().analyticsEvent.create({
    data: { salonId: conv.salonId, customerId: conv.customerId, type: 'funnel_pick_slot' },
  }).catch(() => {});
  const localDt = DateTime.fromISO(localDateStr).setZone(conv.salon.timezone);
  const lines = formatSlotMenuLines(slots, conv.salon.timezone);
  const extra =
    slots.length > MAX_SLOT_OPTIONS
      ? `\n_${slots.length - MAX_SLOT_OPTIONS} more times available — reply BACK to try another date._`
      : '';
  const header = bookingInteractiveBody(
    `🗓 *${sanitize(service.name)}* · ${localDt.toFormat('cccc, d MMMM')}\nPick a time:`,
    APPOINTMENT_SLOT_HINT,
  );
  await replyMaybeInteractive(
    conv,
    [
      `🗓 *${sanitize(service.name)}* · ${localDt.toFormat('cccc, d MMMM')}`,
      'Pick a time:',
      ...lines,
      extra,
      '',
      APPOINTMENT_SLOT_HINT,
      '',
      'Reply *BACK* to choose a different date.',
    ].join('\n'),
    buildSlotPickerInteractive(slots, conv.salon.timezone, conv.salon, header),
  );
}

async function handlePickSlot(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const quickOptions = c.quickPickOptions as QuickPickOption[] | undefined;
  const hasQuickPick = Boolean(quickOptions?.length);
  const serviceId = c.selectedServiceId as string | undefined;
  const staffId = c.selectedStaffId as string | undefined;
  const localDateStr = c.localDateStr as string | undefined;
  const looksLikeSlotNumber = /^\d+$/.test(text.trim());
  const inStructuredBooking = Boolean(serviceId && staffId && localDateStr) && !hasQuickPick;

  if (isBrowseServicesRequest(text)) {
    await beginAllServicesPicker(conv, 'Sure — here are all our cuts and services:');
    return;
  }

  const quickPick = matchQuickPick(text, quickOptions);
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
    const confirmBody = await buildConfirmBookingBodyForService(conv, service, staff, dt.toJSDate());
    await sendConfirmBookingPrompt(conv, confirmBody);
    return;
  }

  // Natural-language date/time while picking a slot (e.g. "august 13th at 14:00").
  if (
    text.trim() &&
    serviceId &&
    staffId &&
    !looksLikeSlotNumber &&
    !/^[ABC]$/i.test(text.trim())
  ) {
    const suggestions = await suggestBookingDates(conv.salonId, 14);
    const hasDateHint =
      parseAppointmentLocalDate(text) != null ||
      (await parseNaturalDateTime(text, conv.salon.timezone, { availableDates: suggestions })) != null;
    if (hasDateHint) {
      await saveCtx(
        conv.id,
        { quickPickOptions: undefined, flatSlotOptions: undefined, awaitingDateList: undefined },
        ConversationStep.PICK_DATE,
      );
      syncConvContext(
        conv,
        { quickPickOptions: undefined, flatSlotOptions: undefined, awaitingDateList: undefined },
        ConversationStep.PICK_DATE,
      );
      await handlePickDate(conv, text);
      return;
    }
  }

  if (inStructuredBooking && looksLikeSlotNumber) {
    const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
    const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
    const { slots, tooLong } = await getAvailableSlots({
      salonId: conv.salonId,
      service,
      staff,
      localDateStr: localDateStr!,
      ...customerSlotScope(conv),
    });
    if (tooLong || slots.length === 0) {
      await saveCtx(conv.id, {}, ConversationStep.PICK_DATE);
      const reason = tooLong
        ? `That service is too long to fit into any slot on this day. Try a different date, or reply BACK to choose another.`
        : `No open slots on this day — it might be fully booked or our ${getIndustryTemplate(conv.salon.industryTemplate).providerNoun} isn't in. Reply BACK to pick a different date.`;
      await reply(conv, reason);
      return;
    }
    const n = parseInt(text, 10);
    const maxVisible = visibleSlotCount(slots.length);
    if (Number.isFinite(n) && n >= 1 && n <= maxVisible) {
      const slot = slots[n - 1]!;
      await saveCtx(
        conv.id,
        { slotStartIso: slot.start.toISOString(), quickPickOptions: undefined },
        ConversationStep.CONFIRM_BOOKING,
      );
      syncConvContext(
        conv,
        { slotStartIso: slot.start.toISOString(), quickPickOptions: undefined },
        ConversationStep.CONFIRM_BOOKING,
      );
      const confirmBody = await buildConfirmBookingBodyForService(conv, service, staff, slot.start);
      await sendConfirmBookingPrompt(conv, confirmBody);
      return;
    }
    const slotLines = formatSlotMenuLines(slots, conv.salon.timezone);
    const invalidBody = [
      `Invalid choice. Pick a slot number (1–${maxVisible}):`,
      ...slotLines,
      '',
      APPOINTMENT_SLOT_HINT,
      '',
      'Reply BACK to choose a different date.',
    ].join('\n');
    await replyMaybeInteractive(
      conv,
      invalidBody,
      buildSlotPickerInteractive(
        slots,
        conv.salon.timezone,
        conv.salon,
        bookingInteractiveBody('Pick a time:', APPOINTMENT_SLOT_HINT),
      ),
    );
    return;
  }

  if (hasQuickPick) {
    await replyMaybeInteractive(
      conv,
      [
        "I didn't catch that. Reply with *A*, *B*, or *C* for one of these times:",
        ...quickOptions!.map((o) => o.label),
        '',
        'Or ask to *see all services*, or reply *BACK* for the main menu.',
      ].join('\n'),
      buildQuickPickInteractive(quickOptions!, conv.salon),
    );
    return;
  }

  if (!serviceId || !staffId || !localDateStr) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }
  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const { slots, tooLong } = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr,
    ...customerSlotScope(conv),
  });
  if (tooLong || slots.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.PICK_DATE);
    const reason = tooLong
      ? `That service is too long to fit into any slot on this day. Try a different date, or reply BACK to choose another.`
      : `No open slots on this day — it might be fully booked or our ${getIndustryTemplate(conv.salon.industryTemplate).providerNoun} isn't in. Reply BACK to pick a different date.`;
    await reply(conv, reason);
    return;
  }
  const maxVisible = visibleSlotCount(slots.length);
  const slotLines = formatSlotMenuLines(slots, conv.salon.timezone);
  const invalidBody = [
    `Invalid choice. Pick a slot number (1–${maxVisible}):`,
    ...slotLines,
    '',
    APPOINTMENT_SLOT_HINT,
    '',
    'Reply BACK to choose a different date.',
  ].join('\n');
  await replyMaybeInteractive(
    conv,
    invalidBody,
    buildSlotPickerInteractive(
      slots,
      conv.salon.timezone,
      conv.salon,
      bookingInteractiveBody('Pick a time:', APPOINTMENT_SLOT_HINT),
    ),
  );
}

async function handleConfirm(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const trimmed = text.trim();
  if (isBackCommand(trimmed)) {
    await goBackOneStep(conv);
    return;
  }
  if (isMainMenuCommand(trimmed)) {
    await goBackToMainMenu(conv);
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

  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });

  // Group booking: a bare number 2–20 sets/updates the party size instead of
  // confirming — re-show the confirmation with the updated headcount.
  const partySizeAttempt = /^\d{1,2}$/.test(trimmed) ? parseInt(trimmed, 10) : NaN;
  if (Number.isFinite(partySizeAttempt) && partySizeAttempt >= 2 && partySizeAttempt <= 20) {
    await saveCtx(conv.id, { partySize: partySizeAttempt });
    const confirmBody = await buildConfirmBookingBodyForService(
      conv,
      service,
      staff,
      new Date(slotIso),
      partySizeAttempt,
    );
    await sendConfirmBookingPrompt(conv, confirmBody);
    return;
  }

  // EC-03: accept natural affirmations, not just exact "yes"/"y"
  if (!/^(yes|y|yep|yeah|confirm|ok|sure|absolutely)\b/i.test(trimmed)) {
    const confirmBody = await buildConfirmBookingBodyForService(conv, service, staff, new Date(slotIso));
    await sendConfirmBookingPrompt(conv, confirmBody);
    return;
  }

  // EC-17: Re-check salon status in case it was suspended after the booking flow started
  const freshSalon = await getTenantDb().salon.findUniqueOrThrow({ where: { id: conv.salonId } });
  if (freshSalon.status === 'SUSPENDED' || freshSalon.status === 'CHURNED') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyWithMenu(conv, `Sorry, this salon is not currently accepting bookings. Please try again later.`);
    return;
  }

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
      const { slots: freshSlots } = await getAvailableSlots({
        salonId: conv.salonId,
        service,
        staff,
        localDateStr,
        ...customerSlotScope(conv),
      });
      if (freshSlots.length > 0) {
        await saveCtx(conv.id, {}, ConversationStep.PICK_SLOT);
        const slotLines = formatSlotMenuLines(freshSlots, conv.salon.timezone);
        const slotBody = [
          'Sorry, that slot was just taken. Please pick another time:',
          ...slotLines,
          '',
          APPOINTMENT_SLOT_HINT,
          '',
          'Reply BACK to choose a different date.',
        ].join('\n');
        await replyMaybeInteractive(
          conv,
          slotBody,
          buildSlotPickerInteractive(
            freshSlots,
            conv.salon.timezone,
            conv.salon,
            bookingInteractiveBody('Pick another time:', APPOINTMENT_SLOT_HINT),
          ),
        );
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
        `You already have a booking at that time — ${sanitize(customerOverlap.service.name)} at ${dt.toFormat('HH:mm')}. You're trying to book *${sanitize(service.name)}* at the same time. Reply BACK to choose a different slot, or MANAGE to view your bookings.`,
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

  const paymentPlan = resolvePostConfirmPayment({
    bookingTotalCents,
    loyaltyRedeemed: redeem.redeemed,
    requirePaymentStep: salonRequiresPostConfirmPayment(freshSalon),
  });
  const reviewCredit = await applyReviewCreditTx(tx, {
    customerId: conv.customerId,
    servicePriceCents: bookingTotalCents,
    atVisitOnly: Boolean(paymentPlan),
  });
  const reschedulingId = c.managingAppointmentId as string | undefined;

  const isFirstSalonBooking =
    (await tx.appointment.count({ where: { salonId: conv.salonId } })) === 0;

  const appointment = await tx.appointment.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      serviceId: service.id,
      staffId: staff.id,
      start,
      end,
      addonServiceIds: (c.selectedAddonIds as string[] | undefined) ?? [],
      partySize: (c.partySize as number | undefined) ?? 1,
      status: redeem.redeemed ? 'CONFIRMED' : paymentPlan ? 'PENDING_PAYMENT' : 'CONFIRMED',
      loyaltyRedeemed: redeem.redeemed,
      rescheduledFromId: reschedulingId ?? undefined,
      confirmedAt: new Date(),
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

  // Notify dashboard + invalidate slot cache immediately — including unpaid bookings.
  notifyAppointmentBookedLater(conv.salonId, appointment.id, {
    staffId: staff.id,
    serviceId: service.id,
    start: start.toISOString(),
    status: appointment.status,
    source: 'whatsapp',
    rescheduledFromId: reschedulingId ?? null,
  });
  if (isFirstSalonBooking && !reschedulingId) {
    emitPlatformEvent({
      type: 'APPOINTMENT_BOOKED',
      salonId: conv.salonId,
      metadata: {
        appointmentId: appointment.id,
        serviceName: service.name,
        firstBooking: true,
      },
    });
  }
  if (reschedulingId) {
    notifyAppointmentChangedLater(conv.salonId, reschedulingId, {
      status: 'RESCHEDULED',
      staffId: staff.id,
      serviceId: service.id,
      replacedById: appointment.id,
      source: 'whatsapp',
    });
    void cancelGoogleReviewForAppointment(reschedulingId).catch(() => undefined);
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

  await saveCtx(conv.id, { pendingAppointmentId: appointment.id, partySize: undefined }, ConversationStep.IDLE);

  const bookingNotes = [redeem.note, reviewCredit.note].filter(Boolean).join('\n');
  const confirmFirstName = conv.customer.firstName?.trim();
  const partySize = (c.partySize as number | undefined) ?? 1;
  await reply(
    conv,
    [
      bookingNotes ? `${bookingNotes}\n` : '',
      confirmFirstName
        ? `✅ *You're all set, ${sanitize(confirmFirstName)}!*`
        : `✅ *Booking confirmed!*`,
      '',
      `📋 *${sanitize(service.name)}*`,
      `👤 with ${sanitize(staff.name)}`,
      `📅 ${DateTime.fromJSDate(start).setZone(conv.salon.timezone).toFormat('cccc, d MMMM yyyy')}`,
      `🕐 ${DateTime.fromJSDate(start).setZone(conv.salon.timezone).toFormat('HH:mm')} – ${DateTime.fromJSDate(end).setZone(conv.salon.timezone).toFormat('HH:mm')}`,
      partySize > 1 ? `👥 Party size: ${partySize}` : '',
      '',
      `🔖 Ref: *${appointment.id.slice(0, 8).toUpperCase()}*`,
      '',
      confirmFirstName
        ? `_See you then, ${sanitize(confirmFirstName)}! Reply *MENU* anytime to manage your bookings._`
        : `_Reply *MENU* anytime to manage your bookings._`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  if (paymentPlan) {
    await saveCtx(
      conv.id,
      {
        pendingAppointmentId: appointment.id,
        pendingPaymentAmountCents: paymentPlan.amountCents,
        pendingPaymentIsFirstBooking: isFirstBooking,
      },
      ConversationStep.CHOOSE_PAYMENT_METHOD,
    );
    await promptPostConfirmPayment(conv, appointment.id, service, paymentPlan.amountCents);
    return;
  } else {
    void onBookingConfirmed({
      id: appointment.id,
      salonId: conv.salonId,
      start,
      status: appointment.status,
      salon: conv.salon,
    }).catch((err) => logger.warn({ err, appointmentId: appointment.id }, 'reminder_schedule_failed'));
  }

  await saveCtx(conv.id, { pendingAppointmentId: appointment.id }, ConversationStep.BOOKING_RATING);
  await promptBookingRating(conv);

  // Chained multi-person request (e.g. "myself and my son") and no post-confirm
  // payment gate — line up the next person's booking now. When a payment step
  // ran instead, chaining happens once that payment succeeds (payments.ts).
  const pendingExtraBookings = (c.pendingExtraBookings as number | undefined) ?? 0;
  if (!paymentPlan && pendingExtraBookings > 0) {
    await startNextChainedBooking({
      salonId: conv.salonId,
      customerId: conv.customerId,
      serviceId: service.id,
      staffId: staff.id,
      afterStart: end,
      remaining: pendingExtraBookings,
    }).catch((err) => logger.warn({ err, appointmentId: appointment.id }, 'chained_booking_start_failed'));
  }
}

async function promptBookingRating(conv: Conversation & { customer: Customer; salon: Salon }) {
  const interactive = buildBookingRatingInteractive(conv.salon);
  await replyMaybeInteractive(conv, interactive.body, interactive);
}

async function finishBookingAfterPayment(
  conv: Conversation & { customer: Customer; salon: Salon },
  appointment: { id: string; salonId: string; start: Date; status: AppointmentStatus },
) {
  void onBookingConfirmed({
    id: appointment.id,
    salonId: appointment.salonId,
    start: appointment.start,
    status: appointment.status,
    salon: conv.salon,
  }).catch((err) => logger.warn({ err, appointmentId: appointment.id }, 'reminder_schedule_failed'));

  await saveCtx(
    conv.id,
    { pendingAppointmentId: appointment.id, awaitingCashConfirm: undefined },
    ConversationStep.BOOKING_RATING,
  );
  await promptBookingRating(conv);
}

async function promptPostConfirmPayment(
  conv: Conversation & { customer: Customer; salon: Salon },
  appointmentId: string,
  service: Service,
  amountCents: number,
): Promise<void> {
  const checkoutUrl = await createPaymentCheckoutSession({
    salonId: conv.salonId,
    customerId: conv.customerId,
    appointmentId,
    service,
    amountCents,
  });

  await saveCtx(
    conv.id,
    { pendingPaymentCheckoutUrl: checkoutUrl ?? undefined },
    ConversationStep.CHOOSE_PAYMENT_METHOD,
  );

  if (checkoutUrl) {
    const body = buildSecurePaymentPromptBody(amountCents);
    await replyMaybeInteractive(conv, body, buildPaymentCheckoutCta(body, checkoutUrl));
    const cashInteractive = buildPaymentCashOptionInteractive(conv.salon);
    await replyMaybeInteractive(conv, cashInteractive.body, cashInteractive);
    return;
  }

  logger.warn({ appointmentId, salonId: conv.salonId }, 'payment_checkout_prompt_fallback');
  await reply(conv, buildPaymentMethodFallbackText(amountCents));
}

async function deliverPaymentCheckoutLink(
  conv: Conversation & { customer: Customer; salon: Salon },
  input: {
    appointmentId: string;
    service: Service;
    amountCents: number;
    resend?: boolean;
  },
): Promise<boolean> {
  const c = ctx(conv);
  let checkoutUrl = (c.pendingPaymentCheckoutUrl as string | undefined)?.trim() || null;

  if (!checkoutUrl) {
    checkoutUrl = await createPaymentCheckoutSession({
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: input.appointmentId,
      service: input.service,
      amountCents: input.amountCents,
    });
    if (checkoutUrl) {
      await saveCtx(conv.id, { pendingPaymentCheckoutUrl: checkoutUrl }, ConversationStep.CHOOSE_PAYMENT_METHOD);
    }
  }

  if (!checkoutUrl) return false;

  const body = buildSecurePaymentPromptBody(input.amountCents, { resend: input.resend });
  await replyMaybeInteractive(conv, body, buildPaymentCheckoutCta(body, checkoutUrl));
  return true;
}

function buildPaymentMethodPrompt(amountCents: number): string {
  return buildPaymentMethodFallbackText(amountCents);
}

function buildCashPaymentNudge(amountCents: number): string {
  return buildCashPaymentNudgeBody(amountCents);
}

function isCashConfirmation(text: string, afterNudge = false): boolean {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (afterNudge && /^2$/.test(trimmed)) return true;
  return /^cash\b|confirm\b|^yes\b|pay\s*cash/i.test(lower);
}

async function finalizeCashPayment(
  conv: Conversation & { customer: Customer; salon: Salon },
  appointment: { id: string; salonId: string; start: Date; status: AppointmentStatus; service: { name: string } },
  amountCents: number,
) {
  const tx = getTenantDb();
  await tx.payment.create({
    data: {
      salonId: conv.salonId,
      appointmentId: appointment.id,
      customerId: conv.customerId,
      provider: 'MANUAL',
      method: 'CASH',
      status: 'PENDING',
      amountCents,
      currency: 'ZAR',
    },
  });
  await tx.appointment.update({
    where: { id: appointment.id },
    data: { paymentMethod: 'CASH' },
  });

  const ref = appointment.id.slice(0, 8).toUpperCase();
  await reply(
    conv,
    `✅ *Confirmed* — pay *${formatCentsZar(amountCents)}* when you arrive.\nRef: *${ref}*`,
  );

  await finishBookingAfterPayment(conv, appointment);
}

async function handlePaymentMethodChoice(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const trimmed = text.trim();
  if (isMainMenuCommand(trimmed)) {
    await goBackToMainMenu(conv);
    return;
  }

  const c = ctx(conv);
  const appointmentId = c.pendingAppointmentId as string | undefined;
  const amountCents = c.pendingPaymentAmountCents as number | undefined;
  const awaitingCashConfirm = Boolean(c.awaitingCashConfirm);
  if (!appointmentId || !amountCents) {
    await saveCtx(conv.id, {}, ConversationStep.IDLE);
    await replyMenu(conv);
    return;
  }

  const lower = trimmed.toLowerCase();
  const isCard = /^1$/.test(trimmed) || /^(card|online|payfast|pay)\b/i.test(lower);
  const isCashChoice = /^2$/.test(trimmed) || /^cash\b/i.test(lower);

  if (/^3$/.test(trimmed) || /^eft\b|bank\s*transfer/i.test(lower)) {
    await reply(
      conv,
      'We offer secure *PayFast* online or *cash at the salon* — no EFT on WhatsApp.\n\n' +
        buildPaymentMethodPrompt(amountCents),
    );
    return;
  }

  const tx = getTenantDb();
  const appointment = await tx.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { service: true },
  });

  if (awaitingCashConfirm) {
    if (isCard) {
      await saveCtx(conv.id, { awaitingCashConfirm: undefined }, ConversationStep.CHOOSE_PAYMENT_METHOD);
      // fall through to PayFast below
    } else if (isCashConfirmation(trimmed, true)) {
      await finalizeCashPayment(conv, appointment, amountCents);
      return;
    } else if (isCashChoice) {
      await reply(conv, buildCashPaymentNudge(amountCents));
      return;
    } else {
      await reply(
        conv,
        `Reply *1* for secure PayFast payment, or *CASH* to confirm pay-on-arrival.\n\n` +
          `_PayFast is 100% safe and the fastest way to secure your booking._`,
      );
      return;
    }
  }

  if (!isCard && !isCashChoice) {
    await reply(conv, buildPaymentMethodPrompt(amountCents));
    return;
  }

  if (isCashChoice) {
    await saveCtx(
      conv.id,
      { awaitingCashConfirm: true },
      ConversationStep.CHOOSE_PAYMENT_METHOD,
    );
    await reply(conv, buildCashPaymentNudge(amountCents));
    return;
  }

  if (isCard) {
    let awaitingOnlinePayment = false;
    try {
      const sent = await deliverPaymentCheckoutLink(conv, {
        appointmentId: appointment.id,
        service: appointment.service,
        amountCents,
        resend: true,
      });
      if (sent) {
        awaitingOnlinePayment = true;
      } else {
        await reply(
          conv,
          'We could not generate a payment link right now — you can pay in-store or contact us to pay over the phone.',
        );
      }
    } catch (err) {
      logger.error({ err, appointmentId: appointment.id }, 'post_confirm_payment_failed');
      await reply(
        conv,
        'We could not generate a payment link right now — you can pay in-store or contact us to pay over the phone.',
      );
    }

    if (awaitingOnlinePayment) {
      await saveCtx(conv.id, { pendingAppointmentId: appointment.id, awaitingCashConfirm: undefined }, ConversationStep.IDLE);
      return;
    }
    return;
  }
}

async function handleBookingRating(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'BACK' || upper === 'MENU' || upper === '0' || upper === 'SKIP' || /^skip$/i.test(trimmed)) {
    await goBackToMainMenu(conv);
    return;
  }
  const rating = parseInt(trimmed, 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    await promptBookingRating(conv);
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
    thankYou = 'You just made our day. 🌟 So glad booking felt effortless — we cannot wait to take care of you.';
  } else if (rating === 4) {
    thankYou = 'Thank you — that means a lot. 😊 Smooth bookings are what we aim for every time.';
  } else if (rating === 3) {
    thankYou = 'Appreciate the honesty. We\'re always tuning the experience — your feedback helps.';
  } else {
    thankYou = 'Sorry it wasn\'t smoother — we\'ve flagged this so the team can improve.';
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
  await cancelConversationInactivity(conv.id).catch(() => {});
  await saveCtx(conv.id, {}, ConversationStep.IDLE);
}

async function handleWriteReview(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (isBackToMainMenuCommand(text)) {
    await goBackToMainMenu(conv);
    return;
  }
  const appointmentId = ctx(conv).pendingAppointmentId as string | undefined;
  await getTenantDb().analyticsEvent.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: appointmentId ?? null,
      type: 'written_review',
      payload: { text: text.trim() },
    },
  });
  await cancelConversationInactivity(conv.id).catch(() => {});
  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await replyWithMenu(
    conv,
    `Thank you so much for sharing that with us — we truly appreciate your feedback. 🙏\n\n` +
      `If there's anything else you need, just pick an option from the menu below.`,
  );
}

async function handleManageBooking(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
  const ids = (c.manageList as string[] | undefined) ?? [];

  if (isBackToMainMenuCommand(text)) {
    await goBackToMainMenu(conv);
    return;
  }

  const pendingIdx = c.pendingManageIdx as number | undefined;
  if (pendingIdx != null) {
    const action = text.trim().toLowerCase();
    if (action === 'back' || isBackCommand(text)) {
      await saveCtx(conv.id, { pendingManageIdx: undefined }, ConversationStep.MANAGE_BOOKING);
      await menuActionViewBookings(conv, (c.manageBookingHint as 'view' | 'reschedule' | 'cancel' | undefined) ?? 'view');
      return;
    }
    if (action === 'cancel') {
      await saveCtx(conv.id, { pendingManageIdx: undefined });
      await handleManageBooking(conv, `cancel ${pendingIdx}`);
      return;
    }
    if (action === 'reschedule') {
      await saveCtx(conv.id, { pendingManageIdx: undefined });
      await handleManageBooking(conv, `reschedule ${pendingIdx}`);
      return;
    }
  }

  const bareNum = /^(\d+)$/.exec(text.trim());
  if (bareNum) {
    const idx = parseInt(bareNum[1]!, 10);
    const hint = (c.manageBookingHint as 'view' | 'reschedule' | 'cancel' | undefined) ?? 'view';
    if (hint === 'cancel') {
      await handleManageBooking(conv, `cancel ${idx}`);
      return;
    }
    if (hint === 'reschedule') {
      await handleManageBooking(conv, `reschedule ${idx}`);
      return;
    }
    if (idx >= 1 && idx <= ids.length) {
      const id = ids[idx - 1]!;
      const appt = await getTenantDb().appointment.findFirst({
        where: { id, customerId: conv.customerId },
        include: { service: true, staff: true },
      });
      if (!appt) {
        await reply(conv, 'Booking not found.');
        return;
      }
      await saveCtx(conv.id, { pendingManageIdx: idx }, ConversationStep.MANAGE_BOOKING);
      const dt = DateTime.fromJSDate(appt.start).setZone(conv.salon.timezone);
      const friendlyDate = dt.toFormat('cccc, d MMMM') + ' at ' + dt.toFormat('HH:mm');
      await replyMaybeInteractive(
        conv,
        [
          `*${sanitize(appt.service.name)}*`,
          `with ${sanitize(appt.staff.name)}`,
          friendlyDate,
          '',
          'Cancel or reschedule this booking?',
        ].join('\n'),
        buildManageBookingActionsInteractive(conv.salon),
      );
      return;
    }
  }

  // EC-04: removed $ anchor so trailing whitespace/punctuation doesn't break match
  const cancelMatch = /^cancel\s*(\d+)/i.exec(text.trim());
  const rescheduleMatch = /^reschedule\s*(\d+)/i.exec(text.trim());

  if (cancelMatch) {
    const idx = parseInt(cancelMatch[1]!, 10);
    if (!Number.isFinite(idx) || idx < 1 || idx > ids.length) {
      await reply(conv, 'Invalid booking number. Please try again, or reply *BACK* to go back.');
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
      if (cancelCheck.penaltyApplies) {
        void getTenantDb().appointment.update({
          where: { id: appt.id },
          data: { cancellationPenaltyApplied: true },
        }).catch(() => {});
      }
      await reply(conv, cancelCheck.message);
      return;
    }

    // Show confirmation before cancelling — prevent accidental cancellations
    const dt = DateTime.fromJSDate(appt.start).setZone(conv.salon.timezone);
    const friendlyDate = dt.toFormat('cccc, d MMMM') + ' at ' + dt.toFormat('HH:mm');
    await saveCtx(conv.id, { pendingCancelApptId: appt.id }, ConversationStep.CONFIRM_CANCEL);
    const cancelBody = [
      `⚠️ *Are you sure you want to cancel?*`,
      '',
      `📋 *${sanitize(appt.service.name)}*`,
      `👤 with ${sanitize(appt.staff.name)}`,
      `📅 ${friendlyDate}`,
      '',
      'Reply *YES* to confirm cancellation',
      'Reply *NO* to keep your booking',
    ].join('\n');
    await replyMaybeInteractive(conv, cancelBody, buildConfirmCancelInteractive(conv.salon));
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
    const dateLines = formatDateMenuLines(dates.slice(0, 10));
    const prefix = `🔄 Rescheduling *${sanitize(appt.service.name)}* with ${sanitize(appt.staff.name)}.\n\nPick a new date:`;
    await replyMaybeInteractive(
      conv,
      [prefix, ...dateLines, '', APPOINTMENT_DATE_HINT, 'Reply *BACK* to return to menu.'].join('\n'),
      buildDatePickerInteractive(dates.slice(0, 10), conv.salon.timezone, conv.salon, bookingInteractiveBody(prefix)),
    );
    return;
  }

  const redoMatch = /^(?:redo|choose\s*again|book\s*again|repeat)\s*(\d+)?/i.exec(text.trim());
  if (redoMatch) {
    const pastIds = (c.managePastList as string[] | undefined) ?? [];
    const idx = redoMatch[1] ? parseInt(redoMatch[1], 10) : 1;
    if (!Number.isFinite(idx) || idx < 1 || idx > pastIds.length) {
      await reply(conv, 'Invalid booking number. Please try again, or reply *BACK* to go back.');
      return;
    }
    const id = pastIds[idx - 1]!;
    const appt = await getTenantDb().appointment.findFirst({
      where: { id, customerId: conv.customerId },
      include: { service: true, staff: true },
    });
    if (!appt) {
      await reply(conv, 'Booking not found.');
      return;
    }
    if (!appt.service.active || appt.service.deletedAt || !appt.staff.active || appt.staff.deletedAt) {
      await reply(conv, 'That service or stylist is no longer available — please book from scratch instead.');
      return;
    }

    await saveCtx(
      conv.id,
      {
        selectedServiceId: appt.serviceId,
        selectedStaffId: appt.staffId,
        managingAppointmentId: undefined,
      },
      ConversationStep.PICK_DATE,
    );

    const dates = await suggestBookingDates(conv.salonId);
    const dateLines = formatDateMenuLines(dates.slice(0, 10));
    const prefix = `🔁 Booking *${sanitize(appt.service.name)}* with ${sanitize(appt.staff.name)} again.\n\nPick a date:`;
    await replyMaybeInteractive(
      conv,
      [prefix, ...dateLines, '', APPOINTMENT_DATE_HINT, 'Reply *BACK* to return to menu.'].join('\n'),
      buildDatePickerInteractive(dates.slice(0, 10), conv.salon.timezone, conv.salon, prefix),
    );
    return;
  }

  await reply(conv, [
    "I didn't get that. Here's what you can do:",
    '',
    '• *CANCEL 1* — cancel booking number 1',
    '• *RESCHEDULE 1* — reschedule booking number 1',
    '• *REDO 1* — book a past visit again',
    '• *BACK* — return to main menu',
  ].join('\n'));
}

async function handleConfirmCancel(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const lower = text.trim().toLowerCase();
  const apptId = ctx(conv).pendingCancelApptId as string | undefined;

  if (lower === 'no' || lower === 'n') {
    await saveCtx(conv.id, { pendingCancelApptId: undefined }, ConversationStep.MENU);
    await reply(conv, "No problem! Your booking is still on. 😊\n\n_Type *MENU* to see your options._");
    return;
  }

  if (lower !== 'yes' && lower !== 'y') {
    await replyMaybeInteractive(
      conv,
      'Reply *YES* to confirm cancellation, or *NO* to keep your booking.',
      buildConfirmCancelInteractive(conv.salon),
    );
    return;
  }

  if (!apptId) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await replyMenu(conv);
    return;
  }

  const appt = await getTenantDb().appointment.findFirst({
    where: { id: apptId, customerId: conv.customerId },
    include: { service: true, staff: true },
  });
  if (!appt) {
    await saveCtx(conv.id, { pendingCancelApptId: undefined }, ConversationStep.MENU);
    await replyWithMenu(conv, 'Booking not found — it may have already been cancelled.');
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

  void cancelGoogleReviewForAppointment(appt.id).catch(() => undefined);

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
  }).catch(() => {});

  await saveCtx(conv.id, { pendingCancelApptId: undefined }, ConversationStep.MENU);
  await replyWithMenu(
    conv,
    `✅ Your *${sanitize(appt.service.name)}* appointment has been cancelled. We hope to see you again soon! 😊`,
  );
}

async function handleComplaint(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (isBackToMainMenuCommand(text)) {
    await goBackToMainMenu(conv);
    return;
  }

  await recordSupportTicketMessage({
    salonId: conv.salonId,
    customerId: conv.customerId,
    text,
    subject: 'Support — reported issue',
  });
  await saveCtx(conv.id, PENDING_PROFILE_CLEAR, ConversationStep.MENU);
  const refHint = conv.customer.waId.slice(-4);
  await replyWithMenu(
    conv,
    `✅ Thanks — we've logged your issue (ref ending *${refHint}*). A team member will follow up soon. 🙏`,
  );
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

  if (isBackToMainMenuCommand(text)) {
    await saveCtx(conv.id, { otherQueryAnswered: undefined, otherQueryText: undefined }, ConversationStep.MENU, ctx(conv));
    syncConvContext(conv, { otherQueryAnswered: undefined, otherQueryText: undefined }, ConversationStep.MENU);
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
      await recordSupportTicketMessage({
        salonId: conv.salonId,
        customerId: conv.customerId,
        text: `Customer was not satisfied with AI answer.\nOriginal query: ${(c.otherQueryText as string | undefined) ?? text}`,
        subject: 'Customer needs human help',
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
    const aiResult = await tryAiAssist(conv, text);
    // §4.4/§5 — negative sentiment detected: escalate immediately, skip FAQ loop
    if (aiResult.negativeSentiment) {
      await escalateNegativeSentiment(conv, text);
      return;
    }
    if (aiResult.handled && aiResult.reply) {
      await recordSupportTicketMessage({
        salonId: conv.salonId,
        customerId: conv.customerId,
        text,
        subject: 'Support — speak to reception',
      });
      await saveCtx(conv.id, { otherQueryAnswered: true, otherQueryText: text });
      await reply(conv, aiResult.reply);
      await reply(conv, 'Did that answer your question? Reply YES or NO.');
      return;
    }
  } catch {
    // AI unavailable — fall through to escalation prompt
  }

  await recordSupportTicketMessage({
    salonId: conv.salonId,
    customerId: conv.customerId,
    text,
    subject: 'Support — speak to reception',
  });

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
  if (isBackToMainMenuCommand(text) || upper === '0') {
    await goBackToMainMenu(conv);
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
  const upper = text.trim().toUpperCase();

  if (isBackToMainMenuCommand(text) || upper === 'SKIP') {
    await saveCtx(
      conv.id,
      { ratingSubStep: undefined, ratingStars: undefined, ratingComment: undefined, ratingNps: undefined },
      ConversationStep.MENU,
      ctx(conv),
    );
    syncConvContext(
      conv,
      { ratingSubStep: undefined, ratingStars: undefined, ratingComment: undefined, ratingNps: undefined },
      ConversationStep.MENU,
    );
    await replyMenu(conv);
    return;
  }

  if (subStep === 'stars') {
    const stars = parseInt(text.trim(), 10);
    if (isNaN(stars) || stars < 1 || stars > 5) {
      await replyMaybeInteractive(
        conv,
        buildStarRatingPromptBody(),
        buildStarRatingInteractive(conv.salon),
      );
      return;
    }
    await saveCtx(conv.id, { ratingStars: stars, ratingSubStep: 'comment' });
    const prompt = stars <= 2
      ? `We're sorry to hear that! 😔 What went wrong? Please leave a comment so we can improve:`
      : `Thanks! 😊 Would you like to leave a comment about your experience? (Or reply SKIP to continue)`;
    await replyMaybeInteractive(
      conv,
      prompt,
      stars > 2 ? buildSkipOnlyInteractive(prompt, conv.salon) : null,
    );
    return;
  }

  if (subStep === 'comment') {
    const comment = text.toUpperCase() === 'SKIP' ? '' : text.trim();
    await saveCtx(conv.id, { ratingComment: comment, ratingSubStep: 'nps' });
    const npsBody = buildNpsRatingPromptBody();
    await replyMaybeInteractive(conv, npsBody, buildNpsRatingInteractive(conv.salon));
    return;
  }

  if (subStep === 'nps') {
    const nps = parseInt(text.trim(), 10);
    if (isNaN(nps) || nps < 1 || nps > 10) {
      await replyMaybeInteractive(
        conv,
        buildNpsRatingPromptBody(),
        buildNpsRatingInteractive(conv.salon),
      );
      return;
    }
    await saveCtx(conv.id, { ratingNps: nps, ratingSubStep: 'nps_reason' });
    const prompt = nps <= 6
      ? `What's the main reason for your score? We really want to improve:`
      : `That means a lot! 🙏 What's the main reason for your high score? (Or reply SKIP)`;
    await replyMaybeInteractive(
      conv,
      prompt,
      nps > 6 ? buildSkipOnlyInteractive(prompt, conv.salon) : null,
    );
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
  await replyMaybeInteractive(
    conv,
    buildStarRatingPromptBody(),
    buildStarRatingInteractive(conv.salon),
  );
}

async function handleFaq(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  await runFaqHandler(conv, text, {
    goBackToMainMenu,
    reply,
    replyMaybeInteractive,
  });
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
  if (isBackToMainMenuCommand(text)) {
    await goBackToMainMenu(conv);
    return;
  }

  const c = ctx(conv);
  const branchOptions = (c.branchOptions ?? []) as string[];
  const idx = parseInt(text, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= branchOptions.length) {
    const branches = await getTenantDb().branch.findMany({
      where: { salonId: conv.salonId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    await replyMaybeInteractive(
      conv,
      `Please reply with a number (1-${branchOptions.length}) or BACK.`,
      buildBranchPickerInteractive(branches, conv.salon),
    );
    return;
  }

  const branchId = branchOptions[idx];
  await saveCtx(conv.id, { selectedBranchId: branchId }, ConversationStep.PICK_SERVICE);

  const services = await loadActiveServicesForBooking(conv.salon.id);
  // EC-05: guard against empty service list after branch selection
  if (services.length === 0) {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    const phone = conv.salon.phoneDisplay?.trim();
    const msg = phone
      ? `We don't have any services set up for online booking at this location yet.\n\nYou're welcome to call us on *${phone}* and we'll get you booked in! 😊`
      : `We don't have any services set up for online booking at this location yet. Please contact the salon directly.`;
    await replyWithMenu(conv, msg);
    return;
  }
  const lines = services.map((s, i) => `${i + 1}. ${sanitize(s.name)} (${fmtMoney(s.priceCents)})`);
  const body = ['Pick a service number:', ...lines, '', 'Reply BACK for menu.'].join('\n');
  await replyMaybeInteractive(
    conv,
    body,
    buildServicePickerInteractive(services, 0, SVC_PAGE_SIZE, conv.salon),
  );
}

// ─── Reschedule (legacy RESCHEDULE step — aligned with manage-booking flow) ─
async function handleReschedule(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (text.toUpperCase() === 'CANCEL' || isBackToMainMenuCommand(text)) {
    await goBackToMainMenu(conv);
    return;
  }

  const c = ctx(conv);
  const appointmentId = (c.managingAppointmentId ?? c.rescheduleAppointmentId) as string | undefined;
  if (!appointmentId) {
    await goBackToMainMenu(conv);
    return;
  }

  const appt = await getTenantDb().appointment.findFirst({
    where: {
      id: appointmentId,
      customerId: conv.customerId,
      status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED'] },
    },
    include: { service: true, staff: true },
  });
  if (!appt) {
    await goBackToMainMenu(conv);
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
  const dateLines = formatDateMenuLines(dates.slice(0, 10));
  const prefix = `🔄 Rescheduling *${sanitize(appt.service.name)}* with ${sanitize(appt.staff.name)}.\n\nPick a new date:`;
  await replyMaybeInteractive(
    conv,
    [prefix, ...dateLines, '', APPOINTMENT_DATE_HINT, 'Reply *BACK* to return to menu.'].join('\n'),
    buildDatePickerInteractive(dates.slice(0, 10), conv.salon.timezone, conv.salon, bookingInteractiveBody(prefix)),
  );
}

// ─── CSAT Survey ───────────────────────────────────────────────────────
async function handleCsat(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  if (isBackToMainMenuCommand(text)) {
    await goBackToMainMenu(conv);
    return;
  }

  const rating = parseInt(text.trim(), 10);

  if (isNaN(rating) || rating < 1 || rating > 5) {
    await replyMaybeInteractive(conv, buildStarRatingPromptBody(), buildStarRatingInteractive(conv.salon));
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
      customerWaId: conv.customer.waId,
      appointmentId: appointmentId ?? null,
      googleReviewUrl: conv.salon.googleReviewUrl,
      googleReviewEnabled: reviewSettings.enabled,
      incentiveEnabled: reviewSettings.incentiveEnabled,
      incentiveCents: reviewSettings.incentiveCents,
      marketingConsentStatus: conv.customer.marketingConsentStatus,
      reviewRequestSentAt,
    });
  }

  await cancelConversationInactivity(conv.id).catch(() => {});
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
  return formatCentsZar(cents);
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
