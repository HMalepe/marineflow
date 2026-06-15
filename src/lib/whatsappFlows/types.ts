/** WhatsApp Flows — type definitions for data exchange and flow JSON. */

// ─── Data Exchange (what Meta POSTs to our endpoint) ────────────────────────

export interface FlowDataExchangeRequest {
  version: string;
  action: 'INIT' | 'data_exchange' | 'BACK';
  screen: string;
  data: Record<string, unknown>;
  flow_token: string;
}

export interface FlowDataExchangeResponse {
  version: string;
  screen: string;
  data: Record<string, unknown>;
}

/** Returned by the endpoint when the flow is complete (navigate to terminal screen). */
export interface FlowCompletionResponse {
  version: string;
  screen: '__FLOW_COMPLETION__';
  data: Record<string, unknown>;
}

// ─── What comes back in the WhatsApp webhook when a flow is submitted ────────

export interface NfmReply {
  response_json: string; // JSON string of the submitted data
  name: 'flow';
  body: string;
}

// ─── Screen IDs ──────────────────────────────────────────────────────────────

export const FLOW_SCREENS = {
  SERVICE: 'SERVICE_SCREEN',
  STAFF: 'STAFF_SCREEN',
  DATE: 'DATE_SCREEN',
  TIME: 'TIME_SCREEN',
  CONFIRM: 'CONFIRM_SCREEN',
} as const;

export type FlowScreen = (typeof FLOW_SCREENS)[keyof typeof FLOW_SCREENS];

// ─── Payload that the bot receives when the flow completes ───────────────────

export interface BookingFlowPayload {
  serviceId: string;
  staffId: string;
  date: string;          // YYYY-MM-DD
  slotStart: string;     // ISO timestamp
  serviceName: string;
  staffName: string;
  timeLabel: string;     // "10:30"
  flowToken: string;
}
