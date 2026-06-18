-- Ensure UploadedFile exists on production DBs that skipped week19 deploy

CREATE TABLE IF NOT EXISTS "UploadedFile" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'general',
  "uploadedBy" TEXT,
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadedFile_key_key" ON "UploadedFile"("key");
CREATE INDEX IF NOT EXISTS "UploadedFile_salonId_idx" ON "UploadedFile"("salonId");
CREATE INDEX IF NOT EXISTS "UploadedFile_salonId_purpose_idx" ON "UploadedFile"("salonId", "purpose");

DO $$ BEGIN
  ALTER TABLE "UploadedFile"
    ADD CONSTRAINT "UploadedFile_salonId_fkey"
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "UploadedFile" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY salon_isolation ON "UploadedFile"
    USING ("salonId" = current_setting('app.current_tenant', true));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
