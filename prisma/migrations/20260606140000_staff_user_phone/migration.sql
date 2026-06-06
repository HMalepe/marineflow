ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "phone" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StaffUser_phone_key" ON "StaffUser"("phone");
