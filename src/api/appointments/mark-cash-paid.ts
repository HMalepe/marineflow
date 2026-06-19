import type { PrismaTx } from '../../lib/db/tenantSession.js';
import { scheduleAppointmentReminders } from '../../services/appointmentReminders.js';
import { notifyAppointmentChangedLater } from '../../services/rosterSync.js';

export type MarkCashPaidResult =
  | { ok: true; status: 'CONFIRMED_PAID'; paymentStatus: 'CASH_PAID' }
  | { ok: false; error: string; message?: string };

/** Mark appointment paid in cash — no PayFast/Stripe. */
export async function markAppointmentCashPaid(
  db: PrismaTx,
  input: { salonId: string; appointmentId: string; actorUserId: string },
): Promise<MarkCashPaidResult> {
  const appt = await db.appointment.findFirst({
    where: { id: input.appointmentId, salonId: input.salonId },
    include: {
      service: { select: { priceCents: true } },
      payments: {
        where: { status: { in: ['PENDING', 'SUCCEEDED'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!appt) {
    return { ok: false, error: 'not_found', message: 'Appointment not found' };
  }

  if (appt.status === 'CONFIRMED_PAID' || appt.payments.some((p) => p.status === 'SUCCEEDED')) {
    return { ok: false, error: 'already_paid', message: 'This booking is already marked as paid' };
  }

  if (appt.status !== 'PENDING_PAYMENT' && appt.status !== 'HELD') {
    return {
      ok: false,
      error: 'invalid_status',
      message: 'Only unpaid bookings can be marked as cash paid',
    };
  }

  const now = new Date();
  const amountCents = appt.service.priceCents;

  await db.payment.updateMany({
    where: { appointmentId: appt.id, status: 'PENDING' },
    data: { status: 'FAILED', failureReason: 'superseded_by_cash_payment' },
  });

  await db.payment.create({
    data: {
      salonId: appt.salonId,
      appointmentId: appt.id,
      customerId: appt.customerId,
      provider: 'MANUAL',
      method: 'CASH',
      status: 'SUCCEEDED',
      amountCents,
      currency: 'ZAR',
      paidAt: now,
      metadata: { paymentStatus: 'CASH_PAID', source: 'dashboard' },
    },
  });

  await db.appointment.update({
    where: { id: appt.id },
    data: { status: 'CONFIRMED_PAID', confirmedAt: now },
  });

  await db.auditLog.create({
    data: {
      salonId: input.salonId,
      actorUserId: input.actorUserId,
      action: 'appointment_cash_paid',
      entity: 'Appointment',
      entityId: appt.id,
      payload: { paymentStatus: 'CASH_PAID', amountCents },
    },
  });

  const updated = await db.appointment.findFirst({
    where: { id: appt.id },
    include: { salon: { select: { metadata: true, timezone: true } } },
  });

  if (updated) {
    notifyAppointmentChangedLater(updated.salonId, updated.id, {
      status: updated.status,
      source: 'dashboard_cash',
    });
    void scheduleAppointmentReminders(updated).catch(() => undefined);
  }

  return { ok: true, status: 'CONFIRMED_PAID', paymentStatus: 'CASH_PAID' };
}
