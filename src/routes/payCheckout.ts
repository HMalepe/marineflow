import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function payCheckoutRoutes(app: FastifyInstance): Promise<void> {
  app.get('/pay/checkout/:paymentId', async (request, reply) => {
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
        <noscript><button type="submit">Continue to PayFast</button></noscript>
      </form>
    </div>
    <script>document.getElementById('payfast').submit();</script>
  </body>
</html>`;

    return reply.type('text/html').send(html);
  });
}
