import { config } from 'dotenv';

config({ path: '.env.test', override: true });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://salon:salon@localhost:5432/salon_whatsapp_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.PUBLIC_BASE_URL ??= 'http://localhost:3000';
process.env.TWILIO_WEBHOOK_BASE_URL ??= 'http://localhost:3000';
process.env.INTERNAL_API_KEY ??= 'test-internal-key-123456789';
process.env.SESSION_SECRET ??= 'test-session-secret-minimum-32-characters-long';
process.env.DEFAULT_SALON_SLUG ??= 'demo-salon';
