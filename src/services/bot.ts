import {
  ConversationStep,
  type Conversation,
  type Customer,
  type Salon,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendWhatsAppReply } from '../lib/twilio.js';
import { normalizeWaId } from '../lib/phone.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { DateTime } from 'luxon';
import { getAvailableSlots, getStaffForService, suggestBookingDates } from './slots.js';
import { env } from '../config.js';
import {
  ensureLoyaltyProgram,
  getStampBalance,
  redeemForNextBookingTx,
} from './loyalty.js';
import { createDepositCheckoutSession } from './payments.js';

export type BotContext = Record<string, unknown> & {
  selectedServiceId?: string;
  selectedStaffId?: string;
  localDateStr?: string;
  pendingAppointmentId?: string;
};

const RATE_KEY_PREFIX = 'ratelimit:wa:';

async function rateLimitOrReject(waId: string): Promise<boolean> {
  const key = `${RATE_KEY_PREFIX}${waId}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.pexpire(key, 60_000);
  return n <= 30;
}

function ctx(conv: Conversation): BotContext {
  return (conv.context ?? {}) as BotContext;
}

async function saveCtx(convId: string, patch: Partial<BotContext>, step?: ConversationStep) {
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: convId } });
  const next = { ...ctx(conv), ...patch };
  await prisma.conversation.update({
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
  let sid = outboundSid ?? null;
  if (!sid) {
    sid = await sendWhatsAppReply(conv.customer.waId, text);
  }
  if (sid) {
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        customerId: conv.customerId,
        direction: 'out',
        body: text,
        providerSid: sid,
      },
    });
  } else {
    logger.debug({ to: conv.customer.waId }, 'twilio_not_configured_skip_outbound_persist');
  }
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
}): Promise<void> {
  const waId = normalizeWaId(input.from);
  const text = (input.body ?? '').trim();
  const salon = await prisma.salon.findFirst({ where: { slug: env.DEFAULT_SALON_SLUG } });
  if (!salon) {
    logger.error('no_default_salon');
    return;
  }

  if (!(await rateLimitOrReject(waId))) {
    await sendWhatsAppReply(waId, 'Too many messages — please wait a minute and try again.');
    return;
  }

  let customer = await prisma.customer.findUnique({
    where: { salonId_waId: { salonId: salon.id, waId } },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { salonId: salon.id, waId },
    });
  }

  let conv = await prisma.conversation.findUnique({
    where: { salonId_customerId: { salonId: salon.id, customerId: customer.id } },
    include: { customer: true, salon: true },
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        step: ConversationStep.GREETING,
        context: {},
      },
      include: { customer: true, salon: true },
    });
  } else {
    conv = await prisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
      include: { customer: true, salon: true },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      customerId: customer.id,
      direction: 'in',
      body: text,
      providerSid: input.messageSid,
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      salonId: salon.id,
      customerId: customer.id,
      type: 'whatsapp_inbound',
      payload: { len: text.length },
    },
  });

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
    await prisma.ticket.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        status: 'OPEN',
        subject: 'Human handoff requested',
        messages: {
          create: {
            direction: 'in',
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
    case ConversationStep.MANAGE_BOOKING:
      await handleManageBooking(conv, t);
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
    const services = await prisma.service.findMany({
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
    const upcoming = await prisma.appointment.findMany({
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
    const faqs = await prisma.faqItem.findMany({
      where: { salonId: salon.id },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });
    await saveCtx(conv.id, {}, ConversationStep.FAQ);
    if (faqs.length === 0) {
      await reply(conv, 'No FAQs yet. For hours & address, reply 6 from main menu.');
      return;
    }
    const lines = faqs.map((f, i) => `${i + 1}. ${f.question}`);
    await reply(conv, ['FAQs — reply with a number:', ...lines, '', 'BACK for menu.'].join('\n'));
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
  const services = await prisma.service.findMany({
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
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
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
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });

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
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });
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

  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });
  const start = new Date(slotIso);
  const end = new Date(
    start.getTime() + (service.durationMin + service.bufferMin + staff.breakMin) * 60_000,
  );

  const { appointment, redeem } = await prisma.$transaction(async (tx) => {
    const redeemResult = await redeemForNextBookingTx(tx, {
      salonId: conv.salonId,
      customerId: conv.customerId,
      service,
    });
    const appt = await tx.appointment.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        serviceId: service.id,
        staffId: staff.id,
        start,
        end,
        status: redeemResult.redeemed
          ? 'CONFIRMED'
          : service.depositCents || service.fullPay
            ? 'HELD'
            : 'CONFIRMED',
        loyaltyRedeemed: redeemResult.redeemed,
      },
    });
    await tx.auditLog.create({
      data: {
        action: 'appointment_create',
        entity: 'Appointment',
        entityId: appt.id,
        payload: { source: 'whatsapp' },
      },
    });
    await tx.analyticsEvent.create({
      data: {
        salonId: conv.salonId,
        customerId: conv.customerId,
        appointmentId: appt.id,
        type: 'booking_complete',
        payload: { serviceId: service.id },
      },
    });
    return { appointment: appt, redeem: redeemResult };
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
  const lower = text.toLowerCase();
  if (lower === 'back') {
    await saveCtx(conv.id, {}, ConversationStep.MENU);
    await reply(conv, mainMenu(conv.salon));
    return;
  }

  const m = /^cancel\s*(\d+)$/i.exec(text.trim());
  if (!m) {
    await reply(conv, 'Use: cancel 1 (number from your list), or BACK.');
    return;
  }
  const idx = parseInt(m[1]!, 10);
  if (!Number.isFinite(idx) || idx < 1 || idx > ids.length) {
    await reply(conv, 'Invalid booking number.');
    return;
  }
  const id = ids[idx - 1]!;
  const appt = await prisma.appointment.findFirst({
    where: { id, customerId: conv.customerId },
    include: { service: true, staff: true },
  });
  if (!appt) {
    await reply(conv, 'Booking not found.');
    return;
  }
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: 'CANCELLED' },
  });
  await prisma.analyticsEvent.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      appointmentId: appt.id,
      type: 'booking_cancel',
    },
  });
  await reply(conv, `Cancelled ${appt.service.name}. Main menu:\n${mainMenu(conv.salon)}`);
  await saveCtx(conv.id, {}, ConversationStep.MENU);
}

async function handleComplaint(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
) {
  await prisma.ticket.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      status: 'OPEN',
      subject: 'Complaint',
      messages: { create: { direction: 'in', body: text } },
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
  const faqs = await prisma.faqItem.findMany({
    where: { salonId: conv.salonId },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });
  if (!Number.isFinite(n) || n < 1 || n > faqs.length) {
    await reply(conv, 'Pick a FAQ number or BACK.');
    return;
  }
  const f = faqs[n - 1]!;
  await reply(conv, `${f.question}\n\n${f.answer}`);
}

async function handleLoyalty(
  conv: Conversation & { customer: Customer; salon: Salon },
  _text: string,
) {
  await saveCtx(conv.id, {}, ConversationStep.MENU);
  await reply(conv, mainMenu(conv.salon));
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDt(d: Date, zone: string): string {
  return DateTime.fromJSDate(d).setZone(zone).toFormat('ccc dd LLL yyyy HH:mm');
}
