import { getTenantDb } from '../lib/db/tenantSession.js';
import { prisma } from '../lib/prisma.js';
import { generateEmbeddings } from '../lib/integrations/ai/index.js';

const MAX_CHUNK_TOKENS = 500;
const CHUNK_OVERLAP = 50;

/**
 * Naive token estimation (~4 chars per token for English text).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into overlapping chunks based on paragraph boundaries.
 */
export function chunkText(text: string, maxTokens = MAX_CHUNK_TOKENS, overlap = CHUNK_OVERLAP): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(/\s+/);
      const overlapWords = words.slice(-overlap);
      current = overlapWords.join(' ') + '\n\n' + para;
      currentTokens = estimateTokens(current);
    } else {
      current += (current ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Ingest a knowledge document: store, chunk, and embed.
 */
export async function ingestKnowledgeDocument(input: {
  salonId: string;
  title: string;
  content: string;
  sourceUrl?: string;
  mimeType?: string;
}): Promise<string> {
  const db = getTenantDb();
  const chunks = chunkText(input.content);

  const doc = await db.knowledgeDocument.create({
    data: {
      salonId: input.salonId,
      title: input.title,
      content: input.content,
      sourceUrl: input.sourceUrl,
      mimeType: input.mimeType ?? 'text/plain',
      chunkCount: chunks.length,
    },
  });

  const embeddings = await generateEmbeddings(chunks);

  for (let i = 0; i < chunks.length; i++) {
    const vectorStr = `[${embeddings[i]!.embedding.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeChunk" (id, "documentId", "salonId", "chunkIndex", content, "tokenCount", embedding, model, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::vector, $7, now())`,
      doc.id,
      input.salonId,
      i,
      chunks[i]!,
      embeddings[i]!.tokenCount,
      vectorStr,
      'text-embedding-3-small',
    );
  }

  await db.knowledgeDocument.update({
    where: { id: doc.id },
    data: { embeddedAt: new Date() },
  });

  return doc.id;
}

/**
 * Generate and store embeddings for an FAQ item.
 */
export async function embedFaqItem(faqItemId: string, salonId: string): Promise<void> {
  const db = getTenantDb();
  const faq = await db.faqItem.findUniqueOrThrow({ where: { id: faqItemId } });

  const textToEmbed = `${faq.question}\n\n${faq.answer}`;
  const chunks = chunkText(textToEmbed, MAX_CHUNK_TOKENS, CHUNK_OVERLAP);
  const embeddings = await generateEmbeddings(chunks);

  await prisma.$executeRawUnsafe(
    `DELETE FROM "FaqEmbedding" WHERE "faqItemId" = $1`,
    faqItemId,
  );

  for (let i = 0; i < chunks.length; i++) {
    const vectorStr = `[${embeddings[i]!.embedding.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "FaqEmbedding" (id, "faqItemId", "salonId", chunk, embedding, model, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, now())`,
      faqItemId,
      salonId,
      chunks[i]!,
      vectorStr,
      'text-embedding-3-small',
    );
  }
}
