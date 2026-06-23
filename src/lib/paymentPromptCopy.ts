import { formatCentsZar } from './formatPrice.js';
import type { InteractiveCtaUrl } from './integrations/messaging/types.js';

/** Premium body for the post-booking PayFast CTA (bot + dashboard payment link). */
export function buildSecurePaymentPromptBody(
  amountCents: number,
  opts?: { resend?: boolean; serviceName?: string },
): string {
  const amount = formatCentsZar(amountCents);
  const serviceLine = opts?.serviceName?.trim()
    ? `*${opts.serviceName.trim()}* · ${amount}`
    : `*Amount due: ${amount}*`;

  if (opts?.resend) {
    return [
      `💳 *Your secure checkout is ready*`,
      '',
      serviceLine,
      '',
      `Tap below to complete payment on PayFast — encrypted, trusted by millions across South Africa, and usually done in under a minute.`,
      '',
      `_We'll confirm your booking the moment payment clears._`,
    ].join('\n');
  }

  return [
    `💳 *Secure your booking*`,
    '',
    `Your spot is reserved — one elegant step left to lock it in.`,
    '',
    serviceLine,
    '',
    `Tap below for encrypted PayFast checkout. Your card details never touch us — just instant confirmation when payment goes through.`,
    '',
    `_Prefer to pay on arrival? Reply *2* or tap *Cash on arrival* below._`,
  ].join('\n');
}

export function buildPaymentCheckoutCta(body: string, checkoutUrl: string): InteractiveCtaUrl {
  return {
    type: 'cta_url',
    body,
    displayText: 'Pay securely now',
    url: checkoutUrl.trim(),
  };
}

/** Plain-text fallback when checkout session creation fails (no CTA available). */
export function buildPaymentMethodFallbackText(amountCents: number): string {
  const amount = formatCentsZar(amountCents);
  return [
    `💳 *How would you like to pay?*`,
    '',
    `Amount due: *${amount}*`,
    '',
    `*1 — Pay online now* _(recommended)_`,
    `Secure card payment via PayFast — reply *1* and we'll send your checkout link.`,
    '',
    `*2 — Cash at the salon*`,
    `Pay when you arrive.`,
  ].join('\n');
}

export function buildCashPaymentNudgeBody(amountCents: number): string {
  const amount = formatCentsZar(amountCents);
  return [
    `No problem — cash on arrival works beautifully. 💵`,
    '',
    `*Amount due: ${amount}*`,
    '',
    `Before you lock that in, our *recommended* option is PayFast:`,
    `✅ *100% safe* — trusted by millions across South Africa`,
    `✅ Encrypted checkout (we never see your card details)`,
    `✅ Instant confirmation — your slot is fully secured`,
    `✅ No cash to remember on the day — takes ~30 seconds`,
    '',
    `Reply *1* or tap *Pay securely* if we sent a checkout button above`,
    `Reply *CASH* to confirm you'll pay cash when you arrive`,
  ].join('\n');
}

/** Dashboard / manual resend — service name in the prompt. */
export function buildManualPaymentLinkBody(input: {
  salonName?: string;
  serviceName: string;
  amountCents: number;
}): string {
  const amount = formatCentsZar(input.amountCents);
  const salonLine = input.salonName?.trim() ? `*${input.salonName.trim()}*` : `Your booking`;
  return [
    salonLine,
    '',
    `💳 *Complete your payment*`,
    '',
    `*${input.serviceName.trim()}* · ${amount}`,
    '',
    `Tap below for encrypted PayFast checkout — trusted across South Africa, usually under a minute.`,
    '',
    `_We'll confirm your booking the moment payment clears._`,
  ].join('\n');
}
