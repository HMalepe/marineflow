import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPopiaRightsHint,
  computeLoyaltyStampTotal,
  deleteCustomerData,
  formatMyDataAccessSummary,
  isDeletedCustomer,
  isPopiaComplianceCommand,
  isPopiaDeleteCommand,
  isPopiaMyDataCommand,
  normalizePopiaCommandText,
  notifyPopiaRightsOnce,
  shouldAttachPopiaRightsHint,
  type CustomerDataExport,
} from './compliance.js';
import { ConversationStep } from '@prisma/client';

const mockDb = vi.hoisted(() => ({
  customerFindFirst: vi.fn(),
  customerUpdate: vi.fn(),
  consentDeleteMany: vi.fn(),
  pushTokenDeleteMany: vi.fn(),
  auditLogCreate: vi.fn(),
  conversationUpdateMany: vi.fn(),
  conversationFindUnique: vi.fn(),
  conversationUpdate: vi.fn(),
}));

vi.mock('../lib/db/tenantSession.js', () => ({
  getTenantDb: () => ({
    customer: {
      findFirst: mockDb.customerFindFirst,
      update: mockDb.customerUpdate,
    },
    consentRecord: { deleteMany: mockDb.consentDeleteMany },
    pushToken: { deleteMany: mockDb.pushTokenDeleteMany },
    auditLog: { create: mockDb.auditLogCreate },
    conversation: {
      updateMany: mockDb.conversationUpdateMany,
      findUnique: mockDb.conversationFindUnique,
      update: mockDb.conversationUpdate,
    },
  }),
}));

const baseCustomer = {
  id: 'cust-1',
  salonId: 'salon-1',
  waId: '+27821234567',
  displayName: 'Thandi M',
  firstName: 'Thandi',
  lastName: 'M',
  email: 't@example.com',
};

describe('normalizePopiaCommandText', () => {
  it('trims and uppercases ASCII', () => {
    expect(normalizePopiaCommandText('  delete  ')).toBe('DELETE');
  });

  it('normalises Unicode compatibility forms', () => {
    // Fullwidth Latin capitals: ＤＥＬＥＴＥ → DELETE under NFKC
    expect(normalizePopiaCommandText('\uFF24\uFF25\uFF2C\uFF25\uFF34\uFF25')).toBe('DELETE');
    expect(normalizePopiaCommandText('ＭＹＤＡＴＡ')).toBe('MYDATA');
  });
});

describe('POPIA command parsers', () => {
  it('detects DELETE exactly — not substrings or phrases', () => {
    expect(isPopiaDeleteCommand('DELETE')).toBe(true);
    expect(isPopiaDeleteCommand('  delete  ')).toBe(true);
    expect(isPopiaDeleteCommand('Delete')).toBe(true);
    expect(isPopiaDeleteCommand('DELETE NOW')).toBe(false);
    expect(isPopiaDeleteCommand('PLEASE DELETE')).toBe(false);
    expect(isPopiaDeleteCommand('')).toBe(false);
    expect(isPopiaDeleteCommand('   ')).toBe(false);
    expect(isPopiaDeleteCommand('MYDATA')).toBe(false);
  });

  it('detects MYDATA exactly', () => {
    expect(isPopiaMyDataCommand('MYDATA')).toBe(true);
    expect(isPopiaMyDataCommand(' mydata ')).toBe(true);
    expect(isPopiaMyDataCommand('MY DATA')).toBe(false);
    expect(isPopiaMyDataCommand('MYDATA PLEASE')).toBe(false);
  });

  it('isPopiaComplianceCommand covers both keywords', () => {
    expect(isPopiaComplianceCommand('DELETE')).toBe(true);
    expect(isPopiaComplianceCommand('MYDATA')).toBe(true);
    expect(isPopiaComplianceCommand('ACCEPT')).toBe(false);
  });

  it('does not treat menu numbers as POPIA commands', () => {
    expect(isPopiaDeleteCommand('1')).toBe(false);
    expect(isPopiaMyDataCommand('0')).toBe(false);
  });
});

describe('isDeletedCustomer', () => {
  it('recognises anonymised customer marker exactly', () => {
    expect(isDeletedCustomer({ displayName: 'Deleted Customer' })).toBe(true);
    expect(isDeletedCustomer({ displayName: 'deleted customer' })).toBe(false);
    expect(isDeletedCustomer({ displayName: '[ERASED]' })).toBe(false);
    expect(isDeletedCustomer({ displayName: null })).toBe(false);
  });
});

describe('computeLoyaltyStampTotal', () => {
  it('sums positive deltas and clamps negatives to zero total', () => {
    expect(computeLoyaltyStampTotal([{ delta: 3 }, { delta: 2 }])).toBe(5);
    expect(computeLoyaltyStampTotal([{ delta: 5 }, { delta: -10 }])).toBe(0);
  });

  it('handles empty ledger', () => {
    expect(computeLoyaltyStampTotal([])).toBe(0);
  });
});

describe('shouldAttachPopiaRightsHint', () => {
  it('includes hint only on first payment when not yet notified', () => {
    expect(shouldAttachPopiaRightsHint({ priorSucceededPayments: 0 })).toBe(true);
    expect(
      shouldAttachPopiaRightsHint({ priorSucceededPayments: 0, popiaRightsNotified: false }),
    ).toBe(true);
  });

  it('skips when customer already paid before or hint was sent', () => {
    expect(shouldAttachPopiaRightsHint({ priorSucceededPayments: 1 })).toBe(false);
    expect(
      shouldAttachPopiaRightsHint({ priorSucceededPayments: 0, popiaRightsNotified: true }),
    ).toBe(false);
    expect(
      shouldAttachPopiaRightsHint({ priorSucceededPayments: 3, popiaRightsNotified: true }),
    ).toBe(false);
  });
});

describe('buildPopiaRightsHint', () => {
  it('mentions MYDATA and DELETE subtly in one line', () => {
    const hint = buildPopiaRightsHint();
    expect(hint).toContain('MYDATA');
    expect(hint).toContain('DELETE');
    expect(hint).toContain('POPIA');
    expect(hint.length).toBeLessThan(200);
  });
});

describe('formatMyDataAccessSummary', () => {
  const activeExport = {
    exportedAt: new Date().toISOString(),
    customer: {
      id: 'c1',
      firstName: 'Thandi',
      lastName: 'M',
      displayName: 'Thandi M',
      email: 'thandi@example.com',
      dateOfBirth: null,
      waId: '+27820000000',
      locale: 'en',
      tags: ['vip'],
      notes: 'prefers mornings',
      source: 'whatsapp',
      marketingConsent: true,
      marketingConsentStatus: 'ACCEPTED' as const,
      marketingConsentAt: null,
      createdAt: new Date(),
    },
    appointments: [{ id: 'a1', date: new Date(), status: 'CONFIRMED' as const, service: 'Cut', staff: 'Sam' }],
    messages: [{ id: 'm1', direction: 'INBOUND' as const, body: 'hello', channel: 'WHATSAPP' as const, date: new Date() }],
    loyaltyActivity: [{ delta: 3, reason: 'visit', date: new Date() }],
    consents: [],
    tickets: [],
    payments: [{ id: 'p1', amountCents: 5000, status: 'SUCCEEDED' as const, provider: 'PAYFAST' as const, createdAt: new Date() }],
  } as CustomerDataExport;

  it('formats export data without leaking waId or message bodies', () => {
    const summary = formatMyDataAccessSummary(activeExport);
    expect(summary).toContain('Thandi M');
    expect(summary).toContain('thandi@example.com');
    expect(summary).toContain('Bookings on record: 1');
    expect(summary).toContain('Loyalty stamps: 3');
    expect(summary).toContain('DELETE');
    expect(summary).not.toContain('+27820000000');
    expect(summary).not.toContain('hello');
    expect(summary).not.toContain('prefers mornings');
  });

  it('uses deleted-customer template without exposing erased PII', () => {
    const summary = formatMyDataAccessSummary({
      ...activeExport,
      customer: {
        ...activeExport.customer,
        firstName: null,
        lastName: null,
        displayName: 'Deleted Customer',
        email: null,
        notes: null,
        tags: [],
      },
      appointments: [
        { id: 'a1', date: new Date(), status: 'CONFIRMED' as const, service: 'Cut', staff: 'Sam' },
        { id: 'a2', date: new Date(), status: 'COMPLETED' as const, service: 'Color', staff: 'Lee' },
      ],
    });

    expect(summary).toContain('personal information has been removed');
    expect(summary).toContain('Bookings on record: 2');
    expect(summary).not.toContain('thandi@example.com');
    expect(summary).toContain('Reply *1*');
  });

  it('survives extreme loyalty ledger values', () => {
    const summary = formatMyDataAccessSummary({
      ...activeExport,
      loyaltyActivity: Array.from({ length: 50 }, () => ({ delta: 1, reason: 'x', date: new Date() })),
    });
    expect(summary).toContain('Loyalty stamps: 50');
  });
});

describe('deleteCustomerData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.consentDeleteMany.mockResolvedValue({ count: 1 });
    mockDb.pushTokenDeleteMany.mockResolvedValue({ count: 0 });
    mockDb.customerUpdate.mockResolvedValue({});
    mockDb.auditLogCreate.mockResolvedValue({});
    mockDb.conversationUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('returns early when customer not found for salon (cross-tenant guard)', async () => {
    mockDb.customerFindFirst.mockResolvedValue(null);
    const result = await deleteCustomerData('cust-1', 'wrong-salon');
    expect(result).toEqual({ alreadyDeleted: false });
    expect(mockDb.customerUpdate).not.toHaveBeenCalled();
  });

  it('anonymises PII, deletes consents/tokens, audits, and resets conversation', async () => {
    mockDb.customerFindFirst.mockResolvedValue(baseCustomer);

    const result = await deleteCustomerData('cust-1', 'salon-1');
    expect(result).toEqual({ alreadyDeleted: false });

    expect(mockDb.consentDeleteMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1', salonId: 'salon-1' },
    });
    expect(mockDb.pushTokenDeleteMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1', salonId: 'salon-1' },
    });
    expect(mockDb.customerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({
          firstName: null,
          lastName: null,
          email: null,
          displayName: 'Deleted Customer',
          preferredStaffId: null,
          dateOfBirth: null,
          marketingConsent: false,
          marketingConsentStatus: 'DECLINED',
        }),
      }),
    );
    expect(mockDb.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'customer_data_deletion',
          entity: 'Customer',
          entityId: 'cust-1',
          payload: expect.objectContaining({ requestedVia: 'whatsapp' }),
        }),
      }),
    );
    expect(mockDb.conversationUpdateMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1', salonId: 'salon-1' },
      data: { step: ConversationStep.GREETING, context: {} },
    });
  });

  it('is idempotent for already-deleted customers — no duplicate audit log', async () => {
    mockDb.customerFindFirst.mockResolvedValue({
      ...baseCustomer,
      displayName: 'Deleted Customer',
      firstName: null,
      email: null,
    });

    const result = await deleteCustomerData('cust-1', 'salon-1');
    expect(result).toEqual({ alreadyDeleted: true });
    expect(mockDb.customerUpdate).not.toHaveBeenCalled();
    expect(mockDb.auditLogCreate).not.toHaveBeenCalled();
    expect(mockDb.conversationUpdateMany).toHaveBeenCalled();
  });
});

describe('notifyPopiaRightsOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends hint once and sets popiaRightsNotified flag', async () => {
    mockDb.conversationFindUnique.mockResolvedValue({
      id: 'conv-1',
      context: { pendingAppointmentId: 'appt-1' },
    });
    mockDb.conversationUpdate.mockResolvedValue({});

    const sendHint = vi.fn().mockResolvedValue(undefined);
    const sent = await notifyPopiaRightsOnce('conv-1', sendHint);

    expect(sent).toBe(true);
    expect(sendHint).toHaveBeenCalledTimes(1);
    expect(mockDb.conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          context: expect.objectContaining({ popiaRightsNotified: true, pendingAppointmentId: 'appt-1' }),
        }),
      }),
    );
  });

  it('skips when already notified', async () => {
    mockDb.conversationFindUnique.mockResolvedValue({
      id: 'conv-1',
      context: { popiaRightsNotified: true },
    });

    const sendHint = vi.fn();
    const sent = await notifyPopiaRightsOnce('conv-1', sendHint);

    expect(sent).toBe(false);
    expect(sendHint).not.toHaveBeenCalled();
    expect(mockDb.conversationUpdate).not.toHaveBeenCalled();
  });

  it('does not mark notified if sendHint throws', async () => {
    mockDb.conversationFindUnique.mockResolvedValue({ id: 'conv-1', context: {} });
    const sendHint = vi.fn().mockRejectedValue(new Error('send failed'));

    await expect(notifyPopiaRightsOnce('conv-1', sendHint)).rejects.toThrow('send failed');
    expect(mockDb.conversationUpdate).not.toHaveBeenCalled();
  });

  it('returns false when conversation missing', async () => {
    mockDb.conversationFindUnique.mockResolvedValue(null);
    const sent = await notifyPopiaRightsOnce('missing', vi.fn());
    expect(sent).toBe(false);
  });
});
