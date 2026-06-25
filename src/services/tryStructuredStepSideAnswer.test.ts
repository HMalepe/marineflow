import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Conversation, Customer, Salon } from '@prisma/client';

const { isAnthropicConfiguredMock, claudeTextMock } = vi.hoisted(() => ({
  isAnthropicConfiguredMock: vi.fn(),
  claudeTextMock: vi.fn(),
}));

vi.mock('../lib/integrations/ai/index.js', () => ({
  isAnthropicConfigured: isAnthropicConfiguredMock,
  claudeText: claudeTextMock,
  orchestrateConversation: vi.fn(),
  semanticSearch: vi.fn(),
}));

const { tryStructuredStepSideAnswer } = await import('./botAssistant.js');

function makeConv(): Conversation & { customer: Customer; salon: Salon } {
  return {
    salon: { name: 'Glow Salon', tradingName: null },
    customer: {},
  } as unknown as Conversation & { customer: Customer; salon: Salon };
}

describe('tryStructuredStepSideAnswer', () => {
  beforeEach(() => {
    isAnthropicConfiguredMock.mockReset();
    claudeTextMock.mockReset();
  });

  it('returns null when Anthropic is not configured', async () => {
    isAnthropicConfiguredMock.mockReturnValue(false);
    const result = await tryStructuredStepSideAnswer(makeConv(), 'how much is a haircut?');
    expect(result).toBeNull();
    expect(claudeTextMock).not.toHaveBeenCalled();
  });

  it('returns null for empty input without calling Claude', async () => {
    isAnthropicConfiguredMock.mockReturnValue(true);
    const result = await tryStructuredStepSideAnswer(makeConv(), '   ');
    expect(result).toBeNull();
    expect(claudeTextMock).not.toHaveBeenCalled();
  });

  it('returns null for oversized input without calling Claude', async () => {
    isAnthropicConfiguredMock.mockReturnValue(true);
    const result = await tryStructuredStepSideAnswer(makeConv(), 'a'.repeat(301));
    expect(result).toBeNull();
    expect(claudeTextMock).not.toHaveBeenCalled();
  });

  it('returns null when Claude responds NONE', async () => {
    isAnthropicConfiguredMock.mockReturnValue(true);
    claudeTextMock.mockResolvedValue('NONE');
    const result = await tryStructuredStepSideAnswer(makeConv(), '3');
    expect(result).toBeNull();
  });

  it('returns null when Claude returns nothing', async () => {
    isAnthropicConfiguredMock.mockReturnValue(true);
    claudeTextMock.mockResolvedValue(null);
    const result = await tryStructuredStepSideAnswer(makeConv(), 'xyz');
    expect(result).toBeNull();
  });

  it('returns a sanitized answer for a genuine side question', async () => {
    isAnthropicConfiguredMock.mockReturnValue(true);
    claudeTextMock.mockResolvedValue('*Yes*, we are open until 6pm!');
    const result = await tryStructuredStepSideAnswer(makeConv(), 'are you open late?');
    expect(result).toBe('Yes, we are open until 6pm!');
  });

  it('passes the salon trading name (or name) and trimmed text to Claude', async () => {
    isAnthropicConfiguredMock.mockReturnValue(true);
    claudeTextMock.mockResolvedValue('Sure thing!');
    const conv = makeConv();
    conv.salon.tradingName = 'Glow Studio';
    await tryStructuredStepSideAnswer(conv, '  do you take cash?  ');
    expect(claudeTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Glow Studio'),
        user: 'do you take cash?',
      }),
    );
  });
});
