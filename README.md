# Salon WhatsApp OS (WhatsApp Chat Bot)

**Local folder:** `C:\Users\134203\Desktop\salon-whatsapp-os` — separate from **VOUCH** and independent of any other repo.

WhatsApp-first booking and operations for hair salons, barbershops, and parlors: **Twilio WhatsApp**, **Postgres**, **Redis**, staff **dashboard**, **payments** (Stripe), **loyalty** (stamp cards), **support tickets**, and **analytics**.

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
