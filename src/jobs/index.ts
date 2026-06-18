import { Queue, Worker } from 'bullmq';
import { env } from '../config.js';
import { logger } from '../lib/logger.js';
import { autoResolveAfterHoursTickets } from './autoResolveAfterHoursTickets.js';

export const AUTO_RESOLVE_QUEUE = 'auto-resolve-after-hours-tickets';

const connection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null as null,
};

let started = false;

export async function registerScheduledJobs(): Promise<void> {
  if (started) return;
  started = true;

  const queue = new Queue(AUTO_RESOLVE_QUEUE, { connection });

  await queue.add(
    'autoResolveAfterHoursTickets',
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: 'autoResolveAfterHoursTickets-hourly',
      removeOnComplete: 24,
      removeOnFail: 48,
    },
  );

  const worker = new Worker(
    AUTO_RESOLVE_QUEUE,
    async () => {
      const count = await autoResolveAfterHoursTickets();
      return { resolved: count };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'auto_resolve_after_hours_job_failed');
  });

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'auto_resolve_after_hours_job_completed');
  });

  logger.info({ queue: AUTO_RESOLVE_QUEUE }, 'bullmq_jobs_registered');
}
