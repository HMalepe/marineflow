-- Week 8: pg_trgm extension for CRM fuzzy/typo-tolerant customer search

-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fuzzy matching on Customer fields
CREATE INDEX "Customer_firstName_trgm_idx" ON "Customer"
  USING gin ("firstName" gin_trgm_ops);

CREATE INDEX "Customer_lastName_trgm_idx" ON "Customer"
  USING gin ("lastName" gin_trgm_ops);

CREATE INDEX "Customer_displayName_trgm_idx" ON "Customer"
  USING gin ("displayName" gin_trgm_ops);

CREATE INDEX "Customer_email_trgm_idx" ON "Customer"
  USING gin (email gin_trgm_ops);

CREATE INDEX "Customer_waId_trgm_idx" ON "Customer"
  USING gin ("waId" gin_trgm_ops);

-- Set default similarity threshold (can be overridden per-session)
-- This is the minimum similarity for the % operator
SELECT set_limit(0.3);
