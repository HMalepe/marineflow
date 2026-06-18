-- Add passwordHash to Customer for client self-service auth
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
