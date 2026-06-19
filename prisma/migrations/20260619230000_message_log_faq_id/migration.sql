-- Track which FAQ was served via MessageLog for performance stats.
ALTER TABLE "MessageLog" ADD COLUMN "faqId" TEXT;
CREATE INDEX "MessageLog_faqId_createdAt_idx" ON "MessageLog"("faqId", "createdAt");
