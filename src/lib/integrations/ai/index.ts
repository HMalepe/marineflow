export { generateEmbedding, generateEmbeddings } from './embeddings.js';
export { semanticSearch, type SemanticSearchResult } from './search.js';

export interface ClassifierResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
}

export async function classifyIntent(
  _tenantId: string,
  _inboundText: string,
): Promise<ClassifierResult> {
  throw new Error('claude_classifier_not_implemented');
}
