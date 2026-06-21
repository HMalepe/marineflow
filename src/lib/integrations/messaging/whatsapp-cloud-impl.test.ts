import { describe, expect, it } from 'vitest';
import {
  buildCloudInteractivePayload,
  extractInboundBody,
  whatsappCloudMessaging,
} from './whatsapp-cloud-impl.js';
import {
  buildMainMenuInteractive,
  MAIN_MENU_ROW_IDS_WITH_LOYALTY,
  validateInteractiveListPayload,
} from '../../../services/mainMenuInteractive.js';

function metaWebhookMessage(msg: Record<string, unknown>, phoneId = 'PHONE123') {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: phoneId },
              messages: [msg],
            },
          },
        ],
      },
    ],
  };
}

describe('extractInboundBody', () => {
  it('prefers plain text when present', () => {
    expect(
      extractInboundBody({
        text: { body: 'hello' },
        interactive: { list_reply: { id: '1' } },
      }),
    ).toBe('hello');
  });

  it('reads list_reply id for menu taps', () => {
    expect(
      extractInboundBody({
        interactive: { type: 'list_reply', list_reply: { id: '4', title: 'FAQs' } },
      }),
    ).toBe('4');
  });

  it('reads button_reply id', () => {
    expect(
      extractInboundBody({
        interactive: { type: 'button_reply', button_reply: { id: 'confirm_yes' } },
      }),
    ).toBe('confirm_yes');
  });

  it('trims whitespace from ids and text', () => {
    expect(extractInboundBody({ text: { body: '  1  ' } })).toBe('1');
    expect(extractInboundBody({ interactive: { list_reply: { id: '  2  ' } } })).toBe('2');
  });

  it('returns empty string for unsupported message types', () => {
    expect(extractInboundBody({})).toBe('');
    expect(extractInboundBody({ interactive: { type: 'nfm_reply' } })).toBe('');
  });
});

describe('parseInboundBatch — interactive list replies', () => {
  it('normalises list_reply into body for bot routing', () => {
    const batch = whatsappCloudMessaging.parseInboundBatch(
      metaWebhookMessage({
        id: 'wamid.abc',
        from: '27821234567',
        timestamp: '1710000000',
        interactive: {
          type: 'list_reply',
          list_reply: { id: '1', title: 'Book appointment', description: 'Schedule' },
        },
      }),
    );
    expect(batch).toHaveLength(1);
    expect(batch[0]!.body).toBe('1');
    expect(batch[0]!.fromPhoneE164).toBe('+27821234567');
    expect(batch[0]!.metaPhoneNumberId).toBe('PHONE123');
  });

  it('parses multiple messages in one webhook batch', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'P1' },
                messages: [
                  {
                    id: 'm1',
                    from: '111',
                    timestamp: '1',
                    interactive: { list_reply: { id: '0' } },
                  },
                  {
                    id: 'm2',
                    from: '222',
                    timestamp: '2',
                    text: { body: 'BACK' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const batch = whatsappCloudMessaging.parseInboundBatch(payload);
    expect(batch.map((m) => m.body)).toEqual(['0', 'BACK']);
  });

  it('returns empty array for malformed or status-only payloads', () => {
    expect(whatsappCloudMessaging.parseInboundBatch(null)).toEqual([]);
    expect(whatsappCloudMessaging.parseInboundBatch({})).toEqual([]);
    expect(whatsappCloudMessaging.parseInboundBatch({ entry: [] })).toEqual([]);
  });
});

describe('buildCloudInteractivePayload', () => {
  it('maps main menu to Meta Graph API shape', () => {
    const interactive = buildMainMenuInteractive({
      name: 'Test Salon',
      tradingName: 'Test Salon',
    });
    const payload = buildCloudInteractivePayload(interactive);

    expect(payload.type).toBe('interactive');
    const inner = payload.interactive as Record<string, unknown>;
    expect(inner.type).toBe('list');
    expect(inner.body).toEqual({ text: interactive.body });
    expect(inner.header).toBeUndefined();
    expect(inner.footer).toEqual({ text: interactive.footer });
    expect(inner.action).toMatchObject({
      button: 'View options',
      sections: [
        expect.objectContaining({
          title: 'How can we help you?',
          rows: expect.arrayContaining([expect.objectContaining({ id: '1', title: 'Book an appointment' })]),
        }),
      ],
    });
  });

  it('omits optional header and row description when absent', () => {
    const payload = buildCloudInteractivePayload({
      type: 'list',
      body: 'Body',
      button: 'Menu',
      sections: [{ rows: [{ id: 'a', title: 'Alpha' }] }],
    });
    const inner = payload.interactive as Record<string, unknown>;
    const action = inner.action as { sections: { rows: Record<string, unknown>[] }[] };
    expect(inner.header).toBeUndefined();
    expect(action.sections[0]!.rows[0]).toEqual({ id: 'a', title: 'Alpha' });
  });

  it('throws before send when payload violates Meta limits', () => {
    expect(() =>
      buildCloudInteractivePayload({
        type: 'list',
        body: '',
        button: 'Menu',
        sections: [{ rows: [{ id: '1', title: 'X' }] }],
      }),
    ).toThrow(/Invalid interactive list/);
  });

  it('includes header when provided', () => {
    const payload = buildCloudInteractivePayload({
      type: 'list',
      header: 'Welcome',
      body: 'Body',
      button: 'Menu',
      sections: [{ rows: [{ id: '1', title: 'Go' }] }],
    });
    const inner = payload.interactive as Record<string, unknown>;
    expect(inner.header).toEqual({ type: 'text', text: 'Welcome' });
  });
});

describe('buildMainMenuInteractive — production edge cases', () => {
  it('always validates after normalization', () => {
    const interactive = buildMainMenuInteractive({
      name: 'Salon 💇‍♀️'.repeat(20),
      tradingName: 'Salon',
      welcomeMessage: 'Welcome 👋 '.repeat(500),
    });
    expect(validateInteractiveListPayload(interactive)).toEqual([]);
  });

  it('row ids match six top-level categories', () => {
    const ids = buildMainMenuInteractive({
      name: 'A',
      tradingName: 'A',
    }).sections[0]!.rows.map((r: { id: string }) => r.id);

    expect(ids).toEqual([...MAIN_MENU_ROW_IDS_WITH_LOYALTY]);
  });

  it('stays within WhatsApp 10-row cap', () => {
    const rows = buildMainMenuInteractive({ name: 'X', tradingName: 'X' }).sections[0]!.rows;
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(new Set(rows.map((r: { id: string }) => r.id)).size).toBe(rows.length);
  });
});
