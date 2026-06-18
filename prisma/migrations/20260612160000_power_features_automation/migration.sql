-- Power features: reminders, penalties, add-ons, membership, referrals

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder24hSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminder2hSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reviewRequestSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "penaltyWaivedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "penaltyWaivedBy" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "cancellationPenaltyApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "addonServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "ReferralCode" ADD COLUMN IF NOT EXISTS "rewardCents" INTEGER NOT NULL DEFAULT 5000;

CREATE TABLE IF NOT EXISTS "ServiceAddon" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "addonServiceId" TEXT NOT NULL,
    "pitchMessage" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceAddon_serviceId_addonServiceId_key" ON "ServiceAddon"("serviceId", "addonServiceId");
CREATE INDEX IF NOT EXISTS "ServiceAddon_salonId_idx" ON "ServiceAddon"("salonId");
CREATE INDEX IF NOT EXISTS "ServiceAddon_serviceId_idx" ON "ServiceAddon"("serviceId");

DO $$ BEGIN
    ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_addonServiceId_fkey" FOREIGN KEY ("addonServiceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MembershipPlan" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "visitsPerMonth" INTEGER NOT NULL DEFAULT 4,
    "savingsCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MembershipPlan_salonId_idx" ON "MembershipPlan"("salonId");

DO $$ BEGIN
    ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CustomerMembership" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "visitsRemaining" INTEGER NOT NULL,
    "renewsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMembership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomerMembership_salonId_customerId_idx" ON "CustomerMembership"("salonId", "customerId");
CREATE INDEX IF NOT EXISTS "CustomerMembership_salonId_active_idx" ON "CustomerMembership"("salonId", "active");

DO $$ BEGIN
    ALTER TABLE "CustomerMembership" ADD CONSTRAINT "CustomerMembership_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CustomerMembership" ADD CONSTRAINT "CustomerMembership_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CustomerMembership" ADD CONSTRAINT "CustomerMembership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
