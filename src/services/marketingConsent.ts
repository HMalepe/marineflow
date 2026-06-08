import { getTenantDb } from '../lib/db/tenantSession.js';
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
    'Service messages (bookings, reminders) are separate — you always get those.',
    '',
    'Reply:',
    '• *ACCEPT* — send me marketing & newsletters',
    '• *DECLINE* — no marketing messages',
    '',
    'Change anytime: reply STOP (opt out) or ACCEPT (opt in).',
  ].join('\n');
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

/** Parse inbound text as marketing consent choice, if unambiguous. */
export function parseMarketingConsentReply(text: string): 'accept' | 'decline' | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');

  const declinePatterns = [
    'decline',
    'no',
    'stop',
    'unsubscribe',
    'opt out',
    'opt-out',
    'optout',
    'remove',
    'cancel marketing',
  ];
  const acceptPatterns = ['accept', 'yes', 'opt in', 'opt-in', 'optin', 'subscribe'];

  if (declinePatterns.some((p) => t === p || t.startsWith(`${p} `))) return 'decline';
  if (acceptPatterns.some((p) => t === p || t.startsWith(`${p} `))) return 'accept';

  return null;
}

export function isGlobalMarketingOptOut(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'stop' || t === 'unsubscribe' || t === 'opt out' || t === 'opt-out';
}

export function isGlobalMarketingOptIn(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'accept' || t === 'opt in' || t === 'opt-in' || t === 'subscribe';
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

  if (params.status === 'PENDING') return;

  await recordConsent({
    salonId: params.salonId,
    customerId: params.customerId,
    type: MARKETING_CONSENT_TYPE,
    granted: accepted,
    source: params.source ?? 'whatsapp',
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
