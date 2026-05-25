/**
 * Anthropic Claude — Week 4 (intent classifier + bounded Q&A).
 * @see docs/schema-migration-plan.md
 */

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
