# Production Deployment Guide

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Vercel         │     │  Railway         │
│  (Dashboard)    │────▶│  (API Server)    │
│  Next.js 16     │     │  Fastify + Node  │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
              │ PostgreSQL │ │ Redis │ │  Inngest  │
              │ (pgvector) │ │       │ │  (Cloud)  │
              └───────────┘ └───────┘ └───────────┘
```

## 1. Database (Railway PostgreSQL)

1. Create a PostgreSQL service on Railway
2. Enable the `vector` and `pg_trgm` extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
3. Run migrations:
   ```bash
   DATABASE_URL="your-railway-db-url" npx prisma migrate deploy
   ```
4. Seed plans (if not done by migration):
   ```bash
   DATABASE_URL="your-railway-db-url" npx prisma db seed
   ```

## 2. Redis (Railway or Upstash)

- Create a Redis instance on Railway or use Upstash for serverless Redis
- Copy the `REDIS_URL` connection string

## 3. API Server (Railway)

1. Connect your GitHub repo to Railway
2. Set the root directory to `/` (project root)
3. Set build command: `npm ci --legacy-peer-deps && npx prisma generate && npx tsc --outDir dist`
4. Set start command: `node dist/index.js`
5. Set environment variables (see `.env.example`)

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (Railway auto-assigns) |
| `PUBLIC_BASE_URL` | `https://your-api.railway.app` |
| `DATABASE_URL` | Railway Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | 32+ char random string |
| `INTERNAL_API_KEY` | 16+ char random string |
| `PAYFAST_MERCHANT_ID` | PayFast merchant ID (live from payfast.co.za, or sandbox from sandbox.payfast.co.za) |
| `PAYFAST_MERCHANT_KEY` | PayFast merchant key (must match the same environment as merchant ID) |
| `PAYFAST_PASSPHRASE` | PayFast security passphrase (Settings → Integration; no leading/trailing spaces) |
| `PAYFAST_IS_TEST` | `true` = sandbox (`sandbox.payfast.co.za`). `false` = live (`www.payfast.co.za`). **Never mix live merchant ID with sandbox URL.** |
| `PAYFAST_SANDBOX_MERCHANT_ID` | Optional. Sandbox merchant ID when `PAYFAST_IS_TEST=true` (from [sandbox.payfast.co.za](https://sandbox.payfast.co.za) → Settings → Integration). PayFast demo: `10000100` / `46f0cd694581a` / passphrase `jt7NOE43FZPn` |
| `PAYFAST_SANDBOX_MERCHANT_KEY` | Sandbox merchant key (paired with sandbox merchant ID) |
| `PAYFAST_SANDBOX_PASSPHRASE` | Sandbox security passphrase (Settings → Integration on **sandbox** dashboard) |
| `META_APP_SECRET` | WhatsApp Cloud API app secret |
| `META_ACCESS_TOKEN` | WhatsApp Cloud API token |
| `META_WEBHOOK_VERIFY_TOKEN` | Your chosen verify token |
| `OPENAI_API_KEY` | OpenAI API key (for AI features) |
| `INNGEST_EVENT_KEY` | Inngest cloud event key |
| `INNGEST_SIGNING_KEY` | Inngest cloud signing key |

## 4. Dashboard (Vercel)

1. Import your GitHub repo to Vercel
2. Set root directory to `apps/dashboard`
3. Framework preset: Next.js
4. Environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://marineflow.co.za` (or your Railway API URL)
   - Optional: `API_UPSTREAM_URL` — same as above; used by Next.js rewrites to proxy API calls through the dashboard domain (helps salon owners on restrictive corporate WiFi)
   - Optional (troubleshooting only): `NEXT_PUBLIC_DASHBOARD_DEBUG` = `true` — shows full server/client error details on screen instead of the generic production message. **Turn off after fixing** — visible to anyone who can open the dashboard.
5. On Railway API, set `CORS_ORIGINS` to include `https://dashboard.marineflow.co.za` (auto-included if unset) and `DASHBOARD_URL=https://dashboard.marineflow.co.za`

## 5. Inngest (Cloud)

1. Sign up at [inngest.com](https://inngest.com)
2. Create an app, copy the Event Key and Signing Key
3. Set the serve URL: `https://your-api.railway.app/inngest`
4. Functions will auto-register on deploy

## 6. WhatsApp Business API

1. Create a Meta Business app at [developers.facebook.com](https://developers.facebook.com)
2. Configure webhook URL: `https://your-api.railway.app/webhooks/meta`
3. Set verify token to match `META_WEBHOOK_VERIFY_TOKEN`
4. Subscribe to `messages` webhook field

## 7. PayFast

1. Register at [payfast.co.za](https://payfast.co.za) (or use sandbox for testing)
2. Set these Railway env vars (you already have merchant ID/key/passphrase):
   - `PUBLIC_BASE_URL` = `https://marineflow.co.za` (must match your live API domain)
   - `PAYFAST_IS_TEST` = `true` for sandbox, `false` for live payments
3. **ITN (Instant Transaction Notification) URLs** — MarineFlow registers these automatically on each checkout via `notify_url`. You do **not** need a separate env var. PayFast will POST to:
   - **Appointment payments (WhatsApp bookings):**  
     `https://marineflow.co.za/webhooks/payfast/appointment`
   - **Salon subscription billing (dashboard):**  
     `https://marineflow.co.za/webhooks/payfast/subscription`
4. In PayFast merchant settings (optional but recommended):
   - **Security passphrase** must match `PAYFAST_PASSPHRASE` exactly
   - **Return URL:** `https://marineflow.co.za/pay/success`
   - **Cancel URL:** `https://marineflow.co.za/pay/cancel`
5. In MarineFlow dashboard → **Settings → Conversation flow**, enable **“Send PayFast payment link after booking”**
6. Redeploy Railway after env changes so payment links use the correct domain

## 8. DNS & SSL

- Railway and Vercel both provide automatic SSL
- Add custom domain in each platform's dashboard
- Recommended: `api.yourdomain.co.za` for Railway, `app.yourdomain.co.za` for Vercel

## 9. Connection Pooling (PgBouncer)

Railway Postgres includes PgBouncer by default. For other providers:

1. Use the **pooled connection string** (port 6543) for the API service
2. Use the **direct connection string** (port 5432) for migrations only
3. Recommended pool mode: **transaction** (compatible with Prisma)
4. Set `connection_limit` in Prisma to match pool size (default: 20)

```env
# .env production
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/db"
```

In `schema.prisma`, add:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

## 10. Post-Deploy Checklist

- [ ] Run `prisma migrate deploy` against production DB (use DIRECT_DATABASE_URL)
- [ ] Verify RLS policies: `SELECT * FROM pg_policies;`
- [ ] Create first admin user via seed or direct SQL
- [ ] Send a test WhatsApp message
- [ ] Trigger a test PayFast ITN
- [ ] Verify Inngest functions appear in cloud dashboard
- [ ] Check materialized view refresh is running (every 15min)
- [ ] Monitor error rates in Railway logs
- [ ] Verify Redis cache hit rates via `redis-cli INFO stats`
