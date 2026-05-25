import { prisma } from '../../prisma.js';
import { generateEmbedding } from './embeddings.js';

export interface SemanticSearchResult {
  id: string;
  content: string;
  score: number;
  source: 'faq' | 'knowledge';
  faqItemId?: string;
  documentId?: string;
}

/**
 * Semantic search across FAQ embeddings and knowledge chunks for a salon.
 * Uses pgvector cosine distance operator (<=>).
 */
export async function semanticSearch(
  salonId: string,
  query: string,
  options: { limit?: number; threshold?: number } = {},
): Promise<SemanticSearchResult[]> {
  const { limit = 5, threshold = 0.78 } = options;

  const { embedding } = await generateEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  const faqResults = await prisma.$queryRawUnsafe<
    { id: string; chunk: string; score: number; faq_item_id: string }[]
  >(
    `SELECT id, chunk, 1 - (embedding <=> $1::vector) as score, "faqItemId" as faq_item_id
     FROM "FaqEmbedding"
     WHERE "salonId" = $2
     AND 1 - (embedding <=> $1::vector) > $3
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    vectorStr,
    salonId,
    threshold,
    limit,
  );

  const kbResults = await prisma.$queryRawUnsafe<
    { id: string; content: string; score: number; document_id: string }[]
  >(
    `SELECT kc.id, kc.content, 1 - (kc.embedding <=> $1::vector) as score, kc."documentId" as document_id
     FROM "KnowledgeChunk" kc
     JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
     WHERE kc."salonId" = $2
     AND kd.active = true
     AND 1 - (kc.embedding <=> $1::vector) > $3
     ORDER BY kc.embedding <=> $1::vector
     LIMIT $4`,
    vectorStr,
    salonId,
    threshold,
    limit,
  );

  const results: SemanticSearchResult[] = [
    ...faqResults.map((r) => ({
      id: r.id,
      content: r.chunk,
      score: Number(r.score),
      source: 'faq' as const,
      faqItemId: r.faq_item_id,
    })),
    ...kbResults.map((r) => ({
      id: r.id,
      content: r.content,
      score: Number(r.score),
      source: 'knowledge' as const,
      documentId: r.document_id,
    })),
  ];

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
