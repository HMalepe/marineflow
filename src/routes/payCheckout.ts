import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import { confirmAppointmentPaid } from '../services/payments.js';
import {
  androidChromeIntentUrl,
  isAndroidUserAgent,
  isLikelyInAppBrowser,
} from '../lib/inAppBrowser.js';

function paymentStatusPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f1419; color: #e7e9ea; text-align: center; }
      .card { max-width: 28rem; margin: 3rem auto; padding: 2rem; border-radius: 12px; background: #1a2332; }
    </style>
  </head>
  <body>
    <div class="card">${body}</div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Default helmet CSP (script-src 'self', form-action 'self') silently blocks both
// this page's inline auto-submit script and the POST to PayFast's external domain —
// override it here so the redirect actually fires instead of hanging.
const CHECKOUT_CSP = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      formAction: ["'self'", 'https://www.payfast.co.za', 'https://sandbox.payfast.co.za'],
    },
  },
};

const CHECKOUT_PAGE_CSS = `
      body { font-family: system-ui, sans-serif; padding: 1.5rem; background: #0f1419; color: #e7e9ea; text-align: center; margin: 0; }
      .card { max-width: 28rem; margin: 2rem auto; padding: 1.75rem; border-radius: 12px; background: #1a2332; }
      h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
      p { line-height: 1.45; margin: 0.65rem 0; color: #c8cdd3; }
      .amount { color: #e7e9ea; font-size: 1.05rem; }
      .tip { margin-top: 1.25rem; padding: 0.9rem 1rem; border-radius: 8px; background: #243044; text-align: left; font-size: 0.92rem; }
      .tip strong { color: #fff; }
      .actions { display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1.25rem; }
      a.btn, button { display: block; width: 100%; box-sizing: border-box; padding: 0.85rem 1.25rem; border: 0; border-radius: 8px; font-size: 1rem; cursor: pointer; text-decoration: none; text-align: center; }
      a.btn-primary, button.primary { background: #c8102e; color: #fff; font-weight: 600; }
      a.btn-secondary, button.secondary { background: transparent; color: #e7e9ea; border: 1px solid #3d4f66; }
      .muted { font-size: 0.85rem; color: #9aa3ad; margin-top: 0.75rem; }
`;

function absoluteCheckoutUrl(request: FastifyRequest, paymentId: string, continuePay: boolean): string {
  const base = (env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  if (base) {
    return continuePay
      ? `${base}/pay/checkout/${paymentId}?continue=1`
      : `${base}/pay/checkout/${paymentId}`;
  }
  const host = request.headers.host ?? 'localhost';
  const proto = (request.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const path = continuePay ? `/pay/checkout/${paymentId}?continue=1` : `/pay/checkout/${paymentId}`;
  return `${proto}://${host}${path}`;
}

function buildPayfastFormHtml(
  form: { action: string; fields: Record<string, string> },
  amountZar: string,
  autoSubmit: boolean,
): string {
  const inputs = Object.entries(form.fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join('\n');

  const script = autoSubmit
    ? `<script>document.getElementById('payfast').submit();</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${autoSubmit ? 'Redirecting to PayFast…' : 'Secure payment'}</title>
    <style>${CHECKOUT_PAGE_CSS}</style>
  </head>
  <body>
    <div class="card">
      <h1>Secure payment</h1>
      <p class="amount">Amount due: <strong>R ${escapeHtml(amountZar)}</strong></p>
      <p>${autoSubmit ? 'Redirecting you to PayFast…' : 'Continue to complete payment on PayFast.'}</p>
      <form id="payfast" method="post" action="${escapeHtml(form.action)}">
        ${inputs}
        <div class="actions">
          <button type="submit" class="primary">Continue to PayFast</button>
        </div>
      </form>
    </div>
    ${script}
  </body>
</html>`;
}

function buildAndroidInterstitialHtml(input: {
  amountZar: string;
  chromeIntentUrl: string;
  continueInBrowserAction: string;
  strongInAppWarning: boolean;
}): string {
  const tip = input.strongInAppWarning
    ? `WhatsApp’s built-in browser often shows PayFast branding but <strong>never loads card / Instant EFT options</strong>. Open Chrome to finish payment.`
    : `On Android, PayFast payment options sometimes stay blank inside WhatsApp. Opening <strong>Chrome</strong> usually fixes this.`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open in Chrome to pay</title>
    <style>${CHECKOUT_PAGE_CSS}</style>
  </head>
  <body>
    <div class="card">
      <h1>Secure payment</h1>
      <p class="amount">Amount due: <strong>R ${escapeHtml(input.amountZar)}</strong></p>
      <div class="tip">${tip}</div>
      <div class="actions">
        <a class="btn btn-primary" href="${escapeHtml(input.chromeIntentUrl)}">Open in Chrome to pay</a>
        <a class="btn btn-secondary" href="${escapeHtml(input.continueInBrowserAction)}">Continue in this browser</a>
      </div>
      <p class="muted">Or tap ⋮ (top right) → <strong>Open in browser</strong> / Chrome, then return here if needed.</p>
    </div>
  </body>
</html>`;
}

export async function payCheckoutRoutes(app: FastifyInstance): Promise<void> {
  app.get('/pay/checkout/:paymentId', { helmet: CHECKOUT_CSP }, async (request, reply) => {
    const { paymentId } = request.params as { paymentId: string };
    const query = request.query as { continue?: string };
    const forceContinue = query.continue === '1' || query.continue === 'true';

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, provider: true, metadata: true, amountCents: true },
    });

    if (!payment || payment.status !== 'PENDING' || payment.provider !== 'PAYFAST') {
      return reply.code(404).type('text/html').send(
        '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem"><h1>Payment link expired</h1><p>This link is no longer valid. Return to WhatsApp to request a new payment link.</p></body></html>',
      );
    }

    const meta = (payment.metadata ?? {}) as Record<string, unknown>;
    const form = meta.payfastForm as { action?: string; fields?: Record<string, string> } | undefined;
    if (!form?.action || !form?.fields?.signature) {
      return reply.code(400).type('text/html').send(
        '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem"><h1>Checkout unavailable</h1><p>Please contact the salon for help.</p></body></html>',
      );
    }

    const amountZar = (payment.amountCents / 100).toFixed(2);
    const ua = request.headers['user-agent'] ?? '';
    const android = isAndroidUserAgent(ua);
    const inApp = isLikelyInAppBrowser(ua);

    // Android + WhatsApp (or similar) often reaches PayFast branding but never
    // loads payment methods. Prefer Chrome before POSTing the signed form.
    if (android && !forceContinue) {
      const continueUrl = absoluteCheckoutUrl(request, paymentId, true);
      const chromeUrl = androidChromeIntentUrl(continueUrl);
      return reply.type('text/html').send(
        buildAndroidInterstitialHtml({
          amountZar,
          chromeIntentUrl: chromeUrl,
          continueInBrowserAction: continueUrl,
          strongInAppWarning: inApp,
        }),
      );
    }

    return reply
      .type('text/html')
      .send(
        buildPayfastFormHtml(
          { action: form.action, fields: form.fields },
          amountZar,
          /* autoSubmit */ true,
        ),
      );
  });

  // PayFast redirects the customer's browser here after a successful payment.
  // The real confirmation normally comes from the server-to-server ITN webhook
  // (see services/payments.ts handlePayfastAppointmentWebhook) — this page is
  // just a landing screen. The one exception: in sandbox mode, PayFast's test
  // ITN delivery is unreliable, so as a fallback we treat this redirect itself
  // as proof of payment and run the same confirm logic. Never done in live
  // mode, since this URL carries no signature and could otherwise be replayed.
  app.get('/pay/success', async (request, reply) => {
    const { ref } = request.query as { ref?: string };
    const appointmentId = ref?.startsWith('appt_') ? ref.replace('appt_', '') : null;

    if (appointmentId && env.PAYFAST_IS_TEST) {
      try {
        await confirmAppointmentPaid(appointmentId, null);
      } catch {
        /* webhook may have already confirmed it, or it'll retry — never block this page */
      }
    }

    return reply.type('text/html').send(
      paymentStatusPage(
        'Payment received',
        '<h1>✅ Payment received!</h1><p>Your booking is confirmed. You can close this page and head back to WhatsApp.</p>',
      ),
    );
  });

  app.get('/pay/cancel', async (_request, reply) => {
    return reply.type('text/html').send(
      paymentStatusPage(
        'Payment cancelled',
        '<h1>Payment cancelled</h1><p>No charge was made. Reply on WhatsApp to try again or choose a different payment method.</p>',
      ),
    );
  });
}
