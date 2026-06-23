import { DateTime } from 'luxon';
import type { AppointmentStatus, Conversation, Customer, Salon, Service, Staff } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { logger } from '../lib/logger.js';
import { getAvailableSlots, validateSlotAvailable } from './slots.js';
import { computeAppointmentEnd } from './botPowerFeatures.js';
import { redeemForNextBookingTx } from './loyalty.js';
import { applyReviewCreditTx } from './reviewIncentive.js';
import { incrementCustomerBookingCount } from './noShowRisk.js';
import { notifyAppointmentBookedLater, notifyAppointmentChangedLater } from './rosterSync.js';
import { emitPlatformEvent } from './platformEvents.js';
import { sendWithFallback } from './channelRouter.js';
import { resolvePostConfirmPayment, salonRequiresPostConfirmPayment } from './payments.js';

/** Strip WhatsApp markdown control characters from user-supplied names. */
function sanitize(s: string): string {
  return s.replace(/[*_~`[\]]/g, '');
}

export type CreateConfirmedAppointmentInput = {
  conv: Conversation & { customer: Customer; salon: Salon };
  service: Service;
  staff: Staff;
  start: Date;
  addonIds?: string[];
  partySize?: number;
  /** Existing appointment being rescheduled — cancelled once the new one is created. */
  reschedulingId?: string | null;
  /** True when the customer did not explicitly name this stylist (auto-assigned). */
  anyStaff?: boolean;
};

export type CreateConfirmedAppointmentResult =
  | {
      ok: true;
      appointment: { id: string; status: AppointmentStatus; salonId: string; start: Date };
      end: Date;
      paymentPlan: { amountCents: number } | null;
      isFirstBooking: boolean;
      bookingNotes: string;
    }
  | { ok: false; reason: 'salon_suspended' }
  | { ok: false; reason: 'slot_taken'; freshSlots: { start: Date; end: Date }[] }
  | { ok: false; reason: 'customer_overlap'; overlapServiceName: string; overlapStart: Date };

/**
 * Core appointment-creation path shared by the explicit "Reply YES" confirm flow
 * and the AI-assist instant-confirm flow — guardrails (salon status, advisory
 * lock, slot re-validation, customer double-booking check) run identically for
 * both, so neither caller can skip them.
 */
export async function createConfirmedAppointment(
  input: CreateConfirmedAppointmentInput,
): Promise<CreateConfirmedAppointmentResult> {
  const { conv, service, staff, start } = input;
  const addonIds = input.addonIds ?? [];
  const reschedulingId = input.reschedulingId ?? null;

  // EC-17: Re-check salon status in case it was suspended after the booking flow started
  const freshSalon = await getTenantDb().salon.findUniqueOrThrow({ where: { id: conv.salonId } });
  if (freshSalon.status === 'SUSPENDED' || freshSalon.status === 'CHURNED') {
    return { ok: false, reason: 'salon_suspended' };
  }

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
    excludeAppointmentId: reschedulingId ?? undefined,
  });
  if (!slotFree) {
    const localDateStr = DateTime.fromJSDate(start).setZone(conv.salon.timezone).toISODate()!;
    const { slots: freshSlots } = await getAvailableSlots({ salonId: conv.salonId, service, staff, localDateStr });
    return { ok: false, reason: 'slot_taken', freshSlots };
  }

  // EC-DUP: Prevent customer from booking two overlapping appointments
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
    return {
      ok: false,
      reason: 'customer_overlap',
      overlapServiceName: customerOverlap.service.name,
      overlapStart: customerOverlap.start,
    };
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

  const isFirstSalonBooking = (await tx.appointment.count({ where: { salonId: conv.salonId } })) === 0;

  const appointment = await tx.appointment.create({
    data: {
      salonId: conv.salonId,
      customerId: conv.customerId,
      serviceId: service.id,
      staffId: staff.id,
      start,
      end,
      addonServiceIds: addonIds,
      partySize: input.partySize ?? 1,
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
  }

  // Notify owner on new booking — best-effort, never blocks booking
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
  // explicitly chose them this booking.
  if (!input.anyStaff && !reschedulingId) {
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

  const bookingNotes = [redeem.note, reviewCredit.note].filter(Boolean).join('\n');

  return { ok: true, appointment, end, paymentPlan, isFirstBooking, bookingNotes };
}
