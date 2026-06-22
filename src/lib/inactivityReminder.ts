import { ConversationStep } from '@prisma/client';

/** Steps where a "still there?" nudge is appropriate — mid-booking only. */
export const INACTIVITY_REMINDER_STEPS = new Set<ConversationStep>([
  ConversationStep.COLLECT_FIRST_NAME,
  ConversationStep.COLLECT_LAST_NAME,
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
  ConversationStep.CHOOSE_PAYMENT_METHOD,
  ConversationStep.BOOKING_RATING,
  ConversationStep.MANAGE_BOOKING,
  ConversationStep.RESCHEDULE,
  ConversationStep.CONFIRM_CANCEL,
]);

export function shouldScheduleInactivityReminder(step: ConversationStep): boolean {
  return INACTIVITY_REMINDER_STEPS.has(step);
}
