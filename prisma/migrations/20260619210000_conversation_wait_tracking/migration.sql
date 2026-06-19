-- Track customer wait time and handoff resolution for inbox prioritisation.
ALTER TABLE "Conversation" ADD COLUMN "lastCustomerMessageAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Backfill wait anchor from the latest inbound message per conversation.
UPDATE "Conversation" c
SET "lastCustomerMessageAt" = sub.max_created
FROM (
  SELECT m."conversationId", MAX(m."createdAt") AS max_created
  FROM "Message" m
  WHERE m.direction = 'INBOUND'
  GROUP BY m."conversationId"
) sub
WHERE c.id = sub."conversationId";
