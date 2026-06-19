-- Ticket queue: after-hours noise auto-resolve + SLA tracking fields.
CREATE TYPE "TicketType" AS ENUM ('GENERAL', 'AFTER_HOURS_MESSAGE');
ALTER TYPE "TicketStatus" ADD VALUE 'AUTO_RESOLVED';
ALTER TABLE "Ticket" ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Ticket" ADD COLUMN "inboundCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Ticket_salonId_type_status_idx" ON "Ticket"("salonId", "type", "status");
