-- Week 17: Agency / Reseller model (white-label support)

CREATE TYPE "AgencyUserRole" AS ENUM ('OWNER', 'MANAGER', 'VIEWER');

-- Agency table (platform-level, no RLS)
CREATE TABLE "Agency" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "primaryColor" TEXT DEFAULT '#6366f1',
  "domain" TEXT,
  "contactEmail" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");
CREATE UNIQUE INDEX "Agency_domain_key" ON "Agency"("domain");

-- Agency users (platform-level, no RLS)
CREATE TABLE "AgencyUser" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "AgencyUserRole" NOT NULL DEFAULT 'VIEWER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyUser_email_key" ON "AgencyUser"("email");
CREATE INDEX "AgencyUser_agencyId_idx" ON "AgencyUser"("agencyId");

ALTER TABLE "AgencyUser"
  ADD CONSTRAINT "AgencyUser_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add agencyId to Salon
ALTER TABLE "Salon" ADD COLUMN "agencyId" TEXT;

ALTER TABLE "Salon"
  ADD CONSTRAINT "Salon_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Salon_agencyId_idx" ON "Salon"("agencyId");
