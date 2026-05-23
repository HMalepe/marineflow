# MarineFlow

**Local folder:** `C:\Users\134203\Desktop\marineflow` — separate from **VOUCH** and independent of any other repo.

**MarineFlow** is a WhatsApp-first booking and operations bot for hair salons, barbershops, and parlors: **Twilio WhatsApp**, **Postgres**, **Redis**, staff **dashboard**, **payments** (Stripe), **loyalty** (stamp cards), **support tickets**, and **analytics**.

**PCI:** Card data is handled by Stripe; this app stores Stripe IDs and metadata only—never full card numbers.

## Quick start

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Health: `GET http://localhost:3000/healthz`
- Twilio WhatsApp webhook: `POST /webhooks/twilio/whatsapp` (configure in Twilio; set `TWILIO_WEBHOOK_BASE_URL` to your public URL for signature validation)
- Dashboard: `http://localhost:3000/dashboard` (demo login from seed)
- Stripe webhook: `POST /webhooks/stripe`

## Environment

See [.env.example](.env.example). For Twilio signature validation, `TWILIO_WEBHOOK_BASE_URL` must match the scheme/host/path prefix Twilio uses when posting (no trailing slash on the base if your route is registered consistently).

### Why `.env` is not on GitHub (even when the repo is private)

- **Private ≠ secret.** Anyone with repo access, a leaked token, or a mistaken “make public” click can see committed secrets forever in git history.
- **Twilio Auth Tokens are account keys.** If they leak, someone can send messages and run up charges on your account.
- **You already posted a token in chat once** — rotating tokens is easier if they were never committed.
- **`.env.example`** is the template on GitHub; **`.env`** is your real copy on each machine (copy from the example and fill in values).

If you need a backup, store `.env` in a password manager or an encrypted note — not in the repo. If you deploy later, use the host’s secret/env UI (Railway, Render, etc.), not a committed file.

## Twilio WhatsApp test run (sandbox)

Use this for local send/receive with the [Twilio WhatsApp sandbox](https://www.twilio.com/docs/whatsapp/sandbox).

### 1. Fill `.env`

Copy `.env.example` to `.env`, then set at minimum:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx          # Twilio Console → Account Info
TWILIO_AUTH_TOKEN=xxxxxxxx             # same place (keep secret)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

PUBLIC_BASE_URL=https://YOUR-SUBDOMAIN.ngrok-free.dev
TWILIO_WEBHOOK_BASE_URL=https://YOUR-SUBDOMAIN.ngrok-free.dev

SESSION_SECRET=any-random-string-at-least-32-characters
INTERNAL_API_KEY=anyrandom8
```

`PUBLIC_BASE_URL` and `TWILIO_WEBHOOK_BASE_URL` must use the **same** public HTTPS host (no trailing slash). For local-only dashboard without ngrok, you can leave them as `http://localhost:3000` until you test WhatsApp webhooks.

### 2. Start the app

```bash
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Health check: `GET http://localhost:3000/healthz`

### 3. Expose localhost with ngrok

In another terminal:

```bash
ngrok http 3000
```

Copy the `https://….ngrok-free.dev` URL into **both** `PUBLIC_BASE_URL` and `TWILIO_WEBHOOK_BASE_URL` in `.env`, then **restart** `npm run dev`.

### 4. Configure Twilio sandbox

1. Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message** (sandbox).
2. On your phone, send the sandbox **join** code to `+1 415 523 8886`.
3. Under **When a message comes in**, set:

   `https://YOUR-SUBDOMAIN.ngrok-free.dev/webhooks/twilio/whatsapp`

   Method: **POST**.

### 5. Test

WhatsApp the sandbox number. You should get a bot reply if Postgres/Redis are up and credentials are correct.

**If webhooks fail:** Twilio signature checks use `TWILIO_WEBHOOK_BASE_URL` — it must match exactly what Twilio posts to (same host, `https`, no trailing slash on the base). Check Twilio **Monitor → Logs → Errors** and your terminal running `npm run dev`.

**Note:** Free ngrok URLs change when you restart ngrok; update `.env`, restart the app, and update the Twilio webhook URL each time.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | API + hot reload |
| `npm run build` / `npm start` | Production |
| `npm run worker` | Background jobs (BullMQ) |
| `npm test` | Vitest |
| `npm run db:migrate` | Prisma migrate (dev) |

## Meta / WhatsApp

Complete **Meta Business Manager**, **WABA**, and Twilio sender registration per [Twilio WhatsApp docs](https://www.twilio.com/docs/whatsapp/tutorial/whatsapp-business-account).
