# Phase 4 Roadmap: Scale, Growth & Revenue

**Status:** Active  
**Prerequisite:** Phase 3 complete (Weeks 17–24)  
**Goal:** Monetisation flows, growth tools, mobile-ready API, i18n, observability dashboard

---

## Phase 4 Scope

| Week | Deliverable | Dependencies |
|------|-------------|--------------|
| **25** | Webhook outbound system (Zapier/Make integration) | Event bus |
| **26** | Multi-language / i18n (bot + dashboard) | Salon model (locale) |
| **27** | SMS fallback + voice call booking | Messaging layer |
| **28** | Waitlist + smart capacity management | Slots, branches |
| **29** | Marketing campaigns (bulk WhatsApp, reactivation) | Consent, customer model |
| **30** | Referral & loyalty gamification | Loyalty service |
| **31** | Mobile API (React Native ready endpoints) | Dashboard API |
| **32** | Observability dashboard + alerting | Structured logging, Sentry |

---

## Week 25: Webhook Outbound System

### Architecture
- `WebhookSubscription` model: url, events[], salonId, secret, active
- On each event bus publish, fan out to subscribed webhooks
- Retry with exponential backoff (Inngest)
- HMAC signature for webhook payload verification

### Use Cases
- Zapier / Make / n8n integration
- Custom CRM sync
- External analytics platforms

---

## Week 26: Multi-Language / i18n

### Implementation
- Bot response templates with locale interpolation
- Dashboard i18n with `next-intl` (EN, AF, ZU initially)
- Salon-level default locale + customer-level override
- Translation key management

---

## Week 27: SMS Fallback + Voice Call

### Architecture
- SMS channel for customers without WhatsApp
- Twilio Programmable Voice for booking confirmation calls
- Channel priority: WhatsApp > SMS > Voice
- Unified message log across channels

---

## Week 28: Waitlist + Smart Capacity

### Features
- Waitlist when all slots are taken
- Auto-notify when cancellation frees a slot
- Overbooking prevention with buffer
- Branch-level capacity limits

---

## Week 29: Marketing Campaigns

### Features
- Campaign model: name, template, audience filter, scheduledAt, status
- Bulk WhatsApp template messages (Meta-approved templates)
- Reactivation campaigns (customers dormant > 30 days)
- Consent-gated (only `marketing: true`)
- Rate limiting to stay within Meta quotas

---

## Week 30: Referral & Loyalty Gamification

### Features
- Referral codes per customer
- Reward both referrer and referee
- Tier system (Bronze, Silver, Gold) based on lifetime visits
- Milestone rewards (every 10th visit = free service)
- Gamification UI in bot + dashboard

---

## Week 31: Mobile API

### Implementation
- REST endpoints optimized for mobile (pagination, sparse fieldsets)
- Push notification registration (FCM/APNs tokens)
- Offline-capable patterns (last-modified headers, ETags)
- QR code generation for walk-in check-in

---

## Week 32: Observability Dashboard

### Implementation
- Platform-level metrics dashboard (admin panel extension)
- Real-time error rate, p95 latency, throughput
- Webhook delivery success rates
- Bot conversation completion funnel
- Automated alerts (Slack/email) on threshold breaches
