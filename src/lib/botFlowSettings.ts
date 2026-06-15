import type { Prisma } from '@prisma/client';

export const BUILTIN_FLOW_KEYS = [
  'botAskMarketingConsent',
  'botAllowStaffPick',
  'botLoyaltyEnabled',
  'botRequirePaymentStep',
  'botWinbackEnabled',
  'botBirthdayEnabled',
] as const;

export type BuiltinFlowKey = (typeof BUILTIN_FLOW_KEYS)[number];

export interface CustomBotFlow {
  id: string;
  label: string;
  prompt: string;
  enabled: boolean;
}

export const DEFAULT_FLOW_ORDER: readonly BuiltinFlowKey[] = BUILTIN_FLOW_KEYS;

const CUSTOM_ID_RE = /^custom_[a-z0-9_-]{4,48}$/i;
const MAX_CUSTOM_FLOWS = 12;
const MAX_LABEL = 80;
const MAX_PROMPT = 500;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function isBuiltinFlowKey(id: string): id is BuiltinFlowKey {
  return (BUILTIN_FLOW_KEYS as readonly string[]).includes(id);
}

export function parseCustomBotFlows(raw: unknown): CustomBotFlow[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomBotFlow[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
    const enabled = item.enabled !== false;
    if (!CUSTOM_ID_RE.test(id) || !label) continue;
    out.push({
      id,
      label: label.slice(0, MAX_LABEL),
      prompt: prompt.slice(0, MAX_PROMPT),
      enabled,
    });
  }
  return out.slice(0, MAX_CUSTOM_FLOWS);
}

const LEGACY_FLOW_KEY_ALIASES: Record<string, BuiltinFlowKey> = {
  botRequireDepositStep: 'botRequirePaymentStep',
};

export function parseBotFlowOrder(raw: unknown, customFlows: CustomBotFlow[]): string[] {
  const customIds = new Set(customFlows.map((f) => f.id));
  const seen = new Set<string>();
  const order: string[] = [];

  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id !== 'string') continue;
      const normalized = LEGACY_FLOW_KEY_ALIASES[id] ?? id;
      if (!isBuiltinFlowKey(normalized) && !customIds.has(normalized)) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      order.push(normalized);
    }
  }

  for (const key of BUILTIN_FLOW_KEYS) {
    if (!seen.has(key)) order.push(key);
  }
  for (const flow of customFlows) {
    if (!seen.has(flow.id)) order.push(flow.id);
  }

  return order;
}

export function parseBotFlowSettingsFromMetadata(metadata: unknown): {
  order: string[];
  customFlows: CustomBotFlow[];
} {
  const meta = isRecord(metadata) ? metadata : {};
  const customFlows = parseCustomBotFlows(meta.botCustomFlows);
  const order = parseBotFlowOrder(meta.botFlowOrder, customFlows);
  return { order, customFlows };
}

export function validateBotFlowPayload(
  order: string[] | undefined,
  customFlows: CustomBotFlow[] | undefined,
): { order: string[]; customFlows: CustomBotFlow[] } | { error: string } {
  const flows = customFlows ?? [];
  if (flows.length > MAX_CUSTOM_FLOWS) {
    return { error: `Maximum ${MAX_CUSTOM_FLOWS} custom flow steps allowed.` };
  }

  for (const flow of flows) {
    if (!CUSTOM_ID_RE.test(flow.id)) {
      return { error: 'Invalid custom flow id.' };
    }
    if (!flow.label.trim()) {
      return { error: 'Every custom flow needs a label.' };
    }
    if (flow.label.length > MAX_LABEL) {
      return { error: `Flow labels must be ${MAX_LABEL} characters or fewer.` };
    }
    if (flow.prompt.length > MAX_PROMPT) {
      return { error: `Flow prompts must be ${MAX_PROMPT} characters or fewer.` };
    }
  }

  const normalizedFlows = flows.map((f) => ({
    id: f.id,
    label: f.label.trim(),
    prompt: f.prompt.trim(),
    enabled: f.enabled !== false,
  }));

  const normalizedOrder = parseBotFlowOrder(order, normalizedFlows);
  return { order: normalizedOrder, customFlows: normalizedFlows };
}

export function mergeBotFlowIntoMetadata(
  existing: unknown,
  order: string[],
  customFlows: CustomBotFlow[],
): Prisma.InputJsonValue {
  const base = isRecord(existing) ? { ...existing } : {};
  return {
    ...base,
    botFlowOrder: order,
    botCustomFlows: customFlows,
  } as unknown as Prisma.InputJsonValue;
}

export function newCustomFlowId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `custom_${Date.now().toString(36)}_${rand}`.slice(0, 56);
}
