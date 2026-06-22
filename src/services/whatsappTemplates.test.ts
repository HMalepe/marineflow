import { describe, expect, it } from 'vitest';
import type { WhatsappTemplate } from '@prisma/client';
import { serializeWhatsappTemplate } from './whatsappTemplates.js';

function buildTemplate(overrides: Partial<WhatsappTemplate> = {}): WhatsappTemplate {
  return {
    id: 'tpl_1',
    salonId: 'salon_1',
    name: 'Summer Sale',
    category: 'MARKETING',
    language: 'en',
    headerText: 'Summer Sale',
    mediaUrl: null,
    body: '20% off this week only.',
    footer: null,
    buttons: [{ type: 'URL', title: 'Book now', url: 'https://example.com/book' }],
    status: 'DRAFT',
    contentSid: null,
    rejectionReason: null,
    submittedAt: null,
    approvedAt: null,
    createdBy: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  } as WhatsappTemplate;
}

describe('serializeWhatsappTemplate', () => {
  it('serializes dates to ISO strings and passes through fields', () => {
    const shape = serializeWhatsappTemplate(buildTemplate());
    expect(shape.id).toBe('tpl_1');
    expect(shape.createdAt).toBe('2026-06-01T00:00:00.000Z');
    expect(shape.submittedAt).toBeNull();
    expect(shape.buttons).toEqual([{ type: 'URL', title: 'Book now', url: 'https://example.com/book' }]);
  });

  it('defaults buttons to an empty array when not a JSON array', () => {
    const shape = serializeWhatsappTemplate(buildTemplate({ buttons: null as never }));
    expect(shape.buttons).toEqual([]);
  });

  it('passes through approval metadata once submitted', () => {
    const shape = serializeWhatsappTemplate(
      buildTemplate({
        status: 'PENDING',
        submittedAt: new Date('2026-06-02T00:00:00.000Z'),
      }),
    );
    expect(shape.status).toBe('PENDING');
    expect(shape.submittedAt).toBe('2026-06-02T00:00:00.000Z');
  });
});
