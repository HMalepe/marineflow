-- Week 9: Branch model for multi-location support (Phase 2)

-- Branch table
CREATE TABLE "Branch" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "address" TEXT,
  "city" TEXT,
  "province" TEXT,
  "postalCode" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "timezone" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one slug per salon
CREATE UNIQUE INDEX "Branch_salonId_slug_key" ON "Branch"("salonId", "slug");
CREATE INDEX "Branch_salonId_idx" ON "Branch"("salonId");

-- FK to Salon
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add branchId to Staff (optional)
ALTER TABLE "Staff" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Staff_branchId_idx" ON "Staff"("branchId");

-- Add branchId to Appointment (optional)
ALTER TABLE "Appointment" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add branchId to WorkingHour (optional)
ALTER TABLE "WorkingHour" ADD COLUMN "branchId" TEXT;
ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "WorkingHour_branchId_idx" ON "WorkingHour"("branchId");

-- RLS on Branch
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Branch"
  USING ("salonId" = current_setting('app.current_tenant', true));
