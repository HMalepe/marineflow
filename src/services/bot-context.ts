import type { ConversationStep } from '@prisma/client';

/**
 * Typed shape for Conversation.context JSON column.
 * Persisted as JSON in Postgres; validated at read boundaries.
 */
export interface BotSessionData {
  selectedServiceId?: string;
  selectedStaffId?: string;
  localDateStr?: string;
  pendingAppointmentId?: string;
  managingAppointmentId?: string;
  loyaltyRedemptionPending?: boolean;
  previousStep?: ConversationStep;
  undoStack?: ConversationStep[];
  intentClassification?: string;
  lastClassifierConfidence?: number;
  retryCount?: number;
  locale?: string;
}

export function parseSessionData(raw: unknown): BotSessionData {
  if (!raw || typeof raw !== 'object') return {};
  return raw as BotSessionData;
}

export function serializeSessionData(data: BotSessionData): object {
  return data as object;
}
