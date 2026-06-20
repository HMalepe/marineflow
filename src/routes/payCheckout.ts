import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config.js';
import { confirmAppointmentPaid } from '../services/payments.js';

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

export async function payCheckoutRoutes(app: FastifyInstance): Promise<void> {
  app.get('/pay/checkout/:paymentId', { helmet: CHECKOUT_CSP }, async (request, reply) => {
    const { paymentId } = request.params as { paymentId: string };

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

    const inputs = Object.entries(form.fields)
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
      )
      .join('\n');

    const amountZar = (payment.amountCents / 100).toFixed(2);
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to PayFast…</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f1419; color: #e7e9ea; text-align: center; }
      .card { max-width: 28rem; margin: 3rem auto; padding: 2rem; border-radius: 12px; background: #1a2332; }
      button { margin-top: 1rem; padding: 0.75rem 1.5rem; border: 0; border-radius: 8px; background: #c8102e; color: #fff; font-size: 1rem; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Secure payment</h1>
      <p>Amount due: <strong>R ${escapeHtml(amountZar)}</strong></p>
      <p>Redirecting you to PayFast…</p>
      <form id="payfast" method="post" action="${escapeHtml(form.action)}">
        ${inputs}
        <button type="submit">Continue to PayFast</button>
      </form>
    </div>
    <script>document.getElementById('payfast').submit();</script>
  </body>
</html>`;

    return reply.type('text/html').send(html);
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
