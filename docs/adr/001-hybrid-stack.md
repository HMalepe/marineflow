# ADR 001: Hybrid Stack (Fastify API + Next.js Dashboard)

**Status:** Accepted  
**Date:** 2026-05-24  
**Deciders:** MarineFlow project owner  
**Spec reference:** Project Nexus build docs 01–05 (implemented under the **MarineFlow** product name)

## Context

The Nexus specification binds a stack of Next.js 15, Supabase, Inngest, and Vercel. MarineFlow already ships as a **Fastify + Prisma + Redis** monolith with a working WhatsApp bot, slot engine, Stripe deposits, and staff JWT APIs.

A full stack rewrite would delay Phase 1 exit criteria (one live salon, 100 bookings) by months. A pure Fastify path leaves no credible home for the 10-step onboarding wizard and operator dashboard described in Doc 04.

## Decision

Adopt **Hybrid C**:

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Hot path (webhooks, bot, slots, payments webhooks)** | Fastify on Node 22, existing repo | Sub-second reply budget; battle-tested Twilio/Stripe handlers |
| **Operator UI + onboarding wizard** | Next.js 15 App Router (new `apps/dashboard` or separate repo later) | Doc 04 requires rich wizard UX, server actions, shadcn/Tailwind |
| **Database** | PostgreSQL 16, shared | Single source of truth; RLS enforced in Postgres regardless of client |
| **ORM (API)** | Prisma | Already in place; migrations checked into repo |
| **Auth (dashboard)** | Supabase Auth **or** extend MarineFlow JWT until wizard lands | Defer Supabase Auth until dashboard app exists; JWT remains interim |
| **Background jobs** | Inngest (target) | Spec requirement; replace `worker.ts` stub incrementally |
| **Cache** | Redis | Rate limits, dedupe, slot cache |
| **Messaging** | Meta Cloud API primary, Twilio fallback | Per Doc 05; abstracted behind `lib/integrations/messaging` |
| **AI** | Anthropic Claude | Per Doc 03; abstracted behind `lib/integrations/ai` |
| **Hosting** | API: Railway/Render/Fly; Dashboard: Vercel | Two deployables, one database |

### Naming

- **Product / brand:** MarineFlow (unchanged)
- **Spec docs:** Still refer to "Project Nexus" — treat as build specification, not product name
- **Tenant anchor table:** `Salon` in Prisma maps to spec `tenants`; column `salonId` maps to spec `tenant_id`

## Consequences

### Positive

- Reuses ~70% of slot/loyalty/booking domain code
- Webhook latency stays on a thin Fastify process
- Dashboard can ship independently without blocking bot work
- RLS on Postgres works with both Prisma and Supabase client

### Negative

- Two deployables to operate (API + dashboard)
- Two auth paths until Supabase Auth replaces JWT
- Spec amendments required for: Supabase-as-primary-DB-client, single Next.js monolith

### Neutral

- Prisma remains migration source of truth; Supabase is hosting option, not schema owner
- Twilio stays as dev/sandbox and fallback channel

## Boundaries

```
┌─────────────────────┐     HTTPS/JWT      ┌──────────────────────┐
│  Next.js Dashboard  │ ─────────────────► │  Fastify API         │
│  (wizard, CRM UI)   │     REST/actions   │  /webhooks/*         │
└─────────┬───────────┘                    │  /api/*              │
          │                                └──────────┬───────────┘
          │                                           │
          └───────────────────┬───────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  PostgreSQL + RLS │
                    │  Redis            │
                    └──────────────────┘
                              ▲
                    ┌─────────┴──────────┐
                    │  Inngest (async)   │
                    │  WhatsApp, email   │
                    └────────────────────┘
```

**Rule:** Feature code imports vendor SDKs only from `src/lib/integrations/*`.

## Alternatives considered

| Option | Rejected because |
|--------|------------------|
| Full Nexus greenfield | Throws away working bot; duplicates domain work |
| Fastify-only forever | No credible wizard/dashboard path; HTML prototype doesn't scale |
| Next.js full-stack monolith | Webhook + Claude + slot work on serverless complicates hot-path latency |

## Compliance with Nexus pillars

| Pillar | Hybrid C approach |
|--------|---------------------|
| Multi-tenant by default | Week 1: RLS + `Salon` tenant fields + phone routing |
| Onboarding under 1 hour | Next.js wizard (Week 7+) |
| Bounded AI | Claude via integration layer (Week 4) |
| Premium feel | shadcn dashboard (Week 8+) |
| DB is source of truth | Postgres RLS; WhatsApp is transport |

## RLS Deployment Model

Row-Level Security is **enabled** but not **forced** (`ENABLE` without `FORCE`):

| Role | RLS behavior | Used by |
|------|--------------|---------|
| **Table owner** (dev `salon` role, seed, migrations) | Bypasses RLS | Dev, CI, seed, migrations |
| **App role** (`marineflow_app` — create in production) | Enforced by RLS | Production API server |
| **Service role** (same as owner) | Bypasses RLS | Cron jobs, cross-tenant ops |

**Production requirement**: Create a non-owner `marineflow_app` Postgres role. Grant SELECT/INSERT/UPDATE/DELETE on all tables, but NOT ownership. Connect the application with this role's connection string. RLS is automatically enforced for non-owners.

## Review

Revisit when: (a) dashboard app boots, (b) second tenant onboarded, (c) Inngest processes first outbound message.
