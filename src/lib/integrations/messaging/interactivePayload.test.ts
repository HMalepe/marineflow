import { describe, expect, it } from 'vitest';
import {
  buildCloudInteractivePayload,
  normalizeInteractiveButtons,
  validateInteractiveButtonsPayload,
} from './interactivePayload.js';

describe('interactive button payloads', () => {
  it('normalizes and truncates button titles', () => {
    const normalized = normalizeInteractiveButtons({
      type: 'button',
      body: 'Confirm?',
      buttons: [{ id: 'yes', title: 'Yes, confirm booking' }],
    });
    expect(normalized.buttons[0]!.title.length).toBeLessThanOrEqual(20);
    expect(normalized.buttons[0]!.id).toBe('yes');
  });

  it('rejects more than 3 buttons', () => {
    const errors = validateInteractiveButtonsPayload({
      type: 'button',
      body: 'Pick one',
      buttons: [
        { id: '1', title: 'One' },
        { id: '2', title: 'Two' },
        { id: '3', title: 'Three' },
        { id: '4', title: 'Four' },
      ],
    });
    expect(errors.some((e) => e.includes('max 3'))).toBe(true);
  });

  it('builds Cloud API button payload', () => {
    const payload = buildCloudInteractivePayload({
      type: 'button',
      body: 'Reply YES to confirm.',
      buttons: [
        { id: 'yes', title: 'Yes' },
        { id: 'back', title: 'Back' },
      ],
    });
    expect(payload).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Reply YES to confirm.' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'yes', title: 'Yes' } },
            { type: 'reply', reply: { id: 'back', title: 'Back' } },
          ],
        },
      },
    });
  });

  it('builds Cloud API cta_url payload', () => {
    const payload = buildCloudInteractivePayload({
      type: 'cta_url',
      body: 'Tap below to review us on Google.',
      displayText: 'Leave Google Review',
      url: 'https://g.page/r/test/review',
    });
    expect(payload).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: 'Tap below to review us on Google.' },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: 'Leave Google Review',
            url: 'https://g.page/r/test/review',
          },
        },
      },
    });
  });
});
