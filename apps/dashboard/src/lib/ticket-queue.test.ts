import { describe, expect, it } from 'vitest';
import { sortTicketQueue, ticketSlaLevel } from './ticket-queue.js';

describe('ticket-queue', () => {
  it('flags open tickets past SLA thresholds', () => {
    const old = new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString();
    const medium = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    expect(ticketSlaLevel('OPEN', old)).toBe('critical');
    expect(ticketSlaLevel('OPEN', medium)).toBe('overdue');
    expect(ticketSlaLevel('RESOLVED', old)).toBeNull();
  });

  it('sorts critical before overdue before newest', () => {
    const critical = {
      status: 'OPEN',
      createdAt: new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString(),
    };
    const overdue = {
      status: 'OPEN',
      createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    };
    const fresh = {
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };
    const sorted = sortTicketQueue([fresh, overdue, critical]);
    expect(sorted.map((t) => t.createdAt)).toEqual([
      critical.createdAt,
      overdue.createdAt,
      fresh.createdAt,
    ]);
  });
});
