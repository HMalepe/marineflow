-- RLS smoke test
-- Run after: npm run db:migrate && npm run db:seed
--
-- IMPORTANT: RLS is ENABLE (not FORCE). In dev, the table owner bypasses policies.
-- To test RLS enforcement locally, connect as a non-owner role:
--
--   CREATE ROLE marineflow_app LOGIN PASSWORD 'test';
--   GRANT USAGE ON SCHEMA public TO marineflow_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO marineflow_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO marineflow_app;
--
-- Then connect as marineflow_app and run these queries:

-- 1. Without tenant context: should see 0 rows (RLS blocks)
SELECT set_config('app.current_tenant', '', true);
SELECT count(*) AS customers_no_context FROM "Customer";
-- Expected: 0

-- 2. With correct tenant context: should see seed data
SELECT set_config('app.current_tenant',
  (SELECT id FROM "Salon" WHERE slug = 'demo-salon' LIMIT 1), true);
SELECT count(*) AS customers_correct FROM "Customer";
-- Expected: >= 1

-- 3. With wrong tenant id: should see 0
SELECT set_config('app.current_tenant', 'nonexistent-id-xxxxxxxxx', true);
SELECT count(*) AS customers_wrong FROM "Customer";
-- Expected: 0

-- 4. Subquery policy test (Message via Conversation)
SELECT set_config('app.current_tenant',
  (SELECT id FROM "Salon" WHERE slug = 'demo-salon' LIMIT 1), true);
SELECT count(*) AS messages_correct FROM "Message";
-- Should return messages belonging to demo-salon conversations

SELECT set_config('app.current_tenant', 'nonexistent-id-xxxxxxxxx', true);
SELECT count(*) AS messages_wrong FROM "Message";
-- Expected: 0

-- 5. Week 7 — Knowledge tables RLS
SELECT set_config('app.current_tenant',
  (SELECT id FROM "Salon" WHERE slug = 'demo-salon' LIMIT 1), true);
SELECT count(*) AS kb_docs FROM "KnowledgeDocument";
SELECT count(*) AS kb_chunks FROM "KnowledgeChunk";
SELECT count(*) AS faq_embeddings FROM "FaqEmbedding";

SELECT set_config('app.current_tenant', 'nonexistent-id-xxxxxxxxx', true);
SELECT count(*) AS kb_docs_wrong FROM "KnowledgeDocument";
SELECT count(*) AS kb_chunks_wrong FROM "KnowledgeChunk";
SELECT count(*) AS faq_embed_wrong FROM "FaqEmbedding";
-- Expected: all 0
