import { env } from '../../config.js';
import { inngestIsDev } from './client.js';

/**
 * Re-register this app's current function list with Inngest Cloud on boot.
 *
 * Inngest Cloud keeps a snapshot of the functions an app exposes; events for
 * functions added since the last sync are silently dropped. Normally the sync
 * only fires when something hits `PUT /api/inngest` (e.g. the dashboard's
 * "Resync" button), so a fresh deploy with new functions stays stale until a
 * human remembers to resync. Triggering that PUT against ourselves once the
 * server is listening makes every deploy self-sync, hands-off.
 *
 * Only runs in cloud mode (signing key present, not dev) — local dev uses the
 * Inngest Dev Server, which discovers functions on its own. Best-effort: a
 * failure here must never crash the boot, since the app is otherwise healthy.
 */
export async function selfRegisterInngest(port: number): Promise<void> {
  if (inngestIsDev || !env.INNGEST_SIGNING_KEY) return;

  // Hit ourselves on the loopback interface rather than PUBLIC_BASE_URL, so the
  // sync never depends on external DNS/routing being live yet at boot.
  const url = `http://127.0.0.1:${port}/api/inngest`;
  try {
    const res = await fetch(url, { method: 'PUT' });
    if (res.ok) {
      console.log('[STARTUP] Inngest resync OK — function list registered with Inngest Cloud.');
    } else {
      console.warn(`[STARTUP] Inngest resync returned ${res.status} — functions may be stale until next resync.`);
    }
  } catch (err) {
    console.warn('[STARTUP] Inngest resync failed — continuing:', err);
  }
}
