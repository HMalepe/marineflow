// Sends Google review request after the visit (45 min after appointment start by default,
// or 15 min after admin marks client departed). Separate from CSAT rating.

import { ConversationStep, MessageDirection, type AppointmentStatus } from '@prisma/client';
import { inngest } from '../client.js';
import { prisma } from '../../prisma.js';
import { sendWithFallback } from '../../../services/channelRouter.js';
import { parseAutomationsFromMetadata } from '../../automationSettings.js';
import {
  prepareGoogleReviewFollowUp,
  shouldSendGoogleReviewFollowUp,
  deliverGoogleReviewRequest,
} from '../../../services/reviewIncentive.js';
import { withRatingFeedbackPreamble } from '../../feedbackCopy.js';

export type GoogleReviewScheduledEvent = {
  data: {
    appointmentId: string;
    salonId: string;
    customerId: string;
    customerWaId: string;
    sendAt: string;
  };
};

export type AppointmentCompletedEvent = {
  data: {
    appointmentId: string;
    salonId: string;
    customerId: string;
    customerWaId: string;
  };
};

const BLOCKED_STATUSES = new Set<AppointmentStatus>(['CANCELLED', 'RESCHEDULED', 'NO_SHOW']);

const PAYMENT_FLOW_STEPS = new Set<ConversationStep>([
  ConversationStep.CHOOSE_PAYMENT_METHOD,
  ConversationStep.BOOKING_RATING,
]);

async function withJobTenant<T>(salonId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, salonId);
  return fn();
}

export const googleReviewRequest = inngest.createFunction(
  {
    id: 'google-review-request',
    retries: 2,
    cancelOn: [{ event: 'whatsapp/google-review.cancelled', match: 'data.appointmentId' }],
    triggers: [{ event: 'whatsapp/google-review.scheduled' }],
  },
  async ({ event, step }) => {
    const { appointmentId, salonId, customerId, customerWaId, sendAt } =
      event.data as GoogleReviewScheduledEvent['data'];

    await step.sleepUntil('wait-until-send', sendAt);

    const result = await step.run('send-review-request', async () =>
      withJobTenant(salonId, async () => {
        const appt = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: { status: true, reviewRequestSentAt: true },
        });
        if (!appt || BLOCKED_STATUSES.has(appt.status)) {
          return { skipped: true, reason: 'invalid_status' };
        }
        if (!customerWaId) return { skipped: true, reason: 'no_wa_id' };

        const salon = await prisma.salon.findUnique({
          where: { id: salonId },
          select: { metadata: true, googleReviewUrl: true, name: true, tradingName: true },
        });
        if (!salon) return { skipped: true, reason: 'salon_not_found' };

        const automations = parseAutomationsFromMetadata(salon.metadata);
        if (!automations.googleReview.enabled || !salon.googleReviewUrl) {
          return { skipped: true, reason: 'disabled_or_no_url' };
        }

        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { firstName: true, marketingConsentStatus: true, deletedAt: true },
        });
        if (!customer || customer.deletedAt) {
          return { skipped: true, reason: 'customer_unavailable' };
        }

        if (
          !shouldSendGoogleReviewFollowUp({
            googleReviewUrl: salon.googleReviewUrl,
            googleReviewEnabled: automations.googleReview.enabled,
            marketingConsentStatus: customer.marketingConsentStatus,
            reviewRequestSentAt: appt.reviewRequestSentAt,
          })
        ) {
          return { skipped: true, reason: 'already_sent_or_consent' };
        }

        const openPayment = await prisma.appointment.findFirst({
          where: {
            salonId,
            customerId,
            status: 'PENDING_PAYMENT',
          },
          select: { id: true },
        });
        if (openPayment) {
          return { skipped: true, reason: 'customer_pending_payment' };
        }

        const conv = await prisma.conversation.findUnique({
          where: { salonId_customerId: { salonId, customerId } },
          select: { step: true },
        });
        if (conv && PAYMENT_FLOW_STEPS.has(conv.step)) {
          return { skipped: true, reason: 'customer_in_payment_flow' };
        }

        const claimed = await prisma.appointment.updateMany({
          where: { id: appointmentId, reviewRequestSentAt: null },
          data: { reviewRequestSentAt: new Date(), googleReviewScheduledAt: null },
        });
        if (claimed.count === 0) {
          return { skipped: true, reason: 'already_sent' };
        }

        const reviewCfg = automations.googleReview;
        const { body: followUpBody, claimUrl } = await prepareGoogleReviewFollowUp({
          salonId,
          customerId,
          appointmentId,
          googleReviewUrl: salon.googleReviewUrl,
          incentiveEnabled: reviewCfg.incentiveEnabled,
          incentiveCents: reviewCfg.incentiveCents,
        });

        const salonName = salon.tradingName ?? salon.name;
        const body =
          `Hi ${customer.firstName ?? 'there'}! Thanks for visiting ${salonName} 😊\n\n` +
          followUpBody +
          `\n\nThank you for supporting us!`;

        try {
          await deliverGoogleReviewRequest({
            salonId,
            to: customerWaId,
            googleReviewUrl: salon.googleReviewUrl,
            incentiveEnabled: reviewCfg.incentiveEnabled,
            incentiveCents: reviewCfg.incentiveCents,
            claimUrl,
            body,
          });
        } catch (err) {
          await prisma.appointment.updateMany({
            where: { id: appointmentId },
            data: { reviewRequestSentAt: null },
          });
          throw err;
        }

        const convRecord = await prisma.conversation.findUnique({
          where: { salonId_customerId: { salonId, customerId } },
        });
        if (convRecord) {
          await prisma.message.create({
            data: {
              conversationId: convRecord.id,
              customerId,
              direction: MessageDirection.OUTBOUND,
              body,
            },
          });
        }

        await prisma.analyticsEvent.create({
          data: {
            salonId,
            customerId,
            appointmentId,
            type: 'google_review_request_sent',
          },
        });

        return { sent: true };
      }),
    );

    return { appointmentId, ...result };
  },
);

export const appointmentRating = inngest.createFunction(
  {
    id: 'appointment-rating',
    retries: 2,
    triggers: [{ event: 'whatsapp/appointment.completed' }],
  },
  async ({ event, step }) => {
    const { appointmentId, salonId, customerId, customerWaId } =
      event.data as AppointmentCompletedEvent['data'];

    await step.sleep('wait-4h', '4h');

    await step.run('send-rating-request', async () =>
      withJobTenant(salonId, async () => {
        const appt = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: {
            id: true,
            salonId: true,
            customerId: true,
            status: true,
            csatSentAt: true,
          },
        });

        if (!appt) return;
        if (appt.csatSentAt !== null) return;
        if (appt.status !== 'COMPLETED') return;
        if (!customerWaId) return;

        const [customer, salon] = await Promise.all([
          prisma.customer.findUnique({
            where: { id: customerId },
            select: { firstName: true },
          }),
          prisma.salon.findUnique({
            where: { id: salonId },
            select: { name: true, tradingName: true, googleReviewUrl: true },
          }),
        ]);

        const firstName = customer?.firstName ?? 'there';
        const salonName = salon?.tradingName ?? salon?.name ?? 'us';

        let body =
          `Hi ${firstName}! We hope you enjoyed your visit to ${salonName} 😊\n\n` +
          withRatingFeedbackPreamble(
            `How would you rate your experience?\n\n` +
              `⭐ 1 – Poor\n` +
              `⭐⭐ 2 – Below average\n` +
              `⭐⭐⭐ 3 – Good\n` +
              `⭐⭐⭐⭐ 4 – Great\n` +
              `⭐⭐⭐⭐⭐ 5 – Excellent\n\n` +
              `Just reply with a number 1–5.`,
          );

        await sendWithFallback({ salonId, to: customerWaId, body });

        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { csatSentAt: new Date() },
        });

        const conv = await prisma.conversation.findUnique({
          where: { salonId_customerId: { salonId, customerId } },
          select: { id: true, context: true },
        });

        if (conv) {
          const existingCtx =
            typeof conv.context === 'object' && conv.context !== null ? conv.context : {};
          await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              step: ConversationStep.CSAT,
              context: { ...(existingCtx as Record<string, unknown>), csatAppointmentId: appointmentId },
              lastMessageAt: new Date(),
            },
          });

          await prisma.message.create({
            data: {
              conversationId: conv.id,
              customerId,
              direction: MessageDirection.OUTBOUND,
              body,
            },
          });
        }
      }),
    );
  },
);
