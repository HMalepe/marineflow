# Solupair Dashboard — Premium UI Reference

Rebuild the key dashboard screens in this Lovable project as a polished reference you can port back to your real codebase. Same structure as your current dashboard — significantly elevated craft.

## Design language

**Brand gradient** (from your logo): `#22D3EE` cyan → `#A855F7` purple → `#EC4899` magenta. Used boldly: primary CTAs, active nav pill, logo wordmark, key metric accents, animated card borders on hover, soft ambient aurora glow in page background.

**Surfaces**
- Dark: canvas `#0A0A0F`, elevated cards `#13131C` with `1px` border `rgba(255,255,255,0.06)`, subtle inner gradient sheen on hover.
- Light: canvas `#FAFAFB`, cards pure white with `1px` border `rgba(15,15,25,0.06)`, soft shadow `0 1px 3px rgba(15,15,25,0.04)`.
- Both themes share identical layout, spacing, radii, and component anatomy — only tokens swap.

**Typography**
- Display/headings: **Geist** (or **Inter Display** fallback) — tight tracking, semibold weight. Replaces the current serif "Overview / Appointments" titles which feel mismatched with the neon brand.
- Body/UI: **Geist** regular.
- Numeric (metric values): **Geist Mono** tabular for crisp KR amounts.
- No serif anywhere — current Playfair-style headings are dropped.

**Radii & spacing**: `14px` cards, `10px` inputs/buttons, `999px` pills. Generous `24–32px` card padding. 8px grid throughout.

**Motion**: 200ms ease-out on all theme/hover transitions, view-transitions API for theme toggle (smooth cross-fade, not flash). Cards lift `translateY(-2px)` + gradient border bloom on hover. Numbers count-up on first render. Sidebar nav active pill animates with `layoutId`-style shared element.

## Copywriting refresh

| Current | New |
|---|---|
| Overview | Today at a glance |
| ON THIS PAGE → Key metrics / Revenue chart | Snapshot / Trends |
| Daily Operations | Run the day |
| Business Setup | Set up your salon |
| Appointments → "View and manage all bookings" | Bookings → "Every chair, every booking, live" |
| Conversations | Inbox |
| Customers → "8 customers · 2 duplicates found" | Clients → "8 clients — 2 look like duplicates, tap to merge" |
| Support tickets | Help requests |
| "Take over to reply" | "Jump in and reply" |
| "The bot is handling this chat." | "Bot is on it — you can take over anytime" |
| Sign in → "Sign in to your salon dashboard" | Welcome back → "Your salon, in one place" |

Tone: warm, plain-English, second-person, never corporate.

## Screens built

1. **Login** — centered glass card on aurora-gradient canvas, segmented WhatsApp/Email toggle with sliding indicator, gradient CTA, theme toggle top-right.
2. **Overview** — refreshed sidebar, owner card with live status dot, 6 metric tiles with sparklines + count-up + colored gradient corner glow on the two with alerts (Pending payments, Help requests), 7-day revenue chart redrawn with Recharts using gradient-filled bars + hover tooltip, AI Coach card with animated gradient border.
3. **Bookings (Appointments)** — sticky filter bar, search with `⌘K` chip, day groups with gradient left rail, booking cards with status pill (paid = cyan, pending = amber, confirmed = green), hover reveals quick actions.
4. **Inbox (Conversations)** — two-pane split, conversation list with avatar/waiting-time pills, message thread with bot/customer/staff bubbles, gradient "Jump in and reply" CTA at bottom.
5. **Clients (Customers)** — segmented filter pills (All / New / At Risk / Champions / VIP) with counts, duplicate warning banner with inline Merge CTA, client cards with avatar, spend, last visit, status dot.
6. **Services** — table with inline edit, active/hidden/inactive status pills, price + duration columns, success toast bottom-right.

## Architecture

- `src/styles.css` — all tokens (oklch), gradient variables, shadow scale, both themes.
- `src/components/ui/*` — shadcn primitives, theming already wired.
- `src/components/dashboard/` — `Sidebar`, `OwnerCard`, `MetricTile`, `RevenueChart`, `AICoachCard`, `BookingCard`, `ClientCard`, `ConversationList`, `MessageThread`, `ThemeToggle`, `OnThisPageNav`, `AuroraBackground`.
- `src/routes/` — `index.tsx` (Overview), `login.tsx`, `appointments.tsx`, `conversations.tsx`, `customers.tsx`, `services.tsx`. Reusable `_dashboard.tsx` layout route for sidebar shell.
- Theme: `next-themes`-style provider with `class` strategy + `View Transitions API` toggle.
- Mock data in `src/lib/mock-data.ts` mirroring your real shapes (bookings, clients, conversations).
- Recharts for the revenue bar chart with custom gradient fill.
- `framer-motion` for the active-nav shared element, card hover, count-up.

## Technical notes

- Tailwind v4 with `@theme inline` mapping all tokens; gradient defined as `--gradient-brand` and exposed as `bg-gradient-brand` utility via `@utility`.
- Fonts via `@fontsource/geist-sans` + `@fontsource/geist-mono` (installed with bun, imported in `src/start.ts`).
- View Transitions API for theme swap; falls back to instant swap where unsupported.
- All colors in oklch, no hardcoded hex in components — only via tokens.

## Out of scope

- Backend, auth, real data — pure UI reference.
- Staff Roster, Branches, Bot FAQs, Marketing & Insights pages (visible in sidebar but link to a generic "Coming soon" placeholder so the nav looks complete).
