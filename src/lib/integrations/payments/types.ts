export interface CreateCheckoutInput {
  salonId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  reference: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  description?: string;
  metadata?: Record<string, string>;
  /** Pre-fills PayFast's "How can we get hold of you?" step so returning customers skip it. */
  nameFirst?: string;
  nameLast?: string;
  emailAddress?: string;
  cellNumber?: string;
}

export interface CheckoutResult {
  redirectUrl: string;
  externalReference: string;
  /** POST form fields for hosted checkout page (preferred over GET redirectUrl). */
  form?: { action: string; fields: Record<string, string> };
}

export interface WebhookVerifyResult {
  valid: boolean;
  transactionId?: string;
  reference?: string;
  status?: 'success' | 'failed' | 'pending' | 'cancelled';
  amountCents?: number;
}

export interface PaymentProviderAdapter {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(payload: unknown, headers: Record<string, string | undefined>): WebhookVerifyResult;
}
