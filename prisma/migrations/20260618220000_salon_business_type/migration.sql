-- Tenant business type (coarse category for platform UI and reporting)

CREATE TYPE "BusinessType" AS ENUM ('SALON', 'RESTAURANT', 'CAR_WASH', 'OTHER');

ALTER TABLE "Salon" ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'SALON';

UPDATE "Salon" SET "businessType" = 'RESTAURANT' WHERE "industryTemplate" = 'restaurant';
UPDATE "Salon" SET "businessType" = 'CAR_WASH' WHERE "industryTemplate" = 'carwash';
UPDATE "Salon" SET "businessType" = 'OTHER' WHERE "industryTemplate" IN ('fitness', 'clinic');
