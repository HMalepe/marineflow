-- Week 24: Performance optimization indexes
--
-- Plain CREATE INDEX (not CONCURRENTLY): `prisma migrate deploy` always runs a
-- migration inside a single transaction, and CONCURRENTLY is rejected by
-- Postgres inside a transaction block. These tables are small enough that the
-- brief lock is acceptable.

-- Hot path: appointment lookups by staff + date range
CREATE INDEX IF NOT EXISTS "Appointment_staffId_start_status_idx"
  ON "Appointment" ("staffId", "start", "status")
  WHERE "status" NOT IN ('CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- Hot path: service list per salon (active only)
CREATE INDEX IF NOT EXISTS "Service_salonId_active_sort_idx"
  ON "Service" ("salonId", "sortOrder")
  WHERE "active" = true;

-- Hot path: staff lookups per salon (active bookable)
CREATE INDEX IF NOT EXISTS "Staff_salonId_active_bookable_idx"
  ON "Staff" ("salonId", "sortOrder")
  WHERE "active" = true AND "isBookable" = true AND "deletedAt" IS NULL;

-- Hot path: customer lookups by waId (bot inbound)
CREATE INDEX IF NOT EXISTS "Customer_waId_salonId_idx"
  ON "Customer" ("waId", "salonId");

-- Hot path: conversation lookup for bot
CREATE INDEX IF NOT EXISTS "Conversation_customerId_step_idx"
  ON "Conversation" ("customerId", "step");

-- Hot path: messages by conversation for history
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message" ("conversationId", "createdAt" DESC);
