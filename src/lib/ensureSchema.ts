import { PrismaClient } from '@prisma/client';

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

const SERVICE_COLUMN_GUARDS = [
  'ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)',
] as const;

const LOYALTY_PROGRAM_COLUMN_GUARDS = [
  'ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "rewardDescription" TEXT DEFAULT \'\'',
] as const;

const STAFF_SERVICE_COLUMN_GUARDS = [
  'ALTER TABLE "StaffService" ADD COLUMN IF NOT EXISTS "priceCentsOverride" INTEGER',
] as const;

const CUSTOMER_COLUMN_GUARDS = [
  `DO $$ BEGIN
    CREATE TYPE "MarketingConsentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentStatus" "MarketingConsentStatus" NOT NULL DEFAULT 'PENDING'`,
  `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3)`,
  `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false`,
] as const;

/** Idempotent ALTERs for columns that may be missing after a P3005 baseline. */
const SCHEMA_COLUMN_GUARDS = [
  ...APPOINTMENT_COLUMN_GUARDS,
  ...SERVICE_COLUMN_GUARDS,
  ...LOYALTY_PROGRAM_COLUMN_GUARDS,
  ...STAFF_SERVICE_COLUMN_GUARDS,
  ...CUSTOMER_COLUMN_GUARDS,
] as const;

/** One statement per entry — PgBouncer/Prisma cannot run multi-command prepared statements. */
const SERVICE_ADDON_TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS "ServiceAddon" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "addonServiceId" TEXT NOT NULL,
    "pitchMessage" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ServiceAddon_serviceId_addonServiceId_key"
    ON "ServiceAddon"("serviceId", "addonServiceId")`,
  `CREATE INDEX IF NOT EXISTS "ServiceAddon_salonId_idx" ON "ServiceAddon"("salonId")`,
  `CREATE INDEX IF NOT EXISTS "ServiceAddon_serviceId_idx" ON "ServiceAddon"("serviceId")`,
] as const;

const CONSENT_RECORD_TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS "ConsentRecord" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ConsentRecord_salonId_idx" ON "ConsentRecord"("salonId")`,
  `CREATE INDEX IF NOT EXISTS "ConsentRecord_customerId_idx" ON "ConsentRecord"("customerId")`,
  `CREATE INDEX IF NOT EXISTS "ConsentRecord_salonId_customerId_type_idx"
    ON "ConsentRecord"("salonId", "customerId", "type")`,
] as const;

const CONSENT_RECORD_FKEY_GUARDS = [
  `DO $$ BEGIN
    ALTER TABLE "ConsentRecord"
      ADD CONSTRAINT "ConsentRecord_salonId_fkey"
      FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TABLE "ConsentRecord"
      ADD CONSTRAINT "ConsentRecord_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
] as const;

const CUSTOMER_CAMPAIGN_INDEX_GUARDS = [
  `CREATE INDEX IF NOT EXISTS "Customer_salonId_marketingConsentStatus_idx"
    ON "Customer"("salonId", "marketingConsentStatus")`,
  `CREATE INDEX IF NOT EXISTS "Customer_salonId_marketingConsentStatus_dateOfBirth_idx"
    ON "Customer"("salonId", "marketingConsentStatus", "dateOfBirth")`,
] as const;

const SERVICE_ADDON_FKEY_GUARDS = [
  `DO $$ BEGIN
    ALTER TABLE "ServiceAddon"
      ADD CONSTRAINT "ServiceAddon_salonId_fkey"
      FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TABLE "ServiceAddon"
      ADD CONSTRAINT "ServiceAddon_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TABLE "ServiceAddon"
      ADD CONSTRAINT "ServiceAddon_addonServiceId_fkey"
      FOREIGN KEY ("addonServiceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
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
    for (const sql of SCHEMA_COLUMN_GUARDS) {
      await client.$executeRawUnsafe(sql);
    }
    for (const sql of SERVICE_ADDON_TABLE_DDL) {
      await client.$executeRawUnsafe(sql);
    }
    for (const sql of SERVICE_ADDON_FKEY_GUARDS) {
      await client.$executeRawUnsafe(sql);
    }
    for (const sql of CONSENT_RECORD_TABLE_DDL) {
      await client.$executeRawUnsafe(sql);
    }
    for (const sql of CONSENT_RECORD_FKEY_GUARDS) {
      await client.$executeRawUnsafe(sql);
    }
    for (const sql of CUSTOMER_CAMPAIGN_INDEX_GUARDS) {
      await client.$executeRawUnsafe(sql);
    }
  } finally {
    await client.$disconnect();
  }
}
