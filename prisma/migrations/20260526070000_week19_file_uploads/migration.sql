-- Week 19: File uploads (S3-compatible storage)

CREATE TABLE "UploadedFile" (
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

CREATE UNIQUE INDEX "UploadedFile_key_key" ON "UploadedFile"("key");
CREATE INDEX "UploadedFile_salonId_idx" ON "UploadedFile"("salonId");
CREATE INDEX "UploadedFile_salonId_purpose_idx" ON "UploadedFile"("salonId", "purpose");

ALTER TABLE "UploadedFile"
  ADD CONSTRAINT "UploadedFile_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "UploadedFile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salon_isolation ON "UploadedFile"
  USING ("salonId" = current_setting('app.current_tenant', true));
