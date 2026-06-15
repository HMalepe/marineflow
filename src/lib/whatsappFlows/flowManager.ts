/**
 * WhatsApp Flows — Graph API management (create, update, publish).
 * Runs on startup to ensure the booking flow exists and is published.
 */

import { env } from '../../config.js';
import { logger } from '../logger.js';
import { buildBookingFlowJson } from './bookingFlowJson.js';

const API_BASE = 'https://graph.facebook.com';

function flowsUrl(wabaId: string): string {
  return `${API_BASE}/${env.META_API_VERSION}/${wabaId}/flows`;
}

function flowUrl(flowId: string): string {
  return `${API_BASE}/${env.META_API_VERSION}/${flowId}`;
}

function flowAssetsUrl(flowId: string): string {
  return `${API_BASE}/${env.META_API_VERSION}/${flowId}/assets`;
}

function flowPublishUrl(flowId: string): string {
  return `${API_BASE}/${env.META_API_VERSION}/${flowId}/publish`;
}

async function authHeaders() {
  return {
    Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/** Create a new flow and return its ID. */
async function createFlow(wabaId: string, salonName: string): Promise<string> {
  const res = await fetch(flowsUrl(wabaId), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      name: `${salonName} Booking Flow`,
      categories: ['APPOINTMENT_BOOKING'],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Flow create failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Upload (or replace) the flow JSON definition. */
async function uploadFlowJson(flowId: string, salonName: string): Promise<void> {
  const flowJson = buildBookingFlowJson(salonName);
  const form = new FormData();
  form.append('name', 'flow.json');
  form.append(
    'asset_type',
    'FLOW_JSON',
  );
  form.append(
    'file',
    new Blob([JSON.stringify(flowJson)], { type: 'application/json' }),
    'flow.json',
  );

  const res = await fetch(flowAssetsUrl(flowId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.META_ACCESS_TOKEN}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Flow JSON upload failed (${res.status}): ${err}`);
  }
}

/** Publish a draft flow so it becomes sendable. */
async function publishFlow(flowId: string): Promise<void> {
  const res = await fetch(flowPublishUrl(flowId), {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    // "already published" is not an error
    if (res.status === 400 && err.includes('already_published')) return;
    throw new Error(`Flow publish failed (${res.status}): ${err}`);
  }
}

/** Get current flow status. Returns null if not found. */
async function getFlowStatus(flowId: string): Promise<{ status: string } | null> {
  const res = await fetch(`${flowUrl(flowId)}?fields=status,validation_errors`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  return (await res.json()) as { status: string };
}

/**
 * Ensure the booking flow is created, has the latest JSON, and is published.
 * Idempotent — safe to call on every startup.
 *
 * @param wabaId WhatsApp Business Account ID
 * @param existingFlowId If already known (stored in DB/env), pass it to skip creation
 * @returns The flow ID (create one if needed)
 */
export async function ensureBookingFlow(params: {
  wabaId: string;
  salonName: string;
  existingFlowId?: string | null;
}): Promise<string> {
  if (!env.META_ACCESS_TOKEN) {
    throw new Error('META_ACCESS_TOKEN not configured — cannot manage WhatsApp Flows');
  }

  let flowId = params.existingFlowId?.trim() || null;

  if (!flowId) {
    logger.info({ wabaId: params.wabaId }, 'whatsapp_flow_creating');
    flowId = await createFlow(params.wabaId, params.salonName);
    logger.info({ flowId }, 'whatsapp_flow_created');
  }

  // Always upload latest JSON (idempotent on Meta's side)
  await uploadFlowJson(flowId, params.salonName);
  logger.info({ flowId }, 'whatsapp_flow_json_uploaded');

  // Publish if not already live
  const status = await getFlowStatus(flowId);
  if (status?.status !== 'PUBLISHED') {
    await publishFlow(flowId);
    logger.info({ flowId }, 'whatsapp_flow_published');
  }

  return flowId;
}
