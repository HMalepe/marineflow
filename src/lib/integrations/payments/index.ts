/**
 * Payment provider abstraction — Week 6 (Ozow/PayFast); Stripe wired today via services/payments.ts.
 */

export type PaymentProviderName = 'stripe' | 'ozow' | 'payfast';

export interface PaymentLink {
  url: string;
  reference: string;
}

export async function createDepositLink(
  _provider: PaymentProviderName,
  _input: { salonId: string; appointmentId: string; amountCents: number },
): Promise<PaymentLink> {
  throw new Error('payment_provider_abstraction_use_services_payments_for_stripe');
}
