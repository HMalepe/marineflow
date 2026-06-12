/** Dashboard copy of built-in conversation flow steps (mirrors server keys). */

export const BUILTIN_FLOW_DEFS = [
  {
    key: 'botAskMarketingConsent' as const,
    label: 'Ask for marketing consent (POPIA)',
    description:
      'Prompts new customers to accept or decline marketing messages before entering the menu.',
  },
  {
    key: 'botAllowStaffPick' as const,
    label: 'Let customers choose their stylist',
    description:
      'Shows a staff selection step after the customer picks a service. Disable to auto-assign the next available.',
  },
  {
    key: 'botLoyaltyEnabled' as const,
    label: 'Loyalty rewards in bot menu',
    description:
      'Shows "My rewards / loyalty" as a menu option so customers can check their stamp balance.',
  },
  {
    key: 'botRequireDepositStep' as const,
    label: 'Require deposit / payment before confirming',
    description:
      'When a service has a deposit or full-pay requirement, the bot sends a payment link before confirming. Disable to confirm immediately and collect payment in-person.',
  },
  {
    key: 'botWinbackEnabled' as const,
    label: 'Win-back messages (21-day inactive)',
    description:
      'Daily at 09:00 — messages customers who have not visited in 21–60 days. Requires marketing consent. Max 50 customers per day.',
  },
  {
    key: 'botBirthdayEnabled' as const,
    label: 'Birthday messages',
    description:
      'Daily at 08:00 — sends a birthday greeting with a treat offer. Requires date of birth on file and marketing consent.',
  },
] as const;

export type BuiltinFlowKey = (typeof BUILTIN_FLOW_DEFS)[number]['key'];

export interface CustomBotFlow {
  id: string;
  label: string;
  prompt: string;
  enabled: boolean;
}

export type FlowItem =
  | { type: 'builtin'; id: BuiltinFlowKey }
  | { type: 'custom'; id: string; flow: CustomBotFlow };

export function newCustomFlowId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `custom_${Date.now().toString(36)}_${rand}`.slice(0, 56);
}

export function buildFlowItems(
  order: string[],
  flags: Record<BuiltinFlowKey, boolean>,
  customFlows: CustomBotFlow[],
): FlowItem[] {
  const customById = new Map(customFlows.map((f) => [f.id, f]));
  const items: FlowItem[] = [];

  for (const id of order) {
    if ((BUILTIN_FLOW_DEFS as readonly { key: string }[]).some((d) => d.key === id)) {
      items.push({ type: 'builtin', id: id as BuiltinFlowKey });
      continue;
    }
    const flow = customById.get(id);
    if (flow) items.push({ type: 'custom', id, flow });
  }

  return items;
}

export function orderFromItems(items: FlowItem[]): string[] {
  return items.map((item) => item.id);
}
