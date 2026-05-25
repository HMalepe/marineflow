-- Week 5 migration: Booking status parity, CancellationReason enum

-- Extend AppointmentStatus enum
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';

-- CancellationReason enum
CREATE TYPE "CancellationReason" AS ENUM (
    'CUSTOMER_REQUEST',
    'STAFF_UNAVAILABLE',
    'NO_SHOW_AUTO',
    'DUPLICATE',
    'PAYMENT_FAILED',
    'SALON_CLOSED',
    'OTHER'
);

-- Migrate cancellationReason column from text to enum
-- First drop the existing text column if it has data and recreate as enum
-- Since this is a new field from Week 4 (no production data), safe to alter directly
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "cancellationReason";
ALTER TABLE "Appointment" ADD COLUMN "cancellationReason" "CancellationReason";
