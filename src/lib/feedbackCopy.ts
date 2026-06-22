/**
 * Subtle line shown before star ratings, NPS, and review requests (WhatsApp + automations).
 */
export const RATING_FEEDBACK_PREAMBLE =
  '_We truly value your feedback — it helps us keep refining and improving your experience with us._';

/** Prefix a rating/review prompt; skips if the preamble is already present. */
export function withRatingFeedbackPreamble(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return RATING_FEEDBACK_PREAMBLE;
  if (trimmed.includes('We truly value your feedback')) return trimmed;
  return `${RATING_FEEDBACK_PREAMBLE}\n\n${trimmed}`;
}
