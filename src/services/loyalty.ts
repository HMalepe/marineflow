import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { Service } from '@prisma/client';

export async function ensureLoyaltyProgram(salonId: string) {
  await prisma.loyaltyProgram.upsert({
    where: { salonId },
    create: {
      salonId,
      stampsPerReward: 10,
      rewardKind: 'FREE_SERVICE_TIER',
    },
    update: {},
  });
}

export async function getStampBalance(salonId: string, customerId: string) {
  await ensureLoyaltyProgram(salonId);
  const program = await prisma.loyaltyProgram.findUniqueOrThrow({
    where: { salonId },
  });
  const agg = await prisma.loyaltyLedger.aggregate({
    where: { programId: program.id, customerId },
    _sum: { delta: true },
  });
  const stamps = agg._sum.delta ?? 0;
  return { stamps, stampsPerReward: program.stampsPerReward };
}

type Tx = Prisma.TransactionClient;

/** Inside an appointment transaction: redeem stamps if eligible. */
export async function redeemForNextBookingTx(
  tx: Tx,
  input: {
    salonId: string;
    customerId: string;
    service: Service;
  },
): Promise<{ redeemed: boolean; note?: string }> {
  if (!input.service.qualifiesLoyalty) return { redeemed: false };

  await ensureLoyaltyProgram(input.salonId);
  const program = await tx.loyaltyProgram.findUniqueOrThrow({
    where: { salonId: input.salonId },
  });
  const agg = await tx.loyaltyLedger.aggregate({
    where: { programId: program.id, customerId: input.customerId },
    _sum: { delta: true },
  });
  const stamps = agg._sum.delta ?? 0;
  if (stamps < program.stampsPerReward) return { redeemed: false };

  await tx.loyaltyLedger.create({
    data: {
      programId: program.id,
      customerId: input.customerId,
      delta: -program.stampsPerReward,
      reason: 'REDEEM_BOOKING',
    },
  });
  await tx.customer.update({
    where: { id: input.customerId },
    data: {
      loyaltyStampsCached: stamps - program.stampsPerReward,
    },
  });

  return {
    redeemed: true,
    note: `Reward applied — ${program.stampsPerReward} stamps redeemed toward this booking.`,
  };
}

/** Try to redeem full qualifying service when stamps reached; returns note for messaging. */
export async function redeemForNextBooking(input: {
  salonId: string;
  customerId: string;
  service: Service;
}): Promise<{ redeemed: boolean; note?: string }> {
  return prisma.$transaction((tx) =>
    redeemForNextBookingTx(tx, input),
  ) as Promise<{ redeemed: boolean; note?: string }>;
}

export async function earnStampForCompletedVisit(input: {
  salonId: string;
  customerId: string;
  appointmentId: string;
  service: Service;
}) {
  if (!input.service.qualifiesLoyalty) return;
  await ensureLoyaltyProgram(input.salonId);
  const program = await prisma.loyaltyProgram.findUniqueOrThrow({
    where: { salonId: input.salonId },
  });

  await prisma.$transaction(async (tx) => {
    await tx.loyaltyLedger.create({
      data: {
        programId: program.id,
        customerId: input.customerId,
        delta: 1,
        reason: 'EARN_VISIT',
        appointmentId: input.appointmentId,
      },
    });
    const agg = await tx.loyaltyLedger.aggregate({
      where: { programId: program.id, customerId: input.customerId },
      _sum: { delta: true },
    });
    await tx.customer.update({
      where: { id: input.customerId },
      data: { loyaltyStampsCached: agg._sum.delta ?? 0 },
    });
  });
}
