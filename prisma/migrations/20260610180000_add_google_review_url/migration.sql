-- Google review funnel (§6.1): link sent to customers who give a 5-star rating
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "googleReviewUrl" TEXT;
