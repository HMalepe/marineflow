/**
 * Rolling build plan: placeholder APIs return 200 + `{ placeholder: true }` until implemented.
 * Replace handlers week-by-week; keep catalog in sync when shipping.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PlannedEndpoint {
  /** Calendar week index 1–24 (~6 months × ~4 weeks). */
  week: number;
  /** Human-readable phase name. */
  phase: string;
  method: HttpMethod;
  /** Path segment after `/api/planned/` (no leading slash). */
  path: string;
  /** What this API will do when built. */
  summary: string;
}

/** Month spine split into 4 blocks each → 24 week slots with labels. */
const MONTH_PHASES = [
  'Foundation + sandbox',
  'Booking MVP',
  'Payments + loyalty',
  'Support + CRM-lite',
  'Dashboard + analytics',
  'Hardening + launch',
] as const;

function phaseForWeek(week: number): string {
  const m = Math.min(5, Math.floor((week - 1) / 4));
  const block = ((week - 1) % 4) + 1;
  return `${MONTH_PHASES[m]} (block ${block}/4)`;
}

/** Named stubs that mirror real future routes (swap implementation later). */
const NAMED: Omit<PlannedEndpoint, 'phase'>[] = [
  // Foundation
  { week: 1, method: 'GET', path: 'meta/waba-checklist', summary: 'Meta Business Manager / WABA checklist status' },
  { week: 1, method: 'GET', path: 'integrations/twilio/senders', summary: 'List Twilio WhatsApp senders + health' },
  { week: 1, method: 'POST', path: 'jobs/reminders/dry-run', summary: 'Preview reminder jobs without sending' },
  { week: 1, method: 'GET', path: 'observability/webhooks/recent-errors', summary: 'Recent webhook processing errors' },
  // Booking
  { week: 5, method: 'POST', path: 'appointments/reschedule-proposals', summary: 'Propose alternate slots for reschedule flow' },
  { week: 5, method: 'POST', path: 'waitlist', summary: 'Join waitlist for a service/staff' },
  { week: 5, method: 'GET', path: 'waitlist', summary: 'List waitlist entries (staff)' },
  { week: 6, method: 'PATCH', path: 'salon/hours-exceptions/:id', summary: 'Holiday / exception windows' },
  { week: 6, method: 'POST', path: 'slots/simulate', summary: 'Simulate slot grid for a date range (admin)' },
  // Payments
  { week: 9, method: 'GET', path: 'payments/reconciliation', summary: 'PSP reconciliation export preview' },
  { week: 9, method: 'POST', path: 'billing-portal/session', summary: 'Stripe customer billing portal URL' },
  { week: 9, method: 'POST', path: 'payments/retry-link', summary: 'Issue a fresh payment link after failure' },
  // Loyalty + templates
  { week: 10, method: 'POST', path: 'loyalty/adjustments', summary: 'Staff manual ledger adjustment (audited)' },
  { week: 11, method: 'POST', path: 'whatsapp/templates/send', summary: 'Approved template send outside 24h session' },
  { week: 11, method: 'GET', path: 'whatsapp/templates', summary: 'List template metadata / approval state' },
  // Support + quality
  { week: 13, method: 'POST', path: 'tickets/:id/notify-customer', summary: 'Push resolution copy to WhatsApp' },
  { week: 13, method: 'POST', path: 'csat/broadcast', summary: 'Trigger post-visit CSAT campaign (stub)' },
  { week: 14, method: 'POST', path: 'gdpr/export-request', summary: 'DSAR export job (customer data package)' },
  { week: 14, method: 'POST', path: 'gdpr/delete-request', summary: 'DSAR delete request (legal gate)' },
  // Dashboard + analytics
  { week: 17, method: 'GET', path: 'reports/utilization', summary: 'Staff chair utilization' },
  { week: 17, method: 'GET', path: 'reports/no-shows', summary: 'No-show rate + revenue at risk' },
  { week: 18, method: 'GET', path: 'reports/cohort-retention', summary: 'Simple cohort retention series' },
  { week: 18, method: 'GET', path: 'calendar/week', summary: 'Week grid for appointments (dashboard)' },
  { week: 19, method: 'GET', path: 'customers/:id/crm', summary: 'CRM profile + internal notes' },
  // Hardening
  { week: 21, method: 'GET', path: 'ops/synthetic-last-run', summary: 'Last synthetic probe result' },
  { week: 22, method: 'POST', path: 'ops/incident-drill', summary: 'Record incident drill run (stub)' },
  { week: 24, method: 'GET', path: 'releases/latest', summary: 'Latest deployed version + changelog pointer' },
];

/** One generic overview per week for gap-filling during implementation sprints. */
function weeklyOverviewEndpoints(): PlannedEndpoint[] {
  const out: PlannedEndpoint[] = [];
  for (let w = 1; w <= 24; w++) {
    out.push({
      week: w,
      phase: phaseForWeek(w),
      method: 'GET',
      path: `weeks/w${String(w).padStart(2, '0')}/overview`,
      summary: `Week ${w} scope checklist + dependency graph (placeholder)`,
    });
  }
  return out;
}

function attachPhase(rows: Omit<PlannedEndpoint, 'phase'>[]): PlannedEndpoint[] {
  return rows.map((r) => ({ ...r, phase: phaseForWeek(r.week) }));
}

/** Full catalog: named future APIs + 24 weekly overview hooks. */
export const PLANNED_ENDPOINTS: PlannedEndpoint[] = [
  ...attachPhase(NAMED),
  ...weeklyOverviewEndpoints(),
];

export function catalogSummary() {
  const byWeek = new Map<number, PlannedEndpoint[]>();
  for (const e of PLANNED_ENDPOINTS) {
    const list = byWeek.get(e.week) ?? [];
    list.push(e);
    byWeek.set(e.week, list);
  }
  return { total: PLANNED_ENDPOINTS.length, byWeek: Object.fromEntries(byWeek) };
}
