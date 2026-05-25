-- Week 24: Performance optimization indexes

-- Hot path: appointment lookups by staff + date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Appointment_staffId_start_status_idx"
  ON "Appointment" ("staffId", "start", "status")
  WHERE "status" NOT IN ('CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- Hot path: service list per salon (active only)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Service_salonId_active_sort_idx"
  ON "Service" ("salonId", "sortOrder")
  WHERE "active" = true;

-- Hot path: staff lookups per salon (active bookable)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Staff_salonId_active_bookable_idx"
  ON "Staff" ("salonId", "sortOrder")
  WHERE "active" = true AND "isBookable" = true AND "deletedAt" IS NULL;

-- Hot path: customer lookups by waId (bot inbound)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Customer_waId_salonId_idx"
  ON "Customer" ("waId", "salonId");

-- Hot path: conversation lookup for bot
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Conversation_customerId_step_idx"
  ON "Conversation" ("customerId", "step");

-- Hot path: messages by conversation for history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message" ("conversationId", "createdAt" DESC);
