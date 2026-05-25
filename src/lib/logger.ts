import pino from 'pino';
import { env } from '../config.js';

export const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: 'marineflow-api',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
});
