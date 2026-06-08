import { z } from 'zod';

/** Loaded via `import 'dotenv/config'` in entrypoints (keeps tests able to set env first). */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_WEBHOOK_BASE_URL: z.string().url().default('http://localhost:3000'),
  INTERNAL_API_KEY: z.string().min(8),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OZOW_SITE_CODE: z.string().optional(),
  OZOW_PRIVATE_KEY: z.string().optional(),
  OZOW_API_KEY: z.string().optional(),
  OZOW_IS_TEST: z.coerce.boolean().default(true),
  PAYFAST_MERCHANT_ID: z.string().optional(),
  PAYFAST_MERCHANT_KEY: z.string().optional(),
  PAYFAST_PASSPHRASE: z.string().optional(),
  PAYFAST_IS_TEST: z.coerce.boolean().default(true),
  SESSION_SECRET: z.string().min(16),
  DEFAULT_SALON_SLUG: z.string().default('demo-salon'),
  MESSAGING_PROVIDER: z.enum(['twilio', 'meta']).default('twilio'),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_API_VERSION: z.string().default('v21.0'),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  DASHBOARD_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('marineflow-uploads'),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

export function isTwilioAccountConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
}

export function isTwilioConfigured(): boolean {
  return Boolean(isTwilioAccountConfigured() && env.TWILIO_WHATSAPP_FROM);
}
