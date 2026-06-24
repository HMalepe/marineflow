import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mergeCustomers } from './customerMerge.js';

function baseCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust_primary',
    salonId: 'salon_1',
    waId: '+27123456789',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: null,
    email: null,
    noShowCount: 1,
    bookingCount: 2,
    reviewCreditCents: 0,
    loyaltyStampsCached: null,
    marketingConsent: false,
    marketingConsentStatus: 'PENDING' as const,
    marketingConsentAt: null,
    tags: [],
    notes: null,
    preferredStaffId: null,
    dateOfBirth: null,
    lastInteractionAt: null,
    ...overrides,
  };
}

function makeDb() {
  const primaryConv = {
    id: 'conv_primary',
    salonId: 'salon_1',
    customerId: 'cust_primary',
    step: 'MENU' as const,
    context: { a: 1 },
    lastMessageAt: new Date('2026-06-01'),
    lastCustomerMessageAt: null,
    resolvedAt: null,
    endedAt: null,
    handoffReason: null,
    messageCount: 3,
  };
  const secondaryConv = {
    id: 'conv_secondary',
    salonId: 'salon_1',
    customerId: 'cust_secondary',
    step: 'HANDOFF' as const,
    context: { b: 2 },
    lastMessageAt: new Date('2026-06-10'),
    lastCustomerMessageAt: new Date('2026-06-10'),
    resolvedAt: null,
    endedAt: null,
    handoffReason: 'help',
    messageCount: 5,
  };

  return {
    conversation: {
      findUnique: vi.fn(async ({ where }: { where: { salonId_customerId: { customerId: string } } }) => {
        if (where.salonId_customerId.customerId === 'cust_primary') return primaryConv;
        if (where.salonId_customerId.customerId === 'cust_secondary') return secondaryConv;
        return null;
      }),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    message: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    appointment: { updateMany: vi.fn(async () => ({ count: 0 })) },
    ticket: { updateMany: vi.fn(async () => ({ count: 0 })) },
    payment: { updateMany: vi.fn(async () => ({ count: 0 })) },
    invoice: { updateMany: vi.fn(async () => ({ count: 0 })) },
    loyaltyLedger: { updateMany: vi.fn(async () => ({ count: 0 })) },
    analyticsEvent: { updateMany: vi.fn(async () => ({ count: 0 })) },
    consentRecord: { updateMany: vi.fn(async () => ({ count: 0 })) },
    waitlistEntry: { updateMany: vi.fn(async () => ({ count: 0 })) },
    referralCode: { updateMany: vi.fn(async () => ({ count: 0 })) },
    reviewIncentiveClaim: { updateMany: vi.fn(async () => ({ count: 0 })) },
    customerMembership: { updateMany: vi.fn(async () => ({ count: 0 })) },
    campaignRecipient: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      delete: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    pushToken: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      delete: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    customer: {
      update: vi.fn(async () => ({})),
    },
    primaryConv,
    secondaryConv,
  };
}

describe('mergeCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges two WhatsApp conversations into one without updateMany on conversation', async () => {
    const db = makeDb();
    const primary = baseCustomer();
    const secondary = baseCustomer({
      id: 'cust_secondary',
      waId: '27123456789',
      firstName: null,
      bookingCount: 4,
    });

    const result = await mergeCustomers(db as never, primary, secondary);

    expect(result.primaryId).toBe('cust_primary');
    expect(db.message.updateMany).toHaveBeenCalled();
    expect(db.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv_primary' },
        data: expect.objectContaining({
          step: 'HANDOFF',
          messageCount: 8,
        }),
      }),
    );
    expect(db.conversation.delete).toHaveBeenCalledWith({ where: { id: 'conv_secondary' } });
    expect(db.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust_secondary' },
        data: expect.objectContaining({ waId: expect.stringMatching(/^merged_/) }),
      }),
    );
    expect(db.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust_primary' },
        data: expect.objectContaining({ bookingCount: 6, waId: '+27123456789' }),
      }),
    );
  });

  it('reassigns lone secondary conversation when primary has none', async () => {
    const db = makeDb();
    db.conversation.findUnique = vi.fn(async ({ where }: { where: { salonId_customerId: { customerId: string } } }) => {
      if (where.salonId_customerId.customerId === 'cust_secondary') return db.secondaryConv;
      return null;
    });

    await mergeCustomers(
      db as never,
      baseCustomer(),
      baseCustomer({ id: 'cust_secondary', waId: '27111111111' }),
    );

    expect(db.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_secondary' },
      data: { customerId: 'cust_primary' },
    });
    expect(db.conversation.delete).not.toHaveBeenCalled();
  });
});
