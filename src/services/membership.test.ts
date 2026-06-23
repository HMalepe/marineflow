import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/integrations/payments/payfast.js', () => ({
  isPayfastConfigured: () => true,
  payfastAdapter: {
    verifyWebhook: vi.fn(),
  },
  buildPayfastRecurringCheckoutForm: vi.fn(() => ({
    action: 'https://www.payfast.co.za/eng/process',
    fields: { signature: 'sig' },
  })),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    payment: { findFirst: vi.fn(), updateMany: vi.fn() },
    membershipPlan: { findFirst: vi.fn() },
    customerMembership: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    customer: { findUnique: vi.fn() },
    salon: { findUnique: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { create: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
  },
}));

vi.mock('./channelRouter.js', () => ({
  sendWithFallback: vi.fn(async () => ({ result: { providerMessageId: 'msg_1' } })),
}));

import { payfastAdapter } from '../lib/integrations/payments/payfast.js';
import { handlePayfastMembershipWebhook, formatMembershipPlansMenu } from './membership.js';

describe('formatMembershipPlansMenu', () => {
  it('shows monthly price, visit cap, and savings', () => {
    const text = formatMembershipPlansMenu([
      {
        id: 'p1',
        name: 'VIP 6 Cuts',
        description: 'Big bargain — 10th cut still free via loyalty',
        priceCents: 79900,
        visitsPerMonth: 6,
        savingsCents: 40000,
        active: true,
        sortOrder: 0,
        salonId: 's1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    expect(text).toContain('R799/mo');
    expect(text).toContain('6 cuts');
    expect(text).toContain('R400');
    expect(text).toContain('PayFast');
  });
});

describe('handlePayfastMembershipWebhook', () => {
  it('ignores non-membership references', async () => {
    vi.mocked(payfastAdapter.verifyWebhook).mockReturnValue({
      valid: true,
      reference: 'appt_abc',
      status: 'success',
    });
    await handlePayfastMembershipWebhook({ m_payment_id: 'appt_abc', payment_status: 'COMPLETE' });
    expect(payfastAdapter.verifyWebhook).toHaveBeenCalled();
  });

  it('ignores invalid signatures', async () => {
    vi.mocked(payfastAdapter.verifyWebhook).mockReturnValue({
      valid: false,
      reference: 'mem_abc',
    });
    await handlePayfastMembershipWebhook({ m_payment_id: 'mem_abc' });
  });
});
