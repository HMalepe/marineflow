import { describe, expect, it } from 'vitest';
import { ConversationStep } from '@prisma/client';
import {
  INACTIVITY_REMINDER_STEPS,
  shouldScheduleInactivityReminder,
} from './inactivityReminder.js';

describe('inactivityReminder', () => {
  it('allows reminders only during booking-related steps', () => {
    expect(shouldScheduleInactivityReminder(ConversationStep.PICK_SERVICE)).toBe(true);
    expect(shouldScheduleInactivityReminder(ConversationStep.CHOOSE_PAYMENT_METHOD)).toBe(true);
    expect(shouldScheduleInactivityReminder(ConversationStep.BOOKING_RATING)).toBe(true);
    expect(shouldScheduleInactivityReminder(ConversationStep.MANAGE_BOOKING)).toBe(true);
  });

  it('blocks reminders after booking flow is done', () => {
    expect(shouldScheduleInactivityReminder(ConversationStep.MENU)).toBe(false);
    expect(shouldScheduleInactivityReminder(ConversationStep.IDLE)).toBe(false);
    expect(shouldScheduleInactivityReminder(ConversationStep.WRITE_REVIEW)).toBe(false);
    expect(shouldScheduleInactivityReminder(ConversationStep.CSAT)).toBe(false);
    expect(shouldScheduleInactivityReminder(ConversationStep.HANDOFF)).toBe(false);
  });

  it('includes payment and booking rating in eligible steps', () => {
    expect(INACTIVITY_REMINDER_STEPS.has(ConversationStep.CHOOSE_PAYMENT_METHOD)).toBe(true);
    expect(INACTIVITY_REMINDER_STEPS.has(ConversationStep.BOOKING_RATING)).toBe(true);
  });
});
