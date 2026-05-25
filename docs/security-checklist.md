# Security Checklist

## Authentication & Authorization

- [x] JWT tokens with short expiry (7d salon, 4h admin, 1h impersonation)
- [x] Password hashing with bcrypt (10+ rounds)
- [x] Role-based access control (OWNER, MANAGER, STYLIST, RECEPTIONIST, VIEWER)
- [x] Super-admin separated from tenant admin (AdminUser model)
- [x] Impersonation audit trail (`impersonatedBy` in JWT)
- [x] Route-level role guards (`requireRole` preHandler)

## Data Isolation (Multi-Tenancy)

- [x] Postgres Row Level Security on all tenant tables
- [x] `app.current_tenant` session variable set per-request
- [x] `withTenantContext` validates non-empty salonId
- [x] Inngest jobs use `withJobTenant` for RLS in async contexts
- [x] Schema linter CI check: all business models must have `salonId`
- [x] RLS smoke test SQL runbook (`docs/runbooks/rls-smoke-test.sql`)

## Webhook Security

- [x] Meta WhatsApp: HMAC-SHA256 signature verification
- [x] PayFast: MD5 signature with passphrase
- [x] Ozow: SHA512 hash verification
- [x] All verifications use `crypto.timingSafeEqual` (timing-safe)
- [x] Webhook events deduplicated via `WebhookEvent` table

## Input Validation

- [x] Zod schema for all environment variables
- [x] Date parameters validated with `isNaN` checks
- [x] Ticket status validated against enum values
- [x] CSV export sanitizes formula-triggering characters

## Error Handling

- [x] Global error handler returns generic messages (no stack traces)
- [x] Specific error codes for client consumption
- [x] Non-blocking async I/O (no `readFileSync`)

## Infrastructure

- [x] Docker compose for local dev (isolated services)
- [x] CI pipeline: lint, typecheck, test, build on every push
- [x] E2E smoke tests with Playwright
- [ ] Rate limiting on auth endpoints (TODO: implement `@fastify/rate-limit`)
- [ ] CORS configuration for production domains
- [ ] Content Security Policy headers
- [ ] Request size limits on file upload endpoints

## Secrets Management

- [x] `.env.example` with no real values committed
- [x] `.gitignore` excludes `.env`, `.env.local`
- [x] Production secrets stored in Railway/Vercel environment
- [ ] Secret rotation policy documented

## Monitoring & Alerting

- [x] Admin panel shows past-due and quota alerts
- [x] Inngest dashboard for background job monitoring
- [ ] Structured logging (JSON format for log aggregation)
- [ ] Error tracking (Sentry integration)
- [ ] Uptime monitoring on webhook endpoints

## Compliance

- [x] Marketing consent tracking (`marketingConsent`, `marketingConsentAt`)
- [x] Soft delete pattern (customer `deletedAt`)
- [ ] Data export endpoint (POPIA/GDPR right of access)
- [ ] Data deletion endpoint (right to erasure)
- [ ] Audit log retention policy
