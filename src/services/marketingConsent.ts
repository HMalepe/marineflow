import { getTenantDb, withTenantContext } from '../lib/db/tenantSession.js';
import { logger } from '../lib/logger.js';
import { recordConsent } from './compliance.js';

export type MarketingConsentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

const MARKETING_CONSENT_STATUSES: MarketingConsentStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED'];

export function parseMarketingConsentStatus(value: unknown): MarketingConsentStatus | null {
  if (typeof value !== 'string') return null;
  return MARKETING_CONSENT_STATUSES.includes(value as MarketingConsentStatus)
    ? (value as MarketingConsentStatus)
    : null;
}

export const MARKETING_CONSENT_TYPE = 'marketing';

export function isMarketingOptedIn(status: MarketingConsentStatus): boolean {
  return status === 'ACCEPTED';
}

export function needsMarketingConsentPrompt(status: MarketingConsentStatus): boolean {
  return status === 'PENDING';
}

export function buildPopiaConsentMessage(salonName: string): string {
  return [
    `Welcome to ${salonName}! 👋`,
    '',
    'Under POPIA we need your choice about *marketing messages* (promos, offers & salon news on WhatsApp).',
    '',
    'This is separate from booking — appointment confirmations and reminders are always sent.',
    '',
    'Reply:',
    '• *ACCEPT* — send me marketing & newsletters',
    '• *DECLINE* — no marketing messages',
    '',
    'Change anytime: reply STOP (opt out) or ACCEPT (opt in).',
    '',
    'Your POPIA rights: reply *MYDATA* to see stored data · *DELETE* to remove personal info.',
  ].join('\n');
}

/** Combined first-contact gate: POPIA data-storage consent + optional marketing opt-in, asked
 *  once instead of asking POPIA again later when the customer starts booking. */
export function buildCombinedConsentMessage(salonName: string): string {
  return [
    `Welcome to *${salonName}*! 👋`,
    '',
    `Before we get started we need your OK on two quick things:`,
    `• We'll store your basic details (name, contact) to manage your bookings — required under POPIA.`,
    `• We'd also love to send the occasional promo or salon news on WhatsApp — totally optional.`,
    '',
    'Your POPIA rights: reply *MYDATA* to see stored data · *DELETE* to remove personal info.',
  ].join('\n');
}

export type CombinedConsentChoice = 'accept_all' | 'booking_only' | 'decline';

/** Parse a reply to the combined consent gate — matches the three button titles plus typed synonyms. */
export function parseCombinedConsentReply(text: string): CombinedConsentChoice | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (t === 'accept all' || t === 'acceptall' || t === 'accept') return 'accept_all';
  if (t === 'booking only' || t === 'bookingonly' || t === 'booking') return 'booking_only';
  if (t === 'no thanks' || t === 'nothanks' || t === 'decline') return 'decline';
  return null;
}

export function buildConsentAcceptedMessage(): string {
  return 'Thanks — you\'re opted in to marketing messages. Reply STOP anytime to opt out.';
}

export function buildConsentDeclinedMessage(): string {
  return 'No problem — we won\'t send marketing messages. You can still book and get appointment updates. Reply ACCEPT anytime to opt in.';
}

export function buildConsentStopMessage(): string {
  return 'You\'ve been opted out of marketing messages. Reply ACCEPT if you change your mind.';
}

/** Parse inbound text as marketing consent choice — ACCEPT/DECLINE only (not YES/NO; those are for booking POPIA). */
export function parseMarketingConsentReply(text: string): 'accept' | 'decline' | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');

  const declinePatterns = [
    'decline',
    'stop',
    'unsubscribe',
    'opt out',
    'opt-out',
    'optout',
    'remove',
    'cancel marketing',
  ];
  const acceptPatterns = ['accept', 'opt in', 'opt-in', 'optin', 'subscribe'];

  if (declinePatterns.some((p) => t === p || t.startsWith(`${p} `))) return 'decline';
  if (acceptPatterns.some((p) => t === p || t.startsWith(`${p} `))) return 'accept';

  return null;
}

export function marketingConsentGatePending(
  salon: { botAskMarketingConsent?: boolean | null },
  status: MarketingConsentStatus | string | null | undefined,
): boolean {
  if (salon.botAskMarketingConsent === false) return false;
  const parsed = parseMarketingConsentStatus(status);
  if (parsed) return parsed === 'PENDING';
  return status == null;
}

export function isGlobalMarketingOptOut(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'stop' || t === 'unsubscribe' || t === 'opt out' || t === 'opt-out';
}

export function isGlobalMarketingOptIn(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'accept' || t === 'opt in' || t === 'opt-in' || t === 'subscribe';
}

type PendingConsentAudit = {
  salonId: string;
  customerId: string;
  type: string;
  granted: boolean;
  source?: string;
};

/** Consent audit rows — flushed after the bot DB transaction commits (non-critical). */
let pendingConsentAudits: PendingConsentAudit[] = [];

function scheduleConsentAudit(params: {
  salonId: string;
  customerId: string;
  status: MarketingConsentStatus;
  source?: string;
}): void {
  if (params.status === 'PENDING') return;
  pendingConsentAudits.push({
    salonId: params.salonId,
    customerId: params.customerId,
    type: MARKETING_CONSENT_TYPE,
    granted: params.status === 'ACCEPTED',
    source: params.source,
  });
}

/** Run deferred POPIA audit writes in separate transactions (must not abort bot flows). */
export async function flushPendingConsentAudits(): Promise<void> {
  const batch = pendingConsentAudits;
  pendingConsentAudits = [];
  for (const audit of batch) {
    try {
      await withTenantContext(audit.salonId, () =>
        recordConsent({
          salonId: audit.salonId,
          customerId: audit.customerId,
          type: audit.type,
          granted: audit.granted,
          source: audit.source,
        }),
      );
    } catch (err) {
      logger.warn({ err, ...audit }, 'deferred_consent_audit_failed');
    }
  }
}

export async function setMarketingConsent(params: {
  customerId: string;
  salonId: string;
  status: MarketingConsentStatus;
  source?: string;
}): Promise<void> {
  const db = getTenantDb();
  const accepted = params.status === 'ACCEPTED';
  const now = new Date();

  await db.customer.update({
    where: { id: params.customerId },
    data: {
      marketingConsentStatus: params.status,
      marketingConsent: accepted,
      marketingConsentAt:
        params.status === 'PENDING' ? null : now,
    },
  });

  scheduleConsentAudit({
    salonId: params.salonId,
    customerId: params.customerId,
    status: params.status,
    source: params.source,
  });
}

export async function applyMarketingConsentChoice(params: {
  customerId: string;
  salonId: string;
  choice: 'accept' | 'decline';
  source?: string;
}): Promise<MarketingConsentStatus> {
  const status: MarketingConsentStatus =
    params.choice === 'accept' ? 'ACCEPTED' : 'DECLINED';
  await setMarketingConsent({
    customerId: params.customerId,
    salonId: params.salonId,
    status,
    source: params.source,
  });
  return status;
}

export async function countMarketingOptedIn(salonId: string): Promise<number> {
  const db = getTenantDb();
  return db.customer.count({
    where: {
      salonId,
      deletedAt: null,
      marketingConsentStatus: 'ACCEPTED',
    },
  });
}
