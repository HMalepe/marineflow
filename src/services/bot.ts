import {
  ConversationStep,
  MessageDirection,
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
import { emitMessageReceived } from '../lib/eventBus.js';
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

export type BotContext = Record<string, unknown> & {
  selectedServiceId?: string;
  selectedStaffId?: string;
  selectedBranchId?: string;
  branchOptions?: string[];
  localDateStr?: string;
  pendingAppointmentId?: string;
  rescheduleAppointmentId?: string;
  csatAppointmentId?: string;
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
  return [
    `Welcome to ${salon.name}! Reply with a number:`,
    '1 — Book an appointment',
    '2 — My bookings',
    '3 — My rewards / loyalty',
    '4 — FAQs',
    '5 — File a complaint',
    '6 — Hours & address',
    '0 — Talk to a human (we will reply soon)',
  ].join('\n');
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

  await withTenantContext(tenant.id, async () => {
    await processInboundWhatsApp(tenant, { waId, text, messageSid: input.messageSid });
  });
}

async function processInboundWhatsApp(
  tenant: ResolvedTenant,
  input: { waId: string; text: string; messageSid: string },
): Promise<void> {
  const { waId, text, messageSid } = input;
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

  const lower = text.toLowerCase();
  if (lower === 'undo' || lower === 'back') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  if (
    lower.includes('human') ||
    lower.includes('talk to') ||
    text === '0'
  ) {
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

  await routeConversation(conv, text);
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
    case ConversationStep.FAQ:
      await handleFaq(conv, t);
      break;
    case ConversationStep.LOYALTY:
      await handleLoyalty(conv, t);
      break;
    case ConversationStep.CSAT:
      await handleCsat(conv, t);
      break;
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
      await reply(conv, 'No services configured yet. Please contact the salon.');
      return;
    }
    const lines = services.map((s, i) => `${i + 1}. ${s.name} (${fmtMoney(s.priceCents)})`);
    await saveCtx(conv.id, {}, ConversationStep.PICK_SERVICE);
    await reply(conv, ['Pick a service number:', ...lines, '', 'Reply BACK for menu.'].join('\n'));
    return;
  }

  if (choice === '2') {
    const upcoming = await getTenantDb().appointment.findMany({
      where: {
        customerId: conv.customerId,
        salonId: salon.id,
        start: { gte: new Date(Date.now() - 86400000) },
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { start: 'asc' },
      include: { service: true, staff: true },
      take: 5,
    });
    if (upcoming.length === 0) {
      await reply(conv, 'No upcoming bookings found.');
      return;
    }
    const lines = upcoming.map((a, i) =>
      [
        `${i + 1}. ${a.service.name}`,
        `   ${fmtDt(a.start, salon.timezone)} with ${a.staff.name}`,
        `   Status: ${a.status} id:${a.id.slice(0, 8)}`,
      ].join('\n'),
    );
    await saveCtx(conv.id, { manageList: upcoming.map((a) => a.id) }, ConversationStep.MANAGE_BOOKING);
    await reply(
      conv,
      [
        'Your bookings:',
        ...lines,
        '',
        'To cancel, reply: cancel 1 (use your booking number), or BACK.',
      ].join('\n'),
    );
    return;
  }

  if (choice === '3') {
    await ensureLoyaltyProgram(salon.id);
    const bal = await getStampBalance(salon.id, conv.customerId);
    await saveCtx(conv.id, {}, ConversationStep.LOYALTY);
    await reply(
      conv,
      [
        `Your loyalty stamps: ${bal.stamps} (earn ${bal.stampsPerReward} for a reward).`,
        'Reply BACK for menu.',
      ].join('\n'),
    );
    return;
  }

  if (choice === '4') {
    const faqs = await getTenantDb().faqItem.findMany({
      where: { salonId: salon.id, status: 'APPROVED' },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });
    await saveCtx(conv.id, {}, ConversationStep.FAQ);
    if (faqs.length === 0) {
      await reply(conv, 'No FAQs yet. For hours & address, reply 6 from main menu.');
      return;
    }
    const lines = faqs.map((f, i) => `${i + 1}. ${f.question}`);
    await reply(conv, ['FAQs — reply with a number, or ask a question:', ...lines, '', 'BACK for menu.'].join('\n'));
    return;
  }

  if (choice === '5') {
    await saveCtx(conv.id, {}, ConversationStep.COMPLAINT);
    await reply(conv, 'Please describe your complaint in one message. Our team will follow up.');
    return;
  }

  if (choice === '6') {
    const lines = [
      salon.name,
      salon.addressLine ?? 'Address on file.',
      salon.phoneDisplay ? `Phone: ${salon.phoneDisplay}` : '',
      salon.parkingNotes ? `Parking: ${salon.parkingNotes}` : '',
      salon.accessibility ? `Accessibility: ${salon.accessibility}` : '',
    ].filter(Boolean);
    await reply(conv, [`${salon.name}:`, ...lines].join('\n'));
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
    await reply(conv, 'Invalid choice. Pick a number from the list or BACK.');
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
    ...staff.map((s, i) => `${i + 1}. ${s.name}`),
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
  const n = parseInt(text, 10);
  const anyIdx = staffList.length + 1;
  if (!Number.isFinite(n) || n < 1 || n > anyIdx) {
    await reply(conv, 'Invalid choice.');
    return;
  }
  let staffId: string;
  if (n === anyIdx) {
    staffId = staffList[0]!.id;
    await saveCtx(conv.id, { selectedStaffId: staffId, anyStaff: true });
  } else {
    staffId = staffList[n - 1]!.id;
    await saveCtx(conv.id, { selectedStaffId: staffId, anyStaff: false });
  }

  const dates = await suggestBookingDates(conv.salonId, 14);
  const lines = dates.slice(0, 10).map((d, i) => `${i + 1}. ${d}`);
  await saveCtx(conv.id, {}, ConversationStep.PICK_DATE);
  await reply(
    conv,
    [
      'Pick a date (next available days):',
      ...lines,
      '',
      'Or type a date YYYY-MM-DD',
      'BACK',
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

  let localDateStr: string | undefined;
  const n = parseInt(text, 10);
  const suggestions = await suggestBookingDates(conv.salonId, 14);
  if (Number.isFinite(n) && n >= 1 && n <= 10) {
    localDateStr = suggestions[n - 1];
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
    localDateStr = text.trim();
  }
  if (!localDateStr) {
    await reply(conv, 'Pick a number from the list or enter YYYY-MM-DD.');
    return;
  }

  const slots = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr,
  });
  if (slots.length === 0) {
    await reply(conv, 'No openings that day. Try another date (YYYY-MM-DD).');
    return;
  }

  await saveCtx(conv.id, { localDateStr }, ConversationStep.PICK_SLOT);
  const lines = slots.slice(0, 8).map((s, i) => {
    const dt = DateTime.fromJSDate(s.start).setZone(conv.salon.timezone);
    return `${i + 1}. ${dt.toFormat('ccc HH:mm')}`;
  });
  await reply(conv, ['Pick a time slot:', ...lines, '', 'BACK'].join('\n'));
}

async function handlePickSlot(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  const c = ctx(conv);
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
  const slots = await getAvailableSlots({
    salonId: conv.salonId,
    service,
    staff,
    localDateStr,
  });
  const n = parseInt(text, 10);
  if (!Number.isFinite(n) || n < 1 || n > Math.min(slots.length, 8)) {
    await reply(conv, 'Invalid slot.');
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
      `${service.name} with ${staff.name}`,
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
  const lower = text.toLowerCase();
  if (lower !== 'yes' && lower !== 'y') {
    await reply(conv, 'Cancelled booking flow. Say BACK or start again with 1.');
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

  const service = await getTenantDb().service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await getTenantDb().staff.findUniqueOrThrow({ where: { id: staffId } });
  const start = new Date(slotIso);
  const end = new Date(
    start.getTime() + (service.durationMin + service.bufferMin + staff.breakMin) * 60_000,
  );

  const slotFree = await validateSlotAvailable({
    salonId: conv.salonId,
    staffId: staff.id,
    start,
    end,
    excludeAppointmentId: (ctx(conv).managingAppointmentId as string | undefined),
  });
  if (!slotFree) {
    await reply(conv, 'Sorry, that time slot was just taken. Please choose another slot (reply BACK to start over).');
    await saveCtx(conv.id, {}, ConversationStep.PICK_SLOT);
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
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return;
    }
    await reply(
      conv,
      'Booking created — payment link unavailable (configure STRIPE_SECRET_KEY). Staff will confirm manually.',
    );
    return;
  }

  await reply(
    conv,
    [
      redeem.redeemed && redeem.note ? `${redeem.note}\n` : '',
      `Booked! Reference: ${appointment.id.slice(0, 8)}`,
      `${service.name} with ${staff.name}`,
      DateTime.fromJSDate(start).setZone(conv.salon.timezone).toFormat('cccc dd LLL yyyy HH:mm'),
    ]
      .filter(Boolean)
      .join('\n'),
  );
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

  const cancelMatch = /^cancel\s*(\d+)$/i.exec(text.trim());
  const rescheduleMatch = /^reschedule\s*(\d+)$/i.exec(text.trim());

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
    await reply(conv, `Cancelled ${appt.service.name} with ${appt.staff.name}.\n\n${mainMenu(conv.salon)}`);
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
    await reply(
      conv,
      `Rescheduling ${appt.service.name} with ${appt.staff.name}.\nPick a new date:\n` +
        dates.map((d, i) => `${i + 1} — ${d}`).join('\n'),
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
  await reply(conv, 'Thanks — we logged your complaint and will respond shortly.');
  await saveCtx(conv.id, {}, ConversationStep.MENU);
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
    await reply(conv, `${f.question}\n\n${f.answer}`);
    return;
  }

  // Semantic search fallback for free-text questions
  try {
    const { semanticSearch } = await import('../lib/integrations/ai/index.js');
    const results = await semanticSearch(conv.salonId, text, { limit: 1, threshold: 0.72 });
    if (results.length > 0) {
      await reply(conv, results[0]!.content);
      return;
    }
  } catch {
    // AI unavailable — fall through to default message
  }

  await reply(conv, "I couldn't find an answer. Pick a FAQ number, ask differently, or reply BACK.");
}

async function handleLoyalty(
  conv: Conversation & { customer: Customer; salon: Salon },
  _text: string,
) {
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
  const lines = services.map((s, i) => `${i + 1}. ${s.name} (${fmtMoney(s.priceCents)})`);
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

function fmtDt(d: Date, zone: string): string {
  return DateTime.fromJSDate(d).setZone(zone).toFormat('ccc dd LLL yyyy HH:mm');
}
