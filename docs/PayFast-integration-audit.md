# PayFast integration audit

Read-only audit of how MarineFlow uses PayFast for appointment payments and salon subscriptions. Last updated: June 2026.

## 1. Sandbox vs live

| Setting | Effect |
|---------|--------|
| `PAYFAST_IS_TEST=true` | Sandbox process URL + sandbox credentials (with fallback to live vars) |
| `PAYFAST_IS_TEST=false` (default) | Live process URL + **live credentials only** |
| `NODE_ENV` | **Not** used for PayFast mode selection |

Process URLs (`src/lib/integrations/payments/payfastSignature.ts`):

- Sandbox: `https://sandbox.payfast.co.za/eng/process`
- Live: `https://www.payfast.co.za/eng/process`

### Environment variables

| Variable | Sandbox mode | Live mode |
|----------|--------------|-----------|
| `PAYFAST_SANDBOX_MERCHANT_ID` | Used (fallback: `PAYFAST_MERCHANT_ID`) | Ignored |
| `PAYFAST_SANDBOX_MERCHANT_KEY` | Used (fallback: `PAYFAST_MERCHANT_KEY`) | Ignored |
| `PAYFAST_SANDBOX_PASSPHRASE` | Used (fallback: `PAYFAST_PASSPHRASE`) | Ignored |
| `PAYFAST_MERCHANT_ID` | Fallback only | **Required** |
| `PAYFAST_MERCHANT_KEY` | Fallback only | **Required** |
| `PAYFAST_PASSPHRASE` | Fallback only | Recommended for ITN signature verify |

`isPayfastConfigured()` returns true when `merchantId` and `merchantKey` are non-empty for the active mode (`src/lib/integrations/payments/payfast.ts`).

### Config parsing note

`PAYFAST_IS_TEST` uses `z.coerce.boolean()`. In Zod, the string `"false"` coerces to `true`. Prefer deleting the variable (defaults to live) or using a platform boolean toggle, not the literal string `false` in `.env` files.

---

## 2. Appointment payment flow (WhatsApp bot)

1. Customer completes booking → appointment status `PENDING_PAYMENT`.
2. Bot calls `createPaymentCheckoutSession()` immediately (`src/services/payments.ts`).
3. Customer receives WhatsApp **CTA button** “Pay securely now” → `{PUBLIC_BASE_URL}/pay/checkout/{paymentId}`.
4. Checkout page auto-POSTs signed form to PayFast.
5. PayFast ITN hits `{PUBLIC_BASE_URL}/webhooks/payfast/appointment` → `confirmAppointmentPaid()`.

Dashboard “Send payment link” uses the same checkout session + CTA (`src/api/appointments/send-payment-link.ts`).

### URLs built at checkout creation

| Purpose | URL |
|---------|-----|
| Customer checkout | `{PUBLIC_BASE_URL}/pay/checkout/{paymentId}` |
| return_url | `{PUBLIC_BASE_URL}/pay/success?ref=appt_{appointmentId}` |
| cancel_url | `{PUBLIC_BASE_URL}/pay/cancel?ref=appt_{appointmentId}` |
| notify_url (ITN) | `{PUBLIC_BASE_URL}/webhooks/payfast/appointment` |

### Sandbox-only success fallback

`/pay/success` may call `confirmAppointmentPaid()` when `PAYFAST_IS_TEST=true` because sandbox ITN delivery is unreliable. **Never in live mode** — live confirmation requires signed ITN (`src/routes/payCheckout.ts`).

---

## 3. Subscription billing

Salon subscription checkout uses the same PayFast adapter. ITN path: `{PUBLIC_BASE_URL}/webhooks/payfast/subscription` (`src/services/subscription.ts`, `src/routes/dashboardApi.ts`).

---

## 4. Health check

`GET /healthz` reports:

- `payfast`: `"configured"` | `"unconfigured"` | `"public_url_misconfigured"`
- `publicBaseUrl`: origin derived from `PUBLIC_BASE_URL`

Does **not** expose sandbox vs live. Check logs for `payfast_checkout_create` event `{ sandbox: true/false }`.

---

## 5. Production verification checklist

1. Railway → `PAYFAST_IS_TEST` unset or false (not the string `"false"`).
2. Live `PAYFAST_MERCHANT_ID` / `KEY` / `PASSPHRASE` from payfast.co.za dashboard.
3. `PUBLIC_BASE_URL=https://api.solupair.co.za` (or your API host) — not localhost.
4. `GET /healthz` → `payfast: "configured"`, correct `publicBaseUrl`.
5. Test booking → CTA opens checkout → complete payment → ITN confirms booking.

---

## 6. Key source files

| File | Purpose |
|------|---------|
| `src/lib/integrations/payments/payfast.ts` | Credentials, checkout form, webhook verify |
| `src/lib/integrations/payments/payfastSignature.ts` | MD5 signature, sandbox resolver, URLs |
| `src/services/payments.ts` | Appointment checkout, ITN handler, confirm paid |
| `src/routes/payCheckout.ts` | Checkout redirect page, success/cancel |
| `src/lib/paymentPromptCopy.ts` | Bot + dashboard payment CTA copy |
| `src/services/bot.ts` | Post-booking payment prompt + CTA |
| `src/config.ts` | Env parsing |
