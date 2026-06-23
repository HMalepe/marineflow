-- PayFast recurring subscription token for VIP customer memberships
ALTER TABLE "CustomerMembership" ADD COLUMN IF NOT EXISTS "payfastToken" TEXT;
ALTER TABLE "CustomerMembership" ADD COLUMN IF NOT EXISTS "payfastSubscriptionId" TEXT;

CREATE INDEX IF NOT EXISTS "CustomerMembership_salonId_payfastToken_idx"
  ON "CustomerMembership"("salonId", "payfastToken");
