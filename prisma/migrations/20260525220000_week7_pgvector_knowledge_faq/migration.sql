-- Week 7: pgvector, Knowledge Base, FAQ embeddings & approval workflow
-- Prerequisites: PostgreSQL 15+ with pgvector extension available

-- Enable pgvector extension (optional — semantic search only, not required for core bot)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pgvector extension not available — embedding columns will be skipped';
END $$;

-- FAQ approval status enum
CREATE TYPE "FaqStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- Add approval columns to FaqItem
ALTER TABLE "FaqItem"
  ADD COLUMN IF NOT EXISTS "status" "FaqStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FAQ Embeddings table (semantic search vectors)
CREATE TABLE IF NOT EXISTS "FaqEmbedding" (
  "id" TEXT NOT NULL,
  "faqItemId" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "chunk" TEXT NOT NULL,
  "embedding" vector(1536),
  "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaqEmbedding_pkey" PRIMARY KEY ("id")
);

-- Knowledge Documents table
CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
  "content" TEXT NOT NULL,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "embeddedAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- Knowledge Chunks table (embedded segments)
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "embedding" vector(1536),
  "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
DO $$ BEGIN
    ALTER TABLE "FaqEmbedding" ADD CONSTRAINT "FaqEmbedding_faqItemId_fkey"
  FOREIGN KEY ("faqItemId") REFERENCES "FaqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "FaqEmbedding" ADD CONSTRAINT "FaqEmbedding_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS "FaqEmbedding_salonId_idx" ON "FaqEmbedding"("salonId");
CREATE INDEX IF NOT EXISTS "FaqEmbedding_faqItemId_idx" ON "FaqEmbedding"("faqItemId");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_salonId_idx" ON "KnowledgeDocument"("salonId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_salonId_idx" ON "KnowledgeChunk"("salonId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_documentId_chunkIndex_idx" ON "KnowledgeChunk"("documentId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "FaqItem_status_idx" ON "FaqItem"("status");

-- HNSW indexes for fast ANN (approximate nearest neighbor) search
CREATE INDEX IF NOT EXISTS "FaqEmbedding_embedding_idx" ON "FaqEmbedding"
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk"
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- RLS policies
ALTER TABLE "FaqEmbedding" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FaqEmbedding"
  USING ("salonId" = current_setting('app.current_tenant', true));

ALTER TABLE "KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KnowledgeDocument"
  USING ("salonId" = current_setting('app.current_tenant', true));

ALTER TABLE "KnowledgeChunk" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KnowledgeChunk"
  USING ("salonId" = current_setting('app.current_tenant', true));
