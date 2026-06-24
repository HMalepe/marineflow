import { describe, expect, it } from 'vitest';
import { isInSupportTicketFlow, supportTicketSubject } from './supportTickets.js';

describe('supportTickets flow', () => {
  it('detects support menu and complaint paths', () => {
    expect(isInSupportTicketFlow('COMPLAINT', {})).toBe(true);
    expect(isInSupportTicketFlow('OTHER_QUERY', {})).toBe(true);
    expect(isInSupportTicketFlow('MENU', { menuCategory: 'support' })).toBe(true);
    expect(isInSupportTicketFlow('FAQ', { menuCategory: 'support' })).toBe(false);
    expect(isInSupportTicketFlow('MENU', { menuCategory: 'services' })).toBe(false);
  });

  it('builds readable subjects', () => {
    expect(
      supportTicketSubject({ upset: true, step: 'MENU', context: {} }),
    ).toBe('Upset customer — needs attention');
    expect(
      supportTicketSubject({ upset: false, step: 'OTHER_QUERY', context: {} }),
    ).toBe('Support — speak to reception');
  });
});
