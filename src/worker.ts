/**
 * Background worker entry — attach BullMQ processors / cron here.
 * Keeps default `npm run worker` safe without requiring queue wiring for CI.
 */
import { logger } from './lib/logger.js';

logger.info({ msg: 'worker_stub_ready' }, 'Attach BullMQ processors for reminders and reconciliation.');
