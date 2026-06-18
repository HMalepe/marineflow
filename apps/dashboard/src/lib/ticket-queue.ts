export type TicketSlaLevel = 'critical' | 'overdue' | null;

export function ticketSlaLevel(status: string, createdAt: string): TicketSlaLevel {
  if (status !== 'OPEN') return null;
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (60 * 60 * 1000);
  if (ageHours >= 72) return 'critical';
  if (ageHours >= 24) return 'overdue';
  return null;
}

function slaSortRank(level: TicketSlaLevel): number {
  if (level === 'critical') return 0;
  if (level === 'overdue') return 1;
  return 2;
}

/** Critical first, then overdue, then newest createdAt. */
export function sortTicketQueue<T extends { status: string; createdAt: string }>(tickets: T[]): T[] {
  return [...tickets].sort((a, b) => {
    const rankDiff =
      slaSortRank(ticketSlaLevel(a.status, a.createdAt)) -
      slaSortRank(ticketSlaLevel(b.status, b.createdAt));
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function isNoiseTicket(status: string): boolean {
  return status === 'AUTO_RESOLVED';
}

export function isActiveQueueTicket(status: string): boolean {
  return status !== 'AUTO_RESOLVED';
}
