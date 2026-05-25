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
| `PAYFAST_MERCHANT_ID` | PayFast merchant ID |
| `PAYFAST_MERCHANT_KEY` | PayFast merchant key |
| `PAYFAST_PASSPHRASE` | PayFast passphrase |
| `PAYFAST_IS_TEST` | `false` for production |
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
   - `NEXT_PUBLIC_API_URL` = `https://your-api.railway.app`

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

1. Register at [payfast.co.za](https://payfast.co.za)
2. Set ITN (Instant Transaction Notification) URL:
   `https://your-api.railway.app/webhooks/payfast/subscription`
3. Copy Merchant ID, Merchant Key, and Passphrase

## 8. DNS & SSL

- Railway and Vercel both provide automatic SSL
- Add custom domain in each platform's dashboard
- Recommended: `api.yourdomain.co.za` for Railway, `app.yourdomain.co.za` for Vercel

## 9. Post-Deploy Checklist

- [ ] Run `prisma migrate deploy` against production DB
- [ ] Verify RLS policies: `SELECT * FROM pg_policies;`
- [ ] Create first admin user via seed or direct SQL
- [ ] Send a test WhatsApp message
- [ ] Trigger a test PayFast ITN
- [ ] Verify Inngest functions appear in cloud dashboard
- [ ] Check materialized view refresh is running (every 15min)
- [ ] Monitor error rates in Railway logs
