import type { SubscriptionBillingIssueKind } from '@prisma/client';

export type SubscriptionBillingIssueDto = {
  kind: SubscriptionBillingIssueKind;
  at: string;
  detail: string | null;
};

export function parsePayfastAmountCents(body: Record<string, string>): number | null {
  const raw = body.amount_gross ?? body.amount ?? '';
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

/** Human-readable detail from PayFast ITN body. */
export function payfastFailureDetail(body: Record<string, string>): string {
  const reason = body.reason?.trim();
  if (reason) return reason;

  const status = body.payment_status ?? 'FAILED';
  if (status === 'FAILED') {
    return 'PayFast reported payment failed — often insufficient funds or a declined card.';
  }
  if (status === 'CANCELLED') {
    return 'Customer cancelled on PayFast before completing payment.';
  }
  return `PayFast payment status: ${status}`;
}

export function billingIssueKindFromPayfastStatus(
  paymentStatus: string,
  hadActiveSubscription: boolean,
): SubscriptionBillingIssueKind | null {
  if (paymentStatus === 'FAILED') return 'PAYMENT_DECLINED';
  if (paymentStatus === 'CANCELLED' && !hadActiveSubscription) return 'CHECKOUT_ABANDONED';
  return null;
}

export function toBillingIssueDto(input: {
  kind: SubscriptionBillingIssueKind | null;
  at: Date | null;
  detail: string | null;
}): SubscriptionBillingIssueDto | null {
  if (!input.kind || !input.at) return null;
  return {
    kind: input.kind,
    at: input.at.toISOString(),
    detail: input.detail,
  };
}
