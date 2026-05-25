import { env } from '../../../config.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/**
 * Generate an embedding vector for a single text input using OpenAI.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.EMBEDDING_MODEL,
      input: text,
      dimensions: env.EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embedding failed (${response.status}): ${err}`);
  }

  const data = (await response.json()) as {
    data: { embedding: number[]; index: number }[];
    usage: { prompt_tokens: number; total_tokens: number };
  };

  return {
    embedding: data.data[0]!.embedding,
    tokenCount: data.usage.total_tokens,
  };
}

/**
 * Generate embeddings for multiple texts in a single batch call.
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  if (texts.length === 0) return [];

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.EMBEDDING_MODEL,
      input: texts,
      dimensions: env.EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI batch embedding failed (${response.status}): ${err}`);
  }

  const data = (await response.json()) as {
    data: { embedding: number[]; index: number }[];
    usage: { prompt_tokens: number; total_tokens: number };
  };

  const tokensPerItem = Math.ceil(data.usage.total_tokens / texts.length);
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => ({ embedding: d.embedding, tokenCount: tokensPerItem }));
}
