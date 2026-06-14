import { PrismaClient } from '@prisma/client';

/** Idempotent ALTERs for columns that may be missing after a P3005 baseline. */
const APPOINTMENT_COLUMN_GUARDS = [
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder24hSentAt" TIMESTAMP(3)',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder2hSentAt" TIMESTAMP(3)',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder24hFailed" BOOLEAN NOT NULL DEFAULT false',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder2hFailed" BOOLEAN NOT NULL DEFAULT false',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reviewRequestSentAt" TIMESTAMP(3)',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "penaltyWaivedAt" TIMESTAMP(3)',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "penaltyWaivedBy" TEXT',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancellationPenaltyApplied" BOOLEAN NOT NULL DEFAULT false',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "depositForfeited" BOOLEAN NOT NULL DEFAULT false',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "addonServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[]',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "csatSentAt" TIMESTAMP(3)',
  'ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "csatScore" INT',
] as const;

/**
 * Apply missing Appointment columns directly — survives baselined migrations and
 * PgBouncer migrate failures. Uses DIRECT_DATABASE_URL when set (Railway).
 */
export async function ensureSchemaColumns(): Promise<void> {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });

  try {
    for (const sql of APPOINTMENT_COLUMN_GUARDS) {
      await client.$executeRawUnsafe(sql);
    }
  } finally {
    await client.$disconnect();
  }
}
