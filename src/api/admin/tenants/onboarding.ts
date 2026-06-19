import { prisma } from '../../../lib/prisma.js';
import { emitPlatformEvent } from '../../../services/platformEvents.js';

export type OnboardingStatus = {
  whatsappConfigured: boolean;
  stripeConnected: boolean;
  firstBookingMade: boolean;
  staffAdded: boolean;
};

export type OnboardingStatusResponse = OnboardingStatus & {
  complete: boolean;
  completedSteps: number;
  totalSteps: 4;
};

type SalonOnboardingInput = {
  whatsappPhoneId: string | null;
  twilioWhatsAppNumber: string | null;
  subscription: {
    status: string;
    payfastSubscriptionId: string | null;
  } | null;
  appointmentCount: number;
  staffUserCount: number;
  staffRosterCount: number;
};

export function computeOnboardingStatus(input: SalonOnboardingInput): OnboardingStatus {
  return {
    whatsappConfigured: Boolean(
      input.twilioWhatsAppNumber?.trim() || input.whatsappPhoneId?.trim(),
    ),
    /** Active PayFast subscription — field name kept for API compatibility. */
    stripeConnected:
      input.subscription?.status === 'ACTIVE' &&
      Boolean(input.subscription.payfastSubscriptionId?.trim()),
    firstBookingMade: input.appointmentCount > 0,
    staffAdded: input.staffUserCount > 1 || input.staffRosterCount > 0,
  };
}

export function enrichOnboardingStatus(status: OnboardingStatus): OnboardingStatusResponse {
  const completedSteps = [
    status.whatsappConfigured,
    status.stripeConnected,
    status.firstBookingMade,
    status.staffAdded,
  ].filter(Boolean).length;

  return {
    ...status,
    complete: completedSteps === 4,
    completedSteps,
    totalSteps: 4,
  };
}

async function loadSalonOnboardingInput(salonId: string): Promise<SalonOnboardingInput | null> {
  const salon = await prisma.salon.findFirst({
    where: { id: salonId, deletedAt: null },
    select: {
      whatsappPhoneId: true,
      twilioWhatsAppNumber: true,
      subscription: { select: { status: true, payfastSubscriptionId: true } },
      _count: { select: { appointments: true, staffUsers: true, staff: true } },
    },
  });
  if (!salon) return null;

  return {
    whatsappPhoneId: salon.whatsappPhoneId,
    twilioWhatsAppNumber: salon.twilioWhatsAppNumber,
    subscription: salon.subscription,
    appointmentCount: salon._count.appointments,
    staffUserCount: salon._count.staffUsers,
    staffRosterCount: salon._count.staff,
  };
}

export async function getTenantOnboarding(salonId: string): Promise<OnboardingStatusResponse | null> {
  const input = await loadSalonOnboardingInput(salonId);
  if (!input) return null;
  return enrichOnboardingStatus(computeOnboardingStatus(input));
}

const STALE_MS = 48 * 60 * 60 * 1000;

/** Emit platform events for tenants registered 48h+ ago with incomplete onboarding (deduped). */
export async function alertStaleIncompleteOnboarding(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const salons = await prisma.salon.findMany({
    where: { deletedAt: null, createdAt: { lte: cutoff } },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      whatsappPhoneId: true,
      twilioWhatsAppNumber: true,
      subscription: { select: { status: true, payfastSubscriptionId: true } },
      _count: { select: { appointments: true, staffUsers: true, staff: true } },
    },
  });

  let alerted = 0;
  for (const salon of salons) {
    const status = enrichOnboardingStatus(
      computeOnboardingStatus({
        whatsappPhoneId: salon.whatsappPhoneId,
        twilioWhatsAppNumber: salon.twilioWhatsAppNumber,
        subscription: salon.subscription,
        appointmentCount: salon._count.appointments,
        staffUserCount: salon._count.staffUsers,
        staffRosterCount: salon._count.staff,
      }),
    );
    if (status.complete) continue;

    const recent = await prisma.platformEvent.findFirst({
      where: {
        salonId: salon.id,
        type: 'ONBOARDING_INCOMPLETE',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) continue;

    emitPlatformEvent({
      type: 'ONBOARDING_INCOMPLETE',
      salonId: salon.id,
      metadata: {
        name: salon.name,
        slug: salon.slug,
        registeredAt: salon.createdAt.toISOString(),
        completedSteps: status.completedSteps,
        missing: {
          whatsapp: !status.whatsappConfigured,
          billing: !status.stripeConnected,
          booking: !status.firstBookingMade,
          staff: !status.staffAdded,
        },
      },
    });
    alerted += 1;
  }
  return alerted;
}

export function computeOnboardingBatch(
  salon: {
    whatsappPhoneId: string | null;
    twilioWhatsAppNumber: string | null;
    subscription: { status: string; payfastSubscriptionId: string | null } | null;
    appointmentCount: number;
    staffUserCount: number;
    staffRosterCount: number;
  },
): OnboardingStatusResponse {
  return enrichOnboardingStatus(
    computeOnboardingStatus({
      whatsappPhoneId: salon.whatsappPhoneId,
      twilioWhatsAppNumber: salon.twilioWhatsAppNumber,
      subscription: salon.subscription,
      appointmentCount: salon.appointmentCount,
      staffUserCount: salon.staffUserCount,
      staffRosterCount: salon.staffRosterCount,
    }),
  );
}
