import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../../config.js';
import { logger } from '../../logger.js';

let client: Anthropic | null = null;

export function isAnthropicConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export async function claudeJson<T>(input: {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}): Promise<T | null> {
  if (!isAnthropicConfigured()) return null;

  try {
    const response = await getClient().messages.create({
      model: input.model ?? env.CLAUDE_MODEL,
      max_tokens: input.maxTokens ?? 1024,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
    });

    const text = response.content
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ text: text.slice(0, 200) }, 'claude_json_parse_miss');
      return null;
    }

    return JSON.parse(jsonMatch[0]) as T;
  } catch (err) {
    logger.warn({ err }, 'claude_request_failed');
    return null;
  }
}

/**
 * Live connectivity check for diagnostics — unlike claudeJson/claudeText this
 * does not swallow the error, so a caller can show *why* the key is dead
 * (revoked, wrong model id, rate limited, etc.), not just that it is.
 */
export async function pingAnthropic(): Promise<
  { ok: true; model: string } | { ok: false; error: string }
> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: 'ANTHROPIC_API_KEY not set' };
  }
  try {
    const response = await getClient().messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    });
    return { ok: true, model: response.model };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function claudeText(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  if (!isAnthropicConfigured()) return null;

  try {
    const response = await getClient().messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: input.maxTokens ?? 512,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
    });

    return response.content
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim() || null;
  } catch (err) {
    logger.warn({ err }, 'claude_text_failed');
    return null;
  }
}
