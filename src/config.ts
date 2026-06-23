import { z } from 'zod';

/** Loaded via `import 'dotenv/config'` in entrypoints (keeps tests able to set env first). */

/** z.coerce.boolean() treats the string "false" as true — parse env flags explicitly. */
function envBoolean(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined) return defaultValue;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const lower = v.trim().toLowerCase();
      if (lower === '' || lower === '0' || lower === 'false' || lower === 'no' || lower === 'off') {
        return false;
      }
      if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') return true;
      return defaultValue;
    });
}

function envBooleanOptional() {
  return z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const lower = v.trim().toLowerCase();
      if (lower === '' || lower === '0' || lower === 'false' || lower === 'no' || lower === 'off') {
        return false;
      }
      if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') return true;
      return undefined;
    });
}

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
  OZOW_IS_TEST: envBoolean(true),
  PAYFAST_MERCHANT_ID: z.string().optional().transform((v) => v?.trim() || undefined),
  PAYFAST_MERCHANT_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
  PAYFAST_PASSPHRASE: z.string().optional().transform((v) => v?.trim() || undefined),
  PAYFAST_SANDBOX_MERCHANT_ID: z.string().optional().transform((v) => v?.trim() || undefined),
  PAYFAST_SANDBOX_MERCHANT_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
  PAYFAST_SANDBOX_PASSPHRASE: z.string().optional().transform((v) => v?.trim() || undefined),
  PAYFAST_IS_TEST: envBoolean(false),
  SESSION_SECRET: z
    .string()
    .min(32)
    .refine(
      (s) => process.env.NODE_ENV !== 'production' || s !== 'change-me-to-a-random-32-char-string',
      { message: 'SESSION_SECRET must be changed from the example value in production' },
    ),
  DEFAULT_SALON_SLUG: z.string().default('demo-salon'),
  MESSAGING_PROVIDER: z.enum(['twilio', 'meta']).default('twilio'),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_API_VERSION: z.string().default('v21.0'),
  /** WhatsApp Flow ID for the native booking experience. Set after first deploy of ensureBookingFlow(). */
  WHATSAPP_FLOW_ID: z.string().optional(),
  /** RSA private key (PEM) for decrypting WhatsApp Flows data exchange requests. */
  FLOW_PRIVATE_KEY: z.string().optional(),
  /** WhatsApp Business Account ID (WABA ID) — used to create/manage Flows via Graph API. */
  META_WABA_ID: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  /** Set to 1 for local Inngest dev server; auto-enabled in development when no signing key. */
  INNGEST_DEV: envBooleanOptional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-5'),
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

/** BOT_DEBUG is ignored in production (see botDebug.ts); warn instead of crash-looping deploys. */
if (env.NODE_ENV === 'production' && process.env.BOT_DEBUG === 'true') {
  console.warn(
    '[config] BOT_DEBUG=true is set but ignored in production — remove it from Railway env vars.',
  );
}

export function isTwilioAccountConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
}

export function isTwilioConfigured(): boolean {
  return isTwilioAccountConfigured();
}
