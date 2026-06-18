/**
 * Background worker — BullMQ scheduled jobs (after-hours ticket cleanup, etc.).
 */
import { logger } from './lib/logger.js';
import { registerScheduledJobs } from './jobs/index.js';

registerScheduledJobs()
  .then(() => {
    logger.info('worker_ready');
  })
  .catch((err) => {
    logger.error({ err }, 'worker_start_failed');
    process.exit(1);
  });
