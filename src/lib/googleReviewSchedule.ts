import type { AppointmentStatus } from '@prisma/client';
import { prisma } from './prisma.js';
import { inngest } from './inngest/client.js';
import { logger } from './logger.js';

/** Default: send Google review request this many minutes after confirmed appointment start. */
export const DEFAULT_MINUTES_AFTER_START = 45;

/** When admin marks client departed: send review this many minutes later. */
export const MINUTES_AFTER_DEPARTURE = 15;

const SCHEDULABLE_STATUSES: AppointmentStatus[] = ['CONFIRMED', 'CONFIRMED_PAID', 'COMPLETED'];

const BLOCKED_STATUSES: AppointmentStatus[] = ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'];

export function computeDefaultGoogleReviewSendAt(appointmentStart: Date): Date {
  const sendAt = new Date(appointmentStart.getTime() + DEFAULT_MINUTES_AFTER_START * 60_000);
  const minFuture = new Date(Date.now() + 2 * 60_000);
  return sendAt.getTime() > minFuture.getTime() ? sendAt : minFuture;
}

export function computeGoogleReviewSendAtAfterDeparture(departedAt: Date = new Date()): Date {
  return new Date(departedAt.getTime() + MINUTES_AFTER_DEPARTURE * 60_000);
}

export async function cancelGoogleReviewForAppointment(appointmentId: string): Promise<void> {
  await inngest
    .send({
      name: 'whatsapp/google-review.cancelled',
      data: { appointmentId },
    })
    .catch((err) => {
      logger.warn({ err, appointmentId }, 'google_review_cancel_event_failed');
    });

  await prisma.appointment.updateMany({
    where: { id: appointmentId },
    data: { googleReviewScheduledAt: null },
  });
}

async function emitGoogleReviewScheduled(params: {
  appointmentId: string;
  salonId: string;
  customerId: string;
  customerWaId: string;
  sendAt: Date;
}): Promise<void> {
  await prisma.appointment.update({
    where: { id: params.appointmentId },
    data: { googleReviewScheduledAt: params.sendAt },
  });

  await inngest.send({
    name: 'whatsapp/google-review.scheduled',
    data: {
      appointmentId: params.appointmentId,
      salonId: params.salonId,
      customerId: params.customerId,
      customerWaId: params.customerWaId,
      sendAt: params.sendAt.toISOString(),
    },
  });
}

export async function scheduleGoogleReviewAt(
  appointmentId: string,
  sendAt: Date,
): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { customer: { select: { waId: true } } },
  });
  if (!appt) return;
  if (appt.reviewRequestSentAt) return;
  if (!SCHEDULABLE_STATUSES.includes(appt.status)) return;
  if (BLOCKED_STATUSES.includes(appt.status)) return;
  if (!appt.customer.waId?.trim()) return;

  await cancelGoogleReviewForAppointment(appointmentId);

  const minFuture = new Date(Date.now() + 60_000);
  const effectiveSendAt = sendAt.getTime() > minFuture.getTime() ? sendAt : minFuture;

  await emitGoogleReviewScheduled({
    appointmentId: appt.id,
    salonId: appt.salonId,
    customerId: appt.customerId,
    customerWaId: appt.customer.waId,
    sendAt: effectiveSendAt,
  });
}

/** Schedule review at appointment start + 45 min (or soon if that time has passed). */
export async function scheduleGoogleReviewForAppointment(appointmentId: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { start: true },
  });
  if (!appt) return;
  await scheduleGoogleReviewAt(appointmentId, computeDefaultGoogleReviewSendAt(appt.start));
}

/** Reschedule review to 15 minutes after the client leaves (admin tap). */
export async function scheduleGoogleReviewAfterDeparture(appointmentId: string): Promise<void> {
  await scheduleGoogleReviewAt(appointmentId, computeGoogleReviewSendAtAfterDeparture());
}
