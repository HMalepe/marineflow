import { listPlatformEvents } from '../../services/platformEvents.js';

export async function getAdminPlatformEvents(limit: number) {
  const events = await listPlatformEvents(limit);
  return { events };
}
