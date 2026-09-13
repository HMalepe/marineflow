ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "securityQuestion" TEXT;
ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "securityAnswerHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StaffUser_username_key" ON "StaffUser"("username");
