import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUPPORT_TICKET_KEYWORDS,
  matchesSupportTicketKeywords,
  mergeSupportTicketKeywordsIntoMetadata,
  parseSupportTicketKeywordsFromMetadata,
} from './supportTicketKeywords.js';

describe('supportTicketKeywords', () => {
  it('matches upset phrases', () => {
    const keywords = [...DEFAULT_SUPPORT_TICKET_KEYWORDS];
    expect(matchesSupportTicketKeywords('I am so angry about this', keywords)).toBe(true);
    expect(matchesSupportTicketKeywords('very unhappy with my visit', keywords)).toBe(true);
    expect(matchesSupportTicketKeywords('hello thanks', keywords)).toBe(false);
  });

  it('round-trips keywords in salon metadata', () => {
    const meta = mergeSupportTicketKeywordsIntoMetadata({}, ['angry', 'unhappy']);
    expect(parseSupportTicketKeywordsFromMetadata(meta)).toEqual(['angry', 'unhappy']);
  });
});
