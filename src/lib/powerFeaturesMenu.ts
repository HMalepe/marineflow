import type { Salon } from '@prisma/client';
import { parseAutomationsFromMetadata } from './automationSettings.js';

/** Dynamic menu numbers for power-feature items (after 1–8, before 0). */
export interface ExtendedMenuActions {
  referral?: number;
  membership?: number;
}

export function resolveExtendedMenuActions(
  salon: Pick<Salon, 'metadata'>,
): ExtendedMenuActions {
  const auto = parseAutomationsFromMetadata(salon.metadata);
  const out: ExtendedMenuActions = {};
  let n = 9;
  if (auto.referral.enabled) {
    out.referral = n++;
  }
  if (auto.membership.enabled) {
    out.membership = n++;
  }
  return out;
}

export function buildExtraMenuLines(salon: Pick<Salon, 'metadata'>): string[] {
  const actions = resolveExtendedMenuActions(salon);
  const lines: string[] = [];
  if (actions.referral != null) lines.push(`${actions.referral} — Refer a friend`);
  if (actions.membership != null) lines.push(`${actions.membership} — VIP membership`);
  return lines;
}

/**
 * Referral nudge visits: 1st completed visit, then every Nth visit (5 → 5, 10, 15…).
 * Also matches any explicit entry in `promptAfterVisits`.
 */
export function shouldSendReferralPrompt(
  completedVisits: number,
  promptAfterVisits: number[],
): boolean {
  if (completedVisits < 1) return false;
  if (promptAfterVisits.includes(completedVisits)) return true;

  const first = promptAfterVisits[0] ?? 1;
  const everyNth = promptAfterVisits[1] ?? 5;
  if (completedVisits === first) return true;
  if (everyNth > 0 && completedVisits >= everyNth && completedVisits % everyNth === 0) {
    return true;
  }
  return false;
}

/** Waitlist claim TTL — customer must reply within this window. */
export const WAITLIST_CLAIM_TTL_MS = 30 * 60 * 1000;

export interface WaitlistClaimContext {
  serviceId: string;
  staffId?: string;
  slotStart?: string;
  expiresAt: string;
}

export function parseWaitlistClaim(raw: unknown): WaitlistClaimContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const serviceId = typeof c.serviceId === 'string' ? c.serviceId : '';
  if (!serviceId) return null;
  const expiresAt = typeof c.expiresAt === 'string' ? c.expiresAt : '';
  if (expiresAt && Date.parse(expiresAt) < Date.now()) return null;
  return {
    serviceId,
    staffId: typeof c.staffId === 'string' ? c.staffId : undefined,
    slotStart: typeof c.slotStart === 'string' ? c.slotStart : undefined,
    expiresAt: expiresAt || new Date(Date.now() + WAITLIST_CLAIM_TTL_MS).toISOString(),
  };
}

export function newWaitlistClaim(params: {
  serviceId: string;
  staffId?: string;
  slotStart?: Date;
}): WaitlistClaimContext {
  return {
    serviceId: params.serviceId,
    staffId: params.staffId,
    slotStart: params.slotStart?.toISOString(),
    expiresAt: new Date(Date.now() + WAITLIST_CLAIM_TTL_MS).toISOString(),
  };
}
