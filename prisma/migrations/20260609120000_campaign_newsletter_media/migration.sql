-- Campaign newsletter: optional image/video attachment
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
