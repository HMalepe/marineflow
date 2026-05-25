# Phase 3 Roadmap: Agencies, Real-Time, Compliance & Bot Enhancements

**Status:** Active  
**Prerequisite:** Phase 2 complete (Weeks 9–16)  
**Goal:** White-label agency layer, real-time UX, POPIA compliance, production hardening

---

## Phase 3 Scope

| Week | Deliverable | Dependencies |
|------|-------------|--------------|
| **17** | Agency/Reseller model + white-label | Salon model, AdminUser |
| **18** | Real-time updates (SSE) for dashboard | Dashboard scaffold |
| **19** | File uploads (S3/R2) + knowledge doc ingestion | Knowledge base |
| **20** | POPIA/GDPR compliance (data export, erasure) | Customer model |
| **21** | Rate limiting, CORS, CSP headers | Fastify API |
| **22** | Structured logging + error tracking (Sentry) | All services |
| **23** | Bot enhancements (branch selection, reschedule, CSAT) | Branch model, bot engine |
| **24** | Performance optimization + caching | Materialized views, queries |

---

## Week 17: Agency / Reseller Model

### Schema
- `Agency` model: `id`, `name`, `slug`, `logoUrl`, `primaryColor`, `domain`, `active`, `createdAt`
- `AgencyUser` model: `id`, `agencyId`, `email`, `passwordHash`, `name`, `role`, `active`
- `Salon.agencyId` optional FK — salons can be managed by an agency
- Agency-scoped queries (not RLS — agency sees all their salons)

### Behavior
- Agency dashboard: list their salons, create new salons, view aggregate metrics
- White-label: custom branding per agency (logo, color, domain)
- Revenue share tracking (future billing)

---

## Week 18: Real-Time Updates (SSE)

### Architecture
- `GET /api/events/stream` — Server-Sent Events endpoint
- Redis Pub/Sub for cross-instance event distribution
- Events: `appointment.created`, `appointment.updated`, `message.received`

### Dashboard Integration
- `useEventStream` React hook
- Live appointment list updates (no manual refresh)
- Toast notifications for new messages

---

## Week 19: File Uploads

### Architecture
- S3-compatible storage (Cloudflare R2 or AWS S3)
- Presigned URL generation for direct uploads
- File metadata in DB: `UploadedFile` model

### Use Cases
- Knowledge base document upload (PDF, DOCX)
- Salon logo/branding images
- Staff profile photos

---

## Week 20: POPIA/GDPR Compliance

### Endpoints
- `GET /api/customers/:id/export` — full data export (JSON)
- `DELETE /api/customers/:id/erase` — anonymize customer data
- Consent audit trail table

### Schema
- `ConsentRecord` model: `customerId`, `type`, `granted`, `grantedAt`, `revokedAt`, `source`
- Retention policy: auto-flag records older than configurable period

---

## Week 21: Rate Limiting + Security Headers

### Implementation
- `@fastify/rate-limit` on auth, webhook, and public endpoints
- CORS allowlist from env config
- CSP, X-Frame-Options, HSTS headers via `@fastify/helmet`
- Request body size limits

---

## Week 22: Structured Logging + Error Tracking

### Implementation
- Pino JSON logger (already Fastify default, configure properly)
- Sentry SDK for error capture + performance traces
- Log correlation IDs across request lifecycle
- Alert on error rate spikes

---

## Week 23: Bot Enhancements

### Features
- Branch selection step (when salon has >1 branch)
- Reschedule via WhatsApp (cancel + rebook flow)
- Post-appointment CSAT survey (1-5 rating)
- Proactive re-engagement messages (lapsed customers)

---

## Week 24: Performance & Caching

### Optimizations
- Redis caching layer for hot queries (slots, services, staff)
- Connection pooling (PgBouncer config)
- Query analysis: EXPLAIN ANALYZE on slow queries
- Index audit and optimization
- Bundle size analysis for dashboard
