export { generateEmbedding, generateEmbeddings } from './embeddings.js';
export { semanticSearch, type SemanticSearchResult } from './search.js';
export { isAnthropicConfigured, claudeJson, claudeText } from './claude.js';
export {
  orchestrateConversation,
  type BotIntent,
  type OrchestratorInput,
  type OrchestratorResult,
} from './orchestrator.js';
export {
  runReceptionAgent,
  type ReceptionAgentInput,
  type ReceptionAgentResult,
} from './receptionAgent.js';

export interface ClassifierResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
}

export async function classifyIntent(
  tenantId: string,
  inboundText: string,
): Promise<ClassifierResult> {
  const { orchestrateConversation } = await import('./orchestrator.js');
  const result = await orchestrateConversation({
    salonName: 'Salon',
    currentStep: 'MENU',
    inboundText,
    openTime: '09:00',
    closeTime: '17:00',
    timezone: 'Africa/Johannesburg',
    recentMessages: [{ direction: 'in', body: inboundText }],
    services: [],
    staff: [],
    faqSnippets: [],
  });

  if (!result) {
    return { intent: 'unknown', confidence: 0, entities: {} };
  }

  return {
    intent: result.intent,
    confidence: 0.85,
    entities: {
      tenantId,
      serviceId: result.serviceId,
      staffId: result.staffId,
    },
  };
}
