import type { Conversation, Customer, Salon } from '@prisma/client';
import { DateTime } from 'luxon';
import { parseAutomationsFromMetadata } from '../lib/automationSettings.js';
import {
  buildExtraMenuLines,
  parseWaitlistClaim,
  resolveExtendedMenuActions,
} from '../lib/powerFeaturesMenu.js';
import { getActiveMembershipPlans, formatMembershipPlansMenu, getCustomerActiveMembership } from './membership.js';
import { getOrCreateReferralCode, buildReferralShareMessage } from './referralProgram.js';
import { checkCancellationAllowed } from './cancellationRules.js';
import { notifyWaitlistOnCancel } from './waitlist.js';
import { scheduleAppointmentReminders } from './appointmentReminders.js';
import { validateSlotAvailable } from './slots.js';
import { getTenantDb } from '../lib/db/tenantSession.js';

export function getSalonAutomations(salon: Pick<Salon, 'metadata'>) {
  return parseAutomationsFromMetadata(salon.metadata);
}

/** @deprecated use buildExtraMenuLines */
export function extraMenuLines(salon: Salon): string[] {
  return buildExtraMenuLines(salon);
}

export { resolveExtendedMenuActions, buildExtraMenuLines };

const BLOCKED_STEPS_FOR_WAITLIST = new Set([
  'CONFIRM_BOOKING',
  'BOOKING_POPIA_CONSENT',
  'COLLECT_FIRST_NAME',
  'COLLECT_LAST_NAME',
  'COLLECT_EMAIL',
  'COLLECT_DATE_OF_BIRTH',
  'MARKETING_CONSENT',
]);

/**
 * Handle YES/SKIP for waitlist slot offers — returns true if consumed.
 * Must run before booking YES handlers.
 */
export async function tryHandleWaitlistReply(
  conv: Conversation & { customer: Customer; salon: Salon },
  text: string,
  helpers: {
    reply: (body: string) => Promise<void>;
    saveContext: (patch: Record<string, unknown>, step?: string) => Promise<void>;
    startBooking: () => Promise<void>;
  },
): Promise<boolean> {
  const upper = text.trim().toUpperCase();
  if (upper !== 'YES' && upper !== 'SKIP') return false;
  if (BLOCKED_STEPS_FOR_WAITLIST.has(conv.step)) return false;

  const c =
    typeof conv.context === 'object' && conv.context ? (conv.context as Record<string, unknown>) : {};
  const claim = parseWaitlistClaim(c.waitlistClaim);
  if (!claim) return false;

  if (upper === 'SKIP') {
    await helpers.saveContext({ waitlistClaim: undefined });
    await helpers.reply('No problem — we will keep you on the waitlist for the next opening.');
    return true;
  }

  // YES — claim slot
  await helpers.saveContext({
    waitlistClaim: undefined,
    selectedServiceId: claim.serviceId,
    selectedStaffId: claim.staffId,
  });

  if (claim.slotStart && claim.staffId) {
    const db = getTenantDb();
    const service = await db.service.findFirst({
      where: { id: claim.serviceId, salonId: conv.salonId, active: true, deletedAt: null },
    });
    const staff = await db.staff.findFirst({
      where: { id: claim.staffId, salonId: conv.salonId, active: true, deletedAt: null },
    });
    if (service && staff) {
      const start = new Date(claim.slotStart);
      const end = new Date(
        start.getTime() + (service.durationMin + service.bufferMin + staff.breakMin) * 60_000,
      );
      const stillFree = await validateSlotAvailable({
        salonId: conv.salonId,
        staffId: staff.id,
        start,
        end,
      });
      if (stillFree && start.getTime() > Date.now()) {
        await helpers.saveContext(
          {
            selectedServiceId: service.id,
            selectedStaffId: staff.id,
            slotStartIso: start.toISOString(),
            localDateStr: DateTime.fromJSDate(start)
              .setZone(conv.salon.timezone)
              .toFormat('yyyy-MM-dd'),
          },
          'CONFIRM_BOOKING',
        );
        const dt = DateTime.fromJSDate(start).setZone(conv.salon.timezone);
        await helpers.reply(
          [
            'Great — this waitlist slot is still available!',
            `${service.name} with ${staff.name}`,
            dt.toFormat('cccc, dd LLL yyyy HH:mm'),
            '',
            'Reply YES to confirm your booking.',
          ].join('\n'),
        );
        return true;
      }
    }
  }

  await helpers.reply('That slot was just taken — let us find you another time.');
  await helpers.startBooking();
  return true;
}

export async function afterServiceSelected(
  _conv: Conversation & { customer: Customer; salon: Salon },
  _serviceId: string,
  helpers: {
    reply: (body: string) => Promise<void>;
    saveContext: (patch: Record<string, unknown>) => Promise<void>;
    continueToStaff: () => Promise<void>;
  },
): Promise<void> {
  // Add-on upsell removed — go straight to staff/slot selection after service pick.
  await helpers.continueToStaff();
}

/** Clears legacy add-on upsell state from in-flight conversations. */
export async function handleAddonPhase(
  conv: Conversation & { customer: Customer; salon: Salon },
  _text: string,
  helpers: {
    reply: (body: string) => Promise<void>;
    saveContext: (patch: Record<string, unknown>) => Promise<void>;
    continueToStaff: () => Promise<void>;
  },
): Promise<boolean> {
  const c =
    typeof conv.context === 'object' && conv.context ? (conv.context as Record<string, unknown>) : {};
  if (!c.addonPhase) return false;

  await helpers.saveContext({
    addonPhase: undefined,
    addonOptions: undefined,
    selectedAddonIds: undefined,
    addonExtraCents: undefined,
  });
  await helpers.continueToStaff();
  return true;
}

export async function handleReferralMenuItem(
  conv: Conversation & { customer: Customer; salon: Salon },
  reply: (body: string) => Promise<void>,
): Promise<void> {
  const ref = await getOrCreateReferralCode(conv.salonId, conv.customerId);
  if (!ref) {
    await reply('Referrals are not available at this salon right now.');
    return;
  }
  const share = buildReferralShareMessage({
    code: ref.code.code,
    salonName: ref.salonName,
    rewardCents: ref.rewardCents,
  });
  await reply(
    [
      'Your referral code:',
      `*${ref.code.code}*`,
      '',
      share,
      '',
      'Friends must be new to our bot and book using your code.',
      'Reply BACK for menu.',
    ].join('\n'),
  );
}

export async function handleMembershipMenuItem(
  conv: Conversation & { customer: Customer; salon: Salon },
  reply: (body: string) => Promise<void>,
): Promise<void> {
  const auto = getSalonAutomations(conv.salon);
  if (!auto.membership.enabled) {
    await reply('VIP membership is not available right now.');
    return;
  }

  const active = await getCustomerActiveMembership(conv.salonId, conv.customerId);
  if (active) {
    await reply(
      [
        `You're on *${active.plan.name}*`,
        `${active.visitsRemaining} visit${active.visitsRemaining === 1 ? '' : 's'} remaining this month`,
        `Renews: ${DateTime.fromJSDate(active.renewsAt).toFormat('dd MMM yyyy')}`,
        '',
        'Reply BACK for menu.',
      ].join('\n'),
    );
    return;
  }

  const plans = await getActiveMembershipPlans(conv.salonId);
  await reply(formatMembershipPlansMenu(plans));
}

export async function tryCancelWithRules(params: {
  salon: Salon;
  appointment: {
    id: string;
    start: Date;
    serviceId: string;
    staffId: string;
    penaltyWaivedAt: Date | null;
    cancellationPenaltyApplied: boolean;
  };
}): Promise<{ ok: true; penaltyApplied: boolean } | { ok: false; message: string; penaltyApplies: boolean }> {
  const check = checkCancellationAllowed({
    salon: params.salon,
    appointment: params.appointment,
    action: 'cancel',
  });
  if (!check.allowed) {
    // Return penaltyApplies flag — callers with a guaranteed tenant context
    // should update cancellationPenaltyApplied on the appointment themselves.
    return { ok: false, message: check.message, penaltyApplies: check.penaltyApplies };
  }
  return { ok: true, penaltyApplied: false };
}

export async function afterAppointmentCancelled(params: {
  salonId: string;
  salon: Pick<Salon, 'metadata' | 'timezone'>;
  serviceId: string;
  staffId: string;
  start: Date;
}): Promise<void> {
  const auto = getSalonAutomations(params.salon);
  if (!auto.waitlist.enabled || !auto.waitlist.autoFillOnCancel) return;

  await notifyWaitlistOnCancel({
    salonId: params.salonId,
    serviceId: params.serviceId,
    staffId: params.staffId,
    slotStart: params.start,
    timezone: params.salon.timezone,
  });
}

export async function onBookingConfirmed(appt: {
  id: string;
  salonId: string;
  start: Date;
  status: import('@prisma/client').AppointmentStatus;
  salon: Pick<Salon, 'metadata' | 'timezone'>;
}): Promise<void> {
  if (appt.start.getTime() <= Date.now()) return;
  await scheduleAppointmentReminders(appt);
}

export async function computeAppointmentEnd(params: {
  start: Date;
  serviceDurationMin: number;
  serviceBufferMin: number;
  staffBreakMin: number;
  addonServiceIds?: string[];
  salonId: string;
}): Promise<Date> {
  let addonMin = 0;
  if (params.addonServiceIds?.length) {
    const addons = await getTenantDb().service.findMany({
      where: { id: { in: params.addonServiceIds }, salonId: params.salonId },
      select: { durationMin: true },
    });
    addonMin = addons.reduce((s, a) => s + a.durationMin, 0);
  }
  return new Date(
    params.start.getTime() +
      (params.serviceDurationMin + addonMin + params.serviceBufferMin + params.staffBreakMin) * 60_000,
  );
}
