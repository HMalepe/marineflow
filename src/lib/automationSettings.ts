import type { Prisma } from '@prisma/client';

/** Central automation config stored in `Salon.metadata.automations`. */
export interface SalonAutomations {
  reminders: {
    enabled: boolean;
    hoursBefore: number[];
  };
  cancellation: {
    allowSelfServiceReschedule: boolean;
    rescheduleHoursBefore: number;
    cancelHoursBefore: number;
    forfeitDepositOnLateCancel: boolean;
  };
  waitlist: {
    enabled: boolean;
    autoFillOnCancel: boolean;
  };
  googleReview: {
    enabled: boolean;
    hoursAfterVisit: number;
    /** Offer R50-style credit after customer leaves a Google review */
    incentiveEnabled: boolean;
    incentiveCents: number;
  };
  welcomeJourney: {
    enabled: boolean;
    introMessage: string;
    showPopularServices: boolean;
  };
  referral: {
    enabled: boolean;
    rewardCents: number;
    /** Visit numbers that trigger a referral prompt (e.g. 1, 5, 10, 15). */
    promptAfterVisits: number[];
  };
  membership: {
    enabled: boolean;
  };
  seasonalCampaigns: {
    enabled: boolean;
    maxScheduled: number;
  };
  reactivation: {
    enabled: boolean;
    inactiveDays: number[];
    dailyLimit: number;
    cooldownDays: number;
  };
  upselling: {
    enabled: boolean;
  };
  stylistPerformance: {
    enabled: boolean;
    incentiveEnabled: boolean;
    /** Percent of service price paid to stylist as incentive */
    incentivePercentPerCut: number;
  };
  booking: {
    /** Slot interval in minutes — controls how granular the time picker is */
    slotIntervalMin: number;
  };
  messaging: {
    winbackBody: string;
    birthdayBody: string;
    cancellationPolicyText: string;
  };
}

export const DEFAULT_AUTOMATIONS: SalonAutomations = {
  reminders: {
    enabled: true,
    hoursBefore: [24, 2],
  },
  cancellation: {
    allowSelfServiceReschedule: true,
    rescheduleHoursBefore: 12,
    cancelHoursBefore: 24,
    forfeitDepositOnLateCancel: true,
  },
  waitlist: {
    enabled: true,
    autoFillOnCancel: true,
  },
  googleReview: {
    enabled: true,
    hoursAfterVisit: 24,
    incentiveEnabled: true,
    incentiveCents: 5000,
  },
  welcomeJourney: {
    enabled: true,
    introMessage:
      'Welcome! We are so glad you found us. Our team is ready to make you look and feel amazing.',
    showPopularServices: true,
  },
  referral: {
    enabled: true,
    rewardCents: 5000,
    promptAfterVisits: [1, 5],
  },
  membership: {
    enabled: false,
  },
  seasonalCampaigns: {
    enabled: true,
    maxScheduled: 50,
  },
  reactivation: {
    enabled: true,
    inactiveDays: [21, 45, 90, 180],
    dailyLimit: 50,
    cooldownDays: 30,
  },
  upselling: {
    enabled: true,
  },
  stylistPerformance: {
    enabled: true,
    incentiveEnabled: false,
    incentivePercentPerCut: 10,
  },
  booking: {
    slotIntervalMin: 15,
  },
  messaging: {
    winbackBody: '',
    birthdayBody: '',
    cancellationPolicyText: '',
  },
};

const MAX_SCHEDULED_CAMPAIGNS = 50;
const MAX_REACTIVATION_TIERS = 6;
const MAX_REMINDER_HOURS = 4;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : NaN;
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

function parseHoursList(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const out = raw
    .map((h) => clampInt(h, 1, 168, NaN))
    .filter((h) => Number.isFinite(h));
  const unique = [...new Set(out)].sort((a, b) => b - a);
  return unique.length ? unique.slice(0, MAX_REMINDER_HOURS) : fallback;
}

function parseDaysList(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const out = raw
    .map((d) => clampInt(d, 7, 365, NaN))
    .filter((d) => Number.isFinite(d));
  const unique = [...new Set(out)].sort((a, b) => a - b);
  return unique.length ? unique.slice(0, MAX_REACTIVATION_TIERS) : fallback;
}

function parseVisitList(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const out = raw
    .map((v) => clampInt(v, 1, 999, NaN))
    .filter((v) => Number.isFinite(v));
  const unique = [...new Set(out)].sort((a, b) => a - b);
  return unique.length ? unique : fallback;
}

function parseSection<T extends Record<string, unknown>>(
  raw: unknown,
  defaults: T,
): T {
  const base = isRecord(raw) ? raw : {};
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const def = defaults[key];
    const val = base[key as string];
    if (typeof def === 'boolean') {
      out[key] = parseBool(val, def) as T[keyof T];
    } else if (typeof def === 'number') {
      out[key] = clampInt(val, 0, 1_000_000, def) as T[keyof T];
    } else if (typeof def === 'string') {
      out[key] = (typeof val === 'string' && val.trim() ? val.trim() : def) as T[keyof T];
    }
  }
  return out;
}

export function parseAutomationsFromMetadata(metadata: unknown): SalonAutomations {
  const meta = isRecord(metadata) ? metadata : {};
  const raw = isRecord(meta.automations) ? meta.automations : {};

  const remindersRaw = isRecord(raw.reminders) ? raw.reminders : {};
  const cancellationRaw = isRecord(raw.cancellation) ? raw.cancellation : {};
  const waitlistRaw = isRecord(raw.waitlist) ? raw.waitlist : {};
  const reviewRaw = isRecord(raw.googleReview) ? raw.googleReview : {};
  const welcomeRaw = isRecord(raw.welcomeJourney) ? raw.welcomeJourney : {};
  const referralRaw = isRecord(raw.referral) ? raw.referral : {};
  const membershipRaw = isRecord(raw.membership) ? raw.membership : {};
  const seasonalRaw = isRecord(raw.seasonalCampaigns) ? raw.seasonalCampaigns : {};
  const reactivationRaw = isRecord(raw.reactivation) ? raw.reactivation : {};
  const upsellingRaw = isRecord(raw.upselling) ? raw.upselling : {};
  const stylistRaw = isRecord(raw.stylistPerformance) ? raw.stylistPerformance : {};
  const bookingRaw = isRecord(raw.booking) ? raw.booking : {};
  const messagingRaw = isRecord(raw.messaging) ? raw.messaging : {};

  return {
    reminders: {
      enabled: parseBool(remindersRaw.enabled, DEFAULT_AUTOMATIONS.reminders.enabled),
      hoursBefore: parseHoursList(
        remindersRaw.hoursBefore,
        DEFAULT_AUTOMATIONS.reminders.hoursBefore,
      ),
    },
    cancellation: {
      allowSelfServiceReschedule: parseBool(
        cancellationRaw.allowSelfServiceReschedule,
        DEFAULT_AUTOMATIONS.cancellation.allowSelfServiceReschedule,
      ),
      rescheduleHoursBefore: clampInt(
        cancellationRaw.rescheduleHoursBefore,
        1,
        168,
        DEFAULT_AUTOMATIONS.cancellation.rescheduleHoursBefore,
      ),
      cancelHoursBefore: clampInt(
        cancellationRaw.cancelHoursBefore,
        1,
        168,
        DEFAULT_AUTOMATIONS.cancellation.cancelHoursBefore,
      ),
      forfeitDepositOnLateCancel: parseBool(
        cancellationRaw.forfeitDepositOnLateCancel,
        DEFAULT_AUTOMATIONS.cancellation.forfeitDepositOnLateCancel,
      ),
    },
    waitlist: parseSection(waitlistRaw, DEFAULT_AUTOMATIONS.waitlist),
    googleReview: {
      enabled: parseBool(reviewRaw.enabled, DEFAULT_AUTOMATIONS.googleReview.enabled),
      hoursAfterVisit: clampInt(
        reviewRaw.hoursAfterVisit,
        1,
        168,
        DEFAULT_AUTOMATIONS.googleReview.hoursAfterVisit,
      ),
      incentiveEnabled: parseBool(
        reviewRaw.incentiveEnabled,
        DEFAULT_AUTOMATIONS.googleReview.incentiveEnabled,
      ),
      incentiveCents: clampInt(
        reviewRaw.incentiveCents,
        0,
        1_000_000,
        DEFAULT_AUTOMATIONS.googleReview.incentiveCents,
      ),
    },
    welcomeJourney: {
      enabled: parseBool(welcomeRaw.enabled, DEFAULT_AUTOMATIONS.welcomeJourney.enabled),
      introMessage:
        typeof welcomeRaw.introMessage === 'string' && welcomeRaw.introMessage.trim()
          ? welcomeRaw.introMessage.trim().slice(0, 2000)
          : DEFAULT_AUTOMATIONS.welcomeJourney.introMessage,
      showPopularServices: parseBool(
        welcomeRaw.showPopularServices,
        DEFAULT_AUTOMATIONS.welcomeJourney.showPopularServices,
      ),
    },
    referral: {
      enabled: parseBool(referralRaw.enabled, DEFAULT_AUTOMATIONS.referral.enabled),
      rewardCents: clampInt(
        referralRaw.rewardCents,
        0,
        1_000_000,
        DEFAULT_AUTOMATIONS.referral.rewardCents,
      ),
      promptAfterVisits: parseVisitList(
        referralRaw.promptAfterVisits,
        DEFAULT_AUTOMATIONS.referral.promptAfterVisits,
      ),
    },
    membership: parseSection(membershipRaw, DEFAULT_AUTOMATIONS.membership),
    seasonalCampaigns: {
      enabled: parseBool(seasonalRaw.enabled, DEFAULT_AUTOMATIONS.seasonalCampaigns.enabled),
      maxScheduled: clampInt(
        seasonalRaw.maxScheduled,
        1,
        MAX_SCHEDULED_CAMPAIGNS,
        DEFAULT_AUTOMATIONS.seasonalCampaigns.maxScheduled,
      ),
    },
    reactivation: {
      enabled: parseBool(reactivationRaw.enabled, DEFAULT_AUTOMATIONS.reactivation.enabled),
      inactiveDays: parseDaysList(
        reactivationRaw.inactiveDays,
        DEFAULT_AUTOMATIONS.reactivation.inactiveDays,
      ),
      dailyLimit: clampInt(
        reactivationRaw.dailyLimit,
        1,
        500,
        DEFAULT_AUTOMATIONS.reactivation.dailyLimit,
      ),
      cooldownDays: clampInt(
        reactivationRaw.cooldownDays,
        7,
        90,
        DEFAULT_AUTOMATIONS.reactivation.cooldownDays,
      ),
    },
    upselling: parseSection(upsellingRaw, DEFAULT_AUTOMATIONS.upselling),
    stylistPerformance: {
      enabled: parseBool(stylistRaw.enabled, DEFAULT_AUTOMATIONS.stylistPerformance.enabled),
      incentiveEnabled: parseBool(
        stylistRaw.incentiveEnabled,
        DEFAULT_AUTOMATIONS.stylistPerformance.incentiveEnabled,
      ),
      incentivePercentPerCut: clampInt(
        stylistRaw.incentivePercentPerCut,
        0,
        100,
        DEFAULT_AUTOMATIONS.stylistPerformance.incentivePercentPerCut,
      ),
    },
    booking: {
      slotIntervalMin: (() => {
        const v = clampInt(bookingRaw.slotIntervalMin, 5, 60, 15);
        return [5, 10, 15, 30, 60].includes(v) ? v : 15;
      })(),
    },
    messaging: {
      winbackBody:
        typeof messagingRaw.winbackBody === 'string'
          ? messagingRaw.winbackBody.trim().slice(0, 1600)
          : '',
      birthdayBody:
        typeof messagingRaw.birthdayBody === 'string'
          ? messagingRaw.birthdayBody.trim().slice(0, 1600)
          : '',
      cancellationPolicyText:
        typeof messagingRaw.cancellationPolicyText === 'string'
          ? messagingRaw.cancellationPolicyText.trim().slice(0, 2000)
          : '',
    },
  };
}

export function validateAutomationsPayload(
  patch: Partial<SalonAutomations> | undefined,
  existing: SalonAutomations,
): SalonAutomations | { error: string } {
  if (!patch) return existing;

  const merged: SalonAutomations = {
    reminders: { ...existing.reminders, ...patch.reminders },
    cancellation: { ...existing.cancellation, ...patch.cancellation },
    waitlist: { ...existing.waitlist, ...patch.waitlist },
    googleReview: { ...existing.googleReview, ...patch.googleReview },
    welcomeJourney: { ...existing.welcomeJourney, ...patch.welcomeJourney },
    referral: { ...existing.referral, ...patch.referral },
    membership: { ...existing.membership, ...patch.membership },
    seasonalCampaigns: { ...existing.seasonalCampaigns, ...patch.seasonalCampaigns },
    reactivation: { ...existing.reactivation, ...patch.reactivation },
    upselling: { ...existing.upselling, ...patch.upselling },
    stylistPerformance: { ...existing.stylistPerformance, ...patch.stylistPerformance },
    booking: { ...existing.booking, ...patch.booking },
    messaging: { ...existing.messaging, ...patch.messaging },
  };

  if (merged.reminders.hoursBefore.length === 0) {
    return { error: 'At least one reminder interval is required.' };
  }
  if (merged.reactivation.inactiveDays.length === 0) {
    return { error: 'At least one reactivation interval is required.' };
  }
  if (merged.referral.promptAfterVisits.length === 0) {
    return { error: 'At least one referral prompt visit is required.' };
  }

  return parseAutomationsFromMetadata({ automations: merged });
}

export function mergeAutomationsIntoMetadata(
  existing: unknown,
  automations: SalonAutomations,
): Prisma.InputJsonValue {
  const base = isRecord(existing) ? { ...existing } : {};
  return { ...base, automations } as Prisma.InputJsonValue;
}

/** Visit numbers that should trigger a referral nudge (1, then every 5th thereafter). */
export function expandReferralPromptVisits(first: number, step: number, max = 100): number[] {
  const visits: number[] = [first];
  for (let v = first + step; v <= max; v += step) visits.push(v);
  return visits;
}

export function shouldPromptReferral(
  completedVisits: number,
  promptAfterVisits: number[],
): boolean {
  return promptAfterVisits.includes(completedVisits);
}
