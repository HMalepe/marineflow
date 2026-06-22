# PUBLIC_BASE_URL usage audit

`PUBLIC_BASE_URL` is the **public HTTPS origin of the API server**. PayFast, Inngest, and customer-facing checkout links all depend on it being correct in production.

Default (development): `http://localhost:3000` (`src/config.ts`).

Production example: `https://api.solupair.co.za`

---

## Where it is used

### PayFast appointment payments

`src/services/payments.ts` — `createPaymentCheckoutSession()`:

| Field | URL |
|-------|-----|
| Customer link | `{PUBLIC_BASE_URL}/pay/checkout/{paymentId}` |
| return_url | `{PUBLIC_BASE_URL}/pay/success?ref=appt_{id}` |
| cancel_url | `{PUBLIC_BASE_URL}/pay/cancel?ref=appt_{id}` |
| notify_url | `{PUBLIC_BASE_URL}/webhooks/payfast/appointment` |

Dashboard resend: `src/api/appointments/send-payment-link.ts` (same checkout URL pattern).

### PayFast subscription billing

- `src/services/subscription.ts` — subscription checkout return/cancel/notify URLs
- `src/routes/dashboardApi.ts` — subscription notify URL

### Health / misconfiguration detection

`src/app.ts` — `GET /healthz`:

- If `NODE_ENV=production` and `PUBLIC_BASE_URL` contains `localhost` → `payfast: "public_url_misconfigured"`
- Response includes `publicBaseUrl` (parsed origin) for quick verification

### Inngest (delayed jobs)

`src/app.ts` — when not in dev and URL is not localhost:

- `serveOrigin` = origin of `PUBLIC_BASE_URL`
- `servePath` = `/api/inngest`

`src/lib/inngest/selfRegister.ts` — skips Inngest resync if `PUBLIC_BASE_URL` is localhost.

---

## What breaks if misconfigured

| Symptom | Likely cause |
|---------|--------------|
| PayFast checkout opens but booking never confirms | ITN sent to wrong host (localhost or old domain) |
| `/healthz` shows `public_url_misconfigured` | `PUBLIC_BASE_URL` still localhost in production |
| Inngest jobs never run | Wrong `serveOrigin` or missing signing key |
| Payment links in WhatsApp 404 | `PUBLIC_BASE_URL` points at dashboard, not API |

---

## Related env vars (not the same)

| Variable | Purpose |
|----------|---------|
| `PUBLIC_BASE_URL` | API origin — PayFast, checkout, Inngest |
| `TWILIO_WEBHOOK_BASE_URL` | Twilio WhatsApp webhook callbacks |
| `DASHBOARD_URL` | Dashboard app origin (optional) |

WhatsApp inbound webhooks use `TWILIO_WEBHOOK_BASE_URL`, not `PUBLIC_BASE_URL`.

---

## Production checklist

1. Set `PUBLIC_BASE_URL` to the **API** domain (e.g. `https://api.solupair.co.za`).
2. Confirm `GET https://api.example.com/healthz` → `publicBaseUrl` matches.
3. Confirm PayFast merchant dashboard ITN URL matches `{PUBLIC_BASE_URL}/webhooks/payfast/appointment` if manually configured.
4. After deploy, test one checkout end-to-end and verify ITN in API logs.
