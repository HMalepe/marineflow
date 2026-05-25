# Schema Migration Plan: Nexus Doc 02 → MarineFlow Prisma

**Product name:** MarineFlow  
**Spec:** Project Nexus Database Schema (Document 02) v1.0  
**Convention:** Spec `tenants` / `tenant_id` → MarineFlow `Salon` / `salonId` (same concept, stable rename deferred)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Exists and aligned |
| 🟡 | Exists, needs extension |
| 🔨 | Week 1 (this sprint) |
| 📅 | Phase 1 later weeks |
| ⏭ | Phase 2+ / out of scope |

---

## Phase map

| Week | Schema work |
|------|-------------|
| **1** 🔨 | Tenant fields on `Salon`, RLS policies, `WebhookEvent`, integration routing columns |
| **2** 📅 | `PlatformUser`, `Operator`, per-staff `WorkingHour`, `AvailabilityException` |
| **3–4** 📅 | Conversation state enum alignment, `session_data` shape, message status enums |
| **5** 📅 | Booking status parity, reschedule columns, exclusion indexes |
| **6** 📅 | Ozow/PayFast payment columns, `citext` emails |
| **7–8** 📅 | KB embeddings (`pgvector`), FAQ approval workflow tables |
| **2+** ⏭ | `Branch`, `Agency`, subscription packages |

---

## Extensions (Doc 02 §2)

| Extension | Spec | MarineFlow | Action |
|-----------|------|------------|--------|
| `uuid-ossp` | ✅ | — (cuid IDs) | ⏭ Keep cuid unless UUID migration approved |
| `pgcrypto` | ✅ | — | 📅 Week 6 (Ozow credential encryption) |
| `pg_trgm` | ✅ | — | 📅 Week 8 (CRM fuzzy search) |
| `citext` | ✅ | — | 📅 Week 2 (operator emails) |
| `vector` | ✅ | — | 📅 Week 7 (KB embeddings) |

---

## Enums (Doc 02 §3)

| Spec enum | MarineFlow enum | Status | Action |
|-----------|-----------------|--------|--------|
| `tenant_status` | `TenantStatus` | 🔨 | Add: LEAD, TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CHURNED |
| `operator_role` | `StaffRole` | 🟡 | Add RECEPTIONIST, VIEWER later |
| `booking_status` | `AppointmentStatus` | 🟡 | Map HELD→pending_payment; add cancel reason enums 📅 W5 |
| `payment_method` | — | — | 📅 W6 |
| `payment_status` | `PaymentStatus` | 🟡 | Add authorised, captured aliases 📅 W6 |
| `message_direction` | string on `Message` | 🟡 | 📅 W3 enum |
| `message_channel` | — | — | 📅 W2 |
| `conversation_state` | `ConversationStep` | 🟡 | Different shape; converge 📅 W3 |
| `loyalty_reward_type` | string on program | 🟡 | 📅 W7 |
| `audit_action` | string on `AuditLog` | 🟡 | 📅 W2 |

---

## Core platform tables (Doc 02 §4) — no RLS

| Spec table | MarineFlow | Status | Action |
|------------|------------|--------|--------|
| `tenants` | `Salon` | 🔨 | Add lifecycle, bot tone, WABA IDs, tier, currency, soft delete |
| `agencies` | — | ⏭ | Phase 3 |
| `platform_users` | — | 📅 | Week 2; keep `StaffUser` until migrated |
| `operators` | — | 📅 | Week 2 join table |

### Salon ← tenants field mapping (Week 1)

| Spec column | Salon field | Week |
|-------------|-------------|------|
| `slug` | `slug` | ✅ |
| `legal_name` | `legalName` | 🔨 |
| `trading_name` | `name` (display) + `tradingName` | 🔨 |
| `industry_template` | `industryTemplate` | 🔨 |
| `status` | `status` | 🔨 |
| `status_changed_at` | `statusChangedAt` | 🔨 |
| `trial_ends_at` | `trialEndsAt` | 🔨 |
| `tier` | `tier` | 🔨 |
| `timezone` | `timezone` | ✅ |
| `default_currency` | `defaultCurrency` | 🔨 |
| `locale` | `locale` | 🔨 |
| `bot_name` | `botName` | 🔨 |
| `bot_voice_brief` | `botVoiceBrief` | 🔨 |
| `tone_*` (5 sliders) | `toneFormality` … `toneSalesEnergy` | 🔨 |
| `whatsapp_phone_id` | `whatsappPhoneId` | 🔨 |
| `whatsapp_waba_id` | `whatsappWabaId` | 🔨 |
| `metadata` | `metadata` | 🔨 |
| `deleted_at` | `deletedAt` | 🔨 |
| — | `twilioWhatsAppFrom` | 🔨 routing for Twilio fallback |

---

## Tenant-scoped business tables (Doc 02 §5)

| Spec table | MarineFlow | Status | Action |
|------------|------------|--------|--------|
| `branches` | — | ⏭ | Phase 2 |
| `staff` | `Staff` | 🟡 | Add displayName, bio, specialties, soft delete 📅 W2 |
| `service_categories` | `Service.category` string | 🟡 | Optional table 📅 W3 |
| `services` | `Service` | 🟡 | Add aliases, soft delete, deposit % 📅 W3 |
| `service_staff` | `StaffService` | 🟡 | Add `salonId` for RLS 📅 optional |
| `working_hours` | `BusinessHour` (salon-wide) | 🟡 | Per-staff `WorkingHour` table 📅 W2 |
| `availability_exceptions` | `TimeOff` | 🟡 | Extend for tenant-wide closures 📅 W2 |
| `customers` | `Customer` | 🟡 | Add marketing consent, tags, soft delete 📅 W4 |
| `bookings` | `Appointment` | 🟡 | Add cancellation, reschedule_from 📅 W5 |
| `payments` | `Payment` | 🟡 | Ozow/PayFast columns 📅 W6 |
| `invoices` | `Invoice` | ✅ | Minor |
| `loyalty_programs` | `LoyaltyProgram` | ✅ | |
| `loyalty_ledger` | `LoyaltyLedger` | ✅ | |
| `tickets` | `Ticket` | ✅ | |
| `ticket_messages` | `TicketMessage` | ✅ | RLS via subquery 🔨 |
| `faqs` | `FaqItem` | 🟡 | Embeddings table 📅 W7 |

---

## Conversation & AI tables (Doc 02 §6)

| Spec table | MarineFlow | Status | Action |
|------------|------------|--------|--------|
| `conversations` | `Conversation` | 🟡 | Add `endedAt`, `lastMessageAt` 📅 W3 |
| `messages_inbound` | `Message` (direction=in) | 🟡 | Add channel, status 📅 W3 |
| `messages_outbound` | `Message` (direction=out) | 🟡 | Idempotency key 📅 W2 |
| `knowledge_documents` | — | 📅 | W7 |
| `faq_embeddings` | — | 📅 | W7 |
| `webhook_events` | `WebhookEvent` | 🔨 | Week 1 |

---

## Analytics & audit (Doc 02 §6–7)

| Spec table | MarineFlow | Status | Action |
|------------|------------|--------|--------|
| `analytics_events` | `AnalyticsEvent` | ✅ | |
| `audit_log` | `AuditLog` | 🟡 | Add salonId, IP, UA 📅 W2 |
| Materialized views | — | 📅 | W8 |

---

## RLS (Doc 02 §8) — Week 1 scope

**Platform tables (no RLS):** `Salon`, `StaffUser`

**Tenant-scoped (RLS enabled, policy on `salonId`):**

- Customer, Conversation, Service, Staff, BusinessHour
- Appointment, Invoice, Payment, LoyaltyProgram, Ticket, FaqItem
- AnalyticsEvent, StaffService (subquery via staff/service)

**Subquery RLS (no denormalized salonId):**

- Message → via Conversation
- LoyaltyLedger → via LoyaltyProgram
- TicketMessage → via Ticket
- TimeOff → via Staff

**Session variables:**

```sql
SET LOCAL app.current_tenant = '<salon cuid>';
SET LOCAL row_security = on;  -- required when DB role is superuser (dev)
```

**Service role:** Migrations and seed use direct connection without tenant context on platform tables; seed wraps tenant data in `withTenantContext`.

---

## Migration execution order

1. Apply Prisma migration `20260524120000_tenant_rls_week1`
2. `npm run db:generate`
3. `npm run db:migrate`
4. `npm run db:seed`
5. Verify RLS: `docs/runbooks/rls-smoke-test.sql` (see migration comments)

---

## ID strategy note

Spec mandates UUID v4. MarineFlow uses **cuid** text PKs. Migration plan keeps cuid until a dedicated UUID migration RFC is approved (touches every FK).

---

## CI linter (future)

Doc 02 requires CI failure if a new business table lacks `salonId`. Add script in Week 2:

```bash
# prisma/schema.prisma lint — fail if model has customer data but no salonId
```
