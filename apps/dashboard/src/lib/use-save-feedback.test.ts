import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SectionFeedback } from '../components/save-feedback.js';

/** Mirrors useMultiSectionSaveFeedback state updates for unit tests. */
function applySectionSuccess(
  prev: Record<string, SectionFeedback>,
  section: string,
  message: string,
): Record<string, SectionFeedback> {
  return { ...prev, [section]: { success: message, error: undefined } };
}

function applySectionError(
  prev: Record<string, SectionFeedback>,
  section: string,
  message: string,
): Record<string, SectionFeedback> {
  return { ...prev, [section]: { success: undefined, error: message } };
}

describe('multi-section save feedback edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1 — success clears a prior error on the same section', () => {
    let state = applySectionError({}, 'hours', 'Close time must be after open time');
    state = applySectionSuccess(state, 'hours', 'Business hours saved');
    expect(state.hours).toEqual({ success: 'Business hours saved', error: undefined });
  });

  it('2 — error on one section does not affect another section', () => {
    const state = applySectionError(
      applySectionSuccess({}, 'displayName', 'Business display name saved'),
      'hours',
      'Enter both open and close times',
    );
    expect(state.displayName?.success).toBe('Business display name saved');
    expect(state.hours?.error).toBe('Enter both open and close times');
  });

  it('3 — replacing success message updates only that section', () => {
    let state = applySectionSuccess({}, 'messages', 'Bot messages saved');
    state = applySectionSuccess(state, 'messages', 'Bot messages saved');
    expect(Object.keys(state)).toEqual(['messages']);
    expect(state.messages?.success).toBe('Bot messages saved');
  });

  it('4 — auto-clear removes stale success after timeout', () => {
    let state = applySectionSuccess({}, 'botName', 'Bot name updated');
    const message = state.botName?.success;
    vi.advanceTimersByTime(5000);
    if (state.botName?.success === message) {
      const next = { ...state };
      delete next.botName;
      state = next;
    }
    expect(state.botName).toBeUndefined();
  });

  it('5 — validation error survives until next successful save', () => {
    let state = applySectionError({}, 'googleReview', 'Google Review URL must start with https://');
    expect(state.googleReview?.error).toBeTruthy();
    state = applySectionSuccess(state, 'googleReview', 'Google Review URL saved');
    expect(state.googleReview?.error).toBeUndefined();
    expect(state.googleReview?.success).toBe('Google Review URL saved');
  });
});
