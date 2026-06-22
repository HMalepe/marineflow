import { describe, expect, it } from 'vitest';
import { RATING_FEEDBACK_PREAMBLE, withRatingFeedbackPreamble } from './feedbackCopy.js';

describe('feedbackCopy', () => {
  it('withRatingFeedbackPreamble prefixes the standard line', () => {
    const out = withRatingFeedbackPreamble('How was your visit?');
    expect(out).toContain(RATING_FEEDBACK_PREAMBLE);
    expect(out).toContain('How was your visit?');
    expect(out.indexOf(RATING_FEEDBACK_PREAMBLE)).toBeLessThan(out.indexOf('How was your visit?'));
  });

  it('does not double-prefix', () => {
    const once = withRatingFeedbackPreamble('Rate us');
    expect(withRatingFeedbackPreamble(once)).toBe(once);
  });
});
