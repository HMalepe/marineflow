import { DateTime } from 'luxon';
import { ConversationStep, MessageDirection } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { getAvailableSlots, suggestBookingDates } from './slots.js';
import { sendWithFallback } from './channelRouter.js';
import { logger } from '../lib/logger.js';

function sanitize(s: string): string {
  return s.replace(/[*_~`[\]]/g, '');
}

/**
 * After one booking in a multi-person request (e.g. "myself and my son") is
 * confirmed/paid, automatically start the next person's booking — same
 * service/staff, next available slot after the one just booked — and prompt
 * the customer to confirm it, rather than making them re-type the request.
 */
export async function startNextChainedBooking(input: {
  salonId: string;
  customerId: string;
  serviceId: string;
  staffId: string;
  afterStart: Date;
  remaining: number;
}): Promise<void> {
  if (input.remaining <= 0) return;
  const db = getTenantDb();

  const [salon, customer, service, staff] = await Promise.all([
    db.salon.findUnique({ where: { id: input.salonId } }),
    db.customer.findUnique({ where: { id: input.customerId } }),
    db.service.findUnique({ where: { id: input.serviceId } }),
    db.staff.findUnique({ where: { id: input.staffId } }),
  ]);
  if (!salon || !customer?.waId || !service || !staff) return;

  const conv = await db.conversation.findUnique({
    where: { salonId_customerId: { salonId: input.salonId, customerId: input.customerId } },
  });
  if (!conv) return;

  const dates = await suggestBookingDates(input.salonId, 14);
  let matched: { start: Date; end: Date } | undefined;
  let matchedDateStr: string | undefined;
  for (const localDateStr of dates) {
    const { slots, tooLong } = await getAvailableSlots({ salonId: input.salonId, service, staff, localDateStr });
    if (tooLong) continue;
    const next = slots.find((s) => s.start.getTime() >= input.afterStart.getTime());
    if (next) {
      matched = next;
      matchedDateStr = localDateStr;
      break;
    }
  }

  const currentCtx = (conv.context ?? {}) as Record<string, unknown>;

  if (!matched || !matchedDateStr) {
    await db.conversation.update({
      where: { id: conv.id },
      data: { step: ConversationStep.MENU, context: { ...currentCtx, pendingExtraBookings: undefined } as object },
    });
    const body =
      "I couldn't find another open slot for the next booking right away — reply *MENU* and pick a time for the next person whenever you're ready.";
    let sid: string | null = null;
    try {
      const { result } = await sendWithFallback({ salonId: input.salonId, to: customer.waId, body });
      sid = result.providerMessageId ?? null;
    } catch (err) {
      logger.warn({ err, salonId: input.salonId, customerId: input.customerId }, 'chained_booking_no_slot_notice_failed');
    }
    await db.message.create({
      data: { conversationId: conv.id, customerId: input.customerId, direction: MessageDirection.OUTBOUND, body, providerSid: sid },
    });
    return;
  }

  const dt = DateTime.fromJSDate(matched.start).setZone(salon.timezone);
  await db.conversation.update({
    where: { id: conv.id },
    data: {
      step: ConversationStep.CONFIRM_BOOKING,
      context: {
        ...currentCtx,
        selectedServiceId: service.id,
        selectedStaffId: staff.id,
        localDateStr: matchedDateStr,
        slotStartIso: matched.start.toISOString(),
        quickPickOptions: undefined,
        partySize: undefined,
        pendingExtraBookings: input.remaining - 1,
      } as object,
    },
  });

  const body = [
    `Now let's get the next booking sorted:`,
    `${sanitize(service.name)} with ${sanitize(staff.name)}`,
    dt.toFormat('cccc, dd LLL yyyy HH:mm'),
    '',
    'Reply YES to confirm, or BACK to choose another time.',
  ].join('\n');

  let sid: string | null = null;
  try {
    const { result } = await sendWithFallback({ salonId: input.salonId, to: customer.waId, body });
    sid = result.providerMessageId ?? null;
  } catch (err) {
    logger.warn({ err, salonId: input.salonId, customerId: input.customerId }, 'chained_booking_prompt_failed');
  }
  await db.message.create({
    data: { conversationId: conv.id, customerId: input.customerId, direction: MessageDirection.OUTBOUND, body, providerSid: sid },
  });
}
