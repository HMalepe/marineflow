/**
 * Week 1 — Foundation & sandbox validation (runbook).
 * Check items off as you complete them; mirror this in your tracker if you use one.
 */
export interface WeekTask {
  id: string;
  title: string;
  /** Short hint — command or doc pointer */
  hint?: string;
}

export const WEEK_ONE_TASKS: WeekTask[] = [
  {
    id: 'w1-env',
    title: 'Copy .env.example → .env and set DATABASE_URL, REDIS_URL, SESSION_SECRET, INTERNAL_API_KEY',
    hint: 'Never commit .env',
  },
  {
    id: 'w1-twilio-vars',
    title: 'Add Twilio sandbox vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM',
    hint: 'Sandbox uses whatsapp:+14155238886 style From',
  },
  {
    id: 'w1-db-up',
    title: 'Start Postgres + Redis (docker compose up -d or your host URLs)',
    hint: 'docker compose up -d from project root',
  },
  {
    id: 'w1-migrate-seed',
    title: 'Run prisma migrate + seed',
    hint: 'npm run db:migrate && npm run db:seed',
  },
  {
    id: 'w1-health',
    title: 'Verify GET /healthz returns ok (database + redis true)',
    hint: 'npm run dev then curl http://localhost:3000/healthz',
  },
  {
    id: 'w1-planned-catalog',
    title: 'Open GET /api/planned/catalog (or dashboard button) and skim Week 1 stubs',
    hint: 'Foundation stubs under /api/planned/meta/*, integrations/*, jobs/*',
  },
  {
    id: 'w1-tunnel',
    title: 'Expose HTTPS URL for webhooks (ngrok / Cloudflare Tunnel / VS Code port forward)',
    hint: 'Twilio needs a public URL',
  },
  {
    id: 'w1-webhook-url',
    title: 'Set TWILIO_WEBHOOK_BASE_URL to exact public origin (no trailing slash mismatch)',
    hint: 'Must match URL Twilio uses when signing requests',
  },
  {
    id: 'w1-twilio-console',
    title: 'Point Twilio WhatsApp sandbox webhook to POST …/webhooks/twilio/whatsapp',
    hint: 'Twilio Console → Messaging → Sandbox',
  },
  {
    id: 'w1-e2e-chat',
    title: 'Send a sandbox WhatsApp message; confirm bot/menu reply and DB rows (Customer, Message)',
    hint: 'Use seed salon slug demo-salon',
  },
  {
    id: 'w1-dashboard',
    title: 'Log into dashboard (owner@demo-salon.local / demo123) and load Today’s appointments',
    hint: 'http://localhost:3000',
  },
  {
    id: 'w1-meta-doc',
    title: 'Skim Meta Business Manager + WABA requirements (no code)',
    hint: 'https://www.twilio.com/docs/whatsapp/tutorial/whatsapp-business-account',
  },
];
