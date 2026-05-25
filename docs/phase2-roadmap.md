# Phase 2 Roadmap: MarineFlow Multi-Location & Dashboard

**Status:** Planning  
**Prerequisite:** Phase 1 complete (Weeks 1–8)  
**Goal:** Multi-branch support, Next.js dashboard, subscription tiers, analytics views

---

## Phase 2 Scope

| Week | Deliverable | Dependencies |
|------|-------------|--------------|
| **9** | Branch model + multi-location schema | Phase 1 RLS |
| **10** | Next.js dashboard scaffold + auth | ADR 001 |
| **11** | Onboarding wizard (steps 1–5) | Dashboard scaffold |
| **12** | Onboarding wizard (steps 6–10) | Step 5 complete |
| **13** | Dashboard CRM views + analytics materialized views | Branch model |
| **14** | Subscription/billing tiers (Stripe subscriptions) | Salon.tier |
| **15** | Admin panel: multi-tenant management | Subscription model |
| **16** | Polish, E2E tests, deployment pipeline | All above |

---

## Week 9: Branch Model (Multi-Location)

### Schema additions
- `Branch` model: `id`, `salonId`, `name`, `address`, `phone`, `timezone`, `isActive`, `createdAt`
- `Staff.branchId` (optional FK) — staff can be assigned to a branch
- `Appointment.branchId` — appointments scoped to branch
- `WorkingHour.branchId` — per-branch hours
- RLS: branches inherit salon tenant isolation

### API changes
- CRUD endpoints for branches
- Slot engine: branch-aware availability
- Bot: branch selection step when salon has >1 branch

---

## Week 10: Next.js Dashboard Scaffold

### Architecture
- New `apps/dashboard` directory (monorepo or separate)
- Next.js 15 App Router + shadcn/ui + Tailwind CSS 4
- Auth: Supabase Auth (or JWT bridge to Fastify API)
- API calls: server actions → Fastify REST API

### Initial pages
- `/login` — email/password + magic link
- `/dashboard` — overview with today's appointments
- `/settings` — salon profile edit

---

## Week 11–12: Onboarding Wizard

### 10-Step Flow (from Nexus Doc 04)
1. Business name + type
2. Logo + branding colors
3. WhatsApp number verification
4. Services + pricing
5. Staff profiles + schedules
6. Working hours + holidays
7. Payment provider setup (Stripe/Ozow/PayFast)
8. FAQ seed content
9. Bot personality/tone configuration
10. Go-live confirmation + test message

---

## Week 13: Dashboard CRM + Analytics

### Materialized views
- `mv_daily_bookings` — appointments per day per salon
- `mv_revenue_summary` — revenue per period per salon
- `mv_customer_retention` — repeat visit rate
- Refresh strategy: Inngest cron every 15 minutes

### CRM views
- Customer list with fuzzy search (uses Week 8 pg_trgm)
- Customer detail: visit history, loyalty, messages
- Staff performance metrics

---

## Week 14: Subscription Tiers

### Schema
- `SubscriptionPlan` model: `id`, `name`, `tier`, `priceMonthly`, `priceAnnual`, `features`, `maxStaff`, `maxBranches`
- `Salon.subscriptionId` FK
- `SalonSubscription` model: `id`, `salonId`, `planId`, `stripeSubscriptionId`, `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`

### Behavior
- Free tier: 1 branch, 3 staff, basic bot
- Pro tier: unlimited branches, 10 staff, AI features
- Enterprise: unlimited everything, priority support, custom bot training

---

## Week 15: Admin Panel

### Multi-tenant management
- Super-admin role (platform-level, not salon-scoped)
- Salon listing: status, tier, usage metrics
- Impersonation mode for support
- Usage alerts / quota enforcement

---

## Week 16: Polish & Deploy

- E2E test suite (Playwright)
- CI/CD pipeline (GitHub Actions)
- Docker compose for local dev
- Production deployment guide (Railway + Vercel)
- Performance profiling + query optimization
- Security penetration testing checklist

---

## Technical Decisions Pending

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Dashboard location | Monorepo `apps/dashboard` vs separate repo | Monorepo — shared types |
| Auth provider | Supabase Auth vs extend JWT | Supabase Auth — wizard needs social login |
| State management | Server actions only vs tRPC | Server actions + React Query |
| Real-time updates | Polling vs WebSocket vs SSE | SSE for appointment updates |
| File uploads (KB docs) | S3/R2 vs Supabase Storage | Supabase Storage — unified auth |
