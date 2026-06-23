import Anthropic from '@anthropic-ai/sdk';
import type { Salon } from '@prisma/client';
import { claudeConverse, isAnthropicConfigured } from './claude.js';
import { semanticSearch } from './search.js';
import { loadSalonServiceCatalog, filterBookableCatalogServices } from '../../../services/serviceCatalogDisplay.js';
import { getSalonLocationInfo } from '../../../services/salonLocation.js';
import { formatCentsZar } from '../../formatPrice.js';
import { logger } from '../../logger.js';

export interface ReceptionAgentInput {
  salon: Salon;
  salonId: string;
  /** Chronological — oldest first. Last few turns only; older history is dropped. */
  history: Array<{ direction: 'in' | 'out'; body: string }>;
  inboundText: string;
  hasPaymentHistory?: boolean;
}

export type ReceptionAgentResult =
  | { kind: 'reply'; reply: string }
  | { kind: 'start_booking'; serviceNameGuess?: string }
  | { kind: 'escalate'; reason: string; urgent: boolean };

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_location',
    description:
      "Get the salon's address, parking notes, and a maps link. Pass the customer's own area/address if " +
      'they mentioned one to also get a live driving distance and ETA.',
    input_schema: {
      type: 'object',
      properties: {
        customerOrigin: {
          type: 'string',
          description: "The customer's address or area, e.g. 'Sandton' — omit if they haven't said one.",
        },
      },
    },
  },
  {
    name: 'search_faqs',
    description: "Search this salon's FAQ and knowledge base for an answer to the customer's question.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The question to search for.' } },
      required: ['query'],
    },
  },
  {
    name: 'get_services',
    description: 'List the bookable services this salon offers, with prices. Use before quoting any price or service name.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'start_booking',
    description:
      "Call this the moment the customer wants to book an appointment. Don't try to find slots or confirm " +
      'a time yourself — this hands off to the booking flow, which will take it from there.',
    input_schema: {
      type: 'object',
      properties: {
        serviceNameGuess: { type: 'string', description: 'The service they want, if mentioned.' },
      },
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Hand the conversation to a real team member. Use when the customer explicitly asks for a person, ' +
      "when you genuinely can't help after trying the other tools, or when the customer is angry, " +
      'distressed, or threatening (set urgent: true in that case).',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Brief summary of why this needs a human.' },
        urgent: { type: 'boolean', description: 'true if the customer is angry, distressed, or threatening.' },
      },
      required: ['reason'],
    },
  },
];

const MAX_TOOL_TURNS = 4;
const MAX_REPLY_CHARS = 600;

function parseHmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function isOpenNow(salon: Salon): boolean {
  const open = salon.openTime ?? '09:00';
  const close = salon.closeTime ?? '17:00';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: salon.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const nowMin = hour * 60 + minute;
  const openMin = parseHmToMin(open);
  const closeMin = parseHmToMin(close);
  if (closeMin <= openMin) return nowMin >= openMin || nowMin < closeMin;
  return nowMin >= openMin && nowMin < closeMin;
}

function buildSystemPrompt(salon: Salon, hasPaymentHistory: boolean | undefined): string {
  const name = salon.tradingName ?? salon.name;
  const open = salon.openTime ?? '09:00';
  const close = salon.closeTime ?? '17:00';

  return `You are the warm, switched-on human receptionist for ${name}, chatting with a customer on WhatsApp who tapped "Speak To Reception" because their question didn't fit the normal menu.

Personality: genuinely warm and conversational, like a real person — not a script. It's completely fine to chat naturally (ask how their day is, react to what they say, use a little humour) alongside answering their question. Keep replies WhatsApp-length — usually under ${MAX_REPLY_CHARS} characters, no markdown headers or bullet walls, a light emoji here and there is fine but don't overdo it.

Hours: ${open}-${close} (${salon.timezone}). The salon is currently ${isOpenNow(salon) ? 'OPEN' : 'CLOSED'}.

Ground every factual claim in a tool call — NEVER invent prices, services, the address, or distances. If a tool comes back empty and you genuinely don't know, say so honestly rather than guessing, and offer to get a team member.

Call start_booking the moment the customer clearly wants to book — don't try to find slots, staff, or times yourself, that's handled by the booking flow once you hand off.

Call escalate_to_human when: they explicitly ask for a person, you can't help after trying the relevant tools, or they seem angry/distressed/threatening (urgent: true in that case — never argue with an upset customer, just acknowledge and escalate).
${hasPaymentHistory === false ? "\nThis customer has no payment history with you yet — don't imply they're a returning customer or refer to 'the usual'." : ''}`;
}

async function executeTool(
  toolUse: Anthropic.ToolUseBlock,
  input: ReceptionAgentInput,
): Promise<unknown> {
  try {
    switch (toolUse.name) {
      case 'get_location': {
        const args = toolUse.input as { customerOrigin?: string };
        return await getSalonLocationInfo(input.salon, args.customerOrigin?.trim() || undefined);
      }
      case 'search_faqs': {
        const args = toolUse.input as { query: string };
        const results = await semanticSearch(input.salonId, args.query, { limit: 3, threshold: 0.65 });
        if (results.length === 0) return { found: false };
        return { found: true, snippets: results.map((r) => r.content.slice(0, 600)) };
      }
      case 'get_services': {
        const services = filterBookableCatalogServices(await loadSalonServiceCatalog(input.salonId));
        return {
          services: services
            .slice(0, 30)
            .map((s) => ({ name: s.name, price: formatCentsZar(s.priceCents) })),
        };
      }
      default:
        return { error: `unknown tool: ${toolUse.name}` };
    }
  } catch (err) {
    logger.warn({ err, tool: toolUse.name }, 'reception_agent_tool_failed');
    return { error: 'lookup failed' };
  }
}

/**
 * Multi-turn, tool-using conversational agent for the "Speak To Reception" flow.
 * Booking itself is never performed here — start_booking just hands off to the
 * existing deterministic flow, same as escalate_to_human hands off to a human.
 */
export async function runReceptionAgent(
  input: ReceptionAgentInput,
): Promise<ReceptionAgentResult | null> {
  if (!isAnthropicConfigured()) return null;

  const system = buildSystemPrompt(input.salon, input.hasPaymentHistory);
  const messages: Anthropic.MessageParam[] = [
    ...input.history.slice(-10).map((m) => ({
      role: m.direction === 'in' ? ('user' as const) : ('assistant' as const),
      content: m.body,
    })),
    { role: 'user', content: input.inboundText },
  ];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await claudeConverse({ system, messages, tools: TOOLS, maxTokens: 700 });
    if (!response) return null;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return text ? { kind: 'reply', reply: text } : null;
    }

    // Terminal tools end the conversation turn immediately — never executed as
    // data lookups, just signals back to the caller.
    const startBooking = toolUses.find((t) => t.name === 'start_booking');
    if (startBooking) {
      const args = startBooking.input as { serviceNameGuess?: string };
      return { kind: 'start_booking', serviceNameGuess: args.serviceNameGuess };
    }
    const escalate = toolUses.find((t) => t.name === 'escalate_to_human');
    if (escalate) {
      const args = escalate.input as { reason: string; urgent?: boolean };
      return { kind: 'escalate', reason: args.reason, urgent: Boolean(args.urgent) };
    }

    messages.push({ role: 'assistant', content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const result = await executeTool(toolUse, input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  logger.warn({ salonId: input.salonId }, 'reception_agent_exceeded_tool_turns');
  return null;
}
