import { ConversationStep } from '@prisma/client';

/** Greetings and keywords that should wake the bot from a silent staff handoff. */
export const MENU_WAKE_PATTERN =
  /^(hi+!*|\?|hello!*|hey!*|howzit!*|menu|start|restart|help|yo)$/i;

/** Steps where "hi"/"menu" should not wipe in-progress work. */
export const WAKE_RESET_EXCLUDED_STEPS = new Set<ConversationStep>([
  ConversationStep.COMPLAINT,
  ConversationStep.OTHER_QUERY,
  ConversationStep.HANDOFF,
  ConversationStep.CONFIRM_CANCEL,
  ConversationStep.RATE_EXPERIENCE,
  ConversationStep.WRITE_REVIEW,
  ConversationStep.CSAT,
  ConversationStep.BOOKING_RATING,
  ConversationStep.HANDOFF_RATING,
]);

export function shouldResetConversationOnWake(step: ConversationStep): boolean {
  return !WAKE_RESET_EXCLUDED_STEPS.has(step);
}

export function isConversationWakeMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (MENU_WAKE_PATTERN.test(t)) return true;
  // Short casual greetings: "hi there", "hello!"
  if (/^(hi|hello|hey|howzit)\b/i.test(t) && t.length <= 24) return true;
  return false;
}

/** Staff handoff auto-expires after 4 hours without conversation activity. */
export function staffHandoffExpired(
  lastMessageAt: Date | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!lastMessageAt) return true;
  const hoursSince = (nowMs - lastMessageAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 4;
}
