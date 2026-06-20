import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildApp } from './app.js';
import { env } from './config.js';
import { syncSuperAdminPasswordFromEnv } from './lib/syncSuperAdmin.js';
import { selfRegisterInngest } from './lib/inngest/selfRegister.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function deploy(): string {
  const directUrl = process.env.DIRECT_DATABASE_URL;
  return execSync('npx prisma migrate deploy', {
    encoding: 'utf-8',
    cwd: join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: directUrl ? { ...process.env, DATABASE_URL: directUrl } : process.env,
  });
}

// Apply pending migrations on startup.
// Handles P3005 ("schema not empty, no migration history") by auto-baselining:
//   1. Mark all pre-existing migrations as applied without running their SQL.
//   2. Re-run deploy so only NEW migrations (e.g. ensure_webhook_tables) execute.
// This is safe: baseline never touches existing tables; the ensure_* migration
// uses IF NOT EXISTS so it only creates tables that are genuinely missing.
try {
  console.log('[STARTUP] Running prisma migrate deploy...');
  console.log('[STARTUP] Migrations OK:', deploy().trim() || '(no output)');
} catch (e: unknown) {
  const err = e as { stderr?: string; stdout?: string; message?: string };
  const errOutput = err.stderr || err.stdout || err.message || '';

  if (errOutput.includes('P3018')) {
    // A previously-failed migration is blocking deploy — mark it as rolled back and retry.
    const match = errOutput.match(/Migration name:\s*(\S+)/);
    if (match) {
      const failedName = match[1]!;
      console.log(`[STARTUP] P3018 detected — resolving failed migration as rolled-back: ${failedName}`);
      try {
        execSync(`npx prisma migrate resolve --rolled-back "${failedName}"`, {
          encoding: 'utf-8',
          cwd: join(__dirname, '..'),
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        console.log('[STARTUP] Migrations OK after P3018 resolve:', deploy().trim() || '(no output)');
      } catch (resolveErr) {
        const re = resolveErr as { stderr?: string; stdout?: string; message?: string };
        console.error('[STARTUP] P3018 resolve failed — server starting anyway:', re.stderr || re.stdout || re.message);
      }
    } else {
      console.error('[STARTUP] P3018 detected but could not parse migration name — server starting anyway:', errOutput);
    }
  } else if (!errOutput.includes('P3005')) {
    console.error('[STARTUP] Migration FAILED — server starting anyway:', errOutput);
  } else {
    // P3005: DB has tables but no migration history — baseline then retry.
    console.log('[STARTUP] P3005 detected — auto-baselining existing migrations...');
    try {
      const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');
      const toBaseline = readdirSync(migrationsDir)
        .filter((d) => /^\d{14}_/.test(d))
        .sort()
        // Skip idempotent guard migrations — let deploy run their SQL
        .filter((d) => !d.includes('ensure_'));

      for (const migration of toBaseline) {
        try {
          execSync(`npx prisma migrate resolve --applied "${migration}"`, {
            encoding: 'utf-8',
            cwd: join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          console.log(`[STARTUP] Baselined: ${migration}`);
        } catch {
          // Already resolved or not applicable — ignore
        }
      }

      console.log('[STARTUP] Migrations OK after baseline:', deploy().trim() || '(no output)');
    } catch (baselineErr) {
      const be = baselineErr as { stderr?: string; stdout?: string; message?: string };
      console.error('[STARTUP] Baseline failed — server starting anyway:', be.stderr || be.stdout || be.message);
    }
  }
}

// ── Column safety net ────────────────────────────────────────────────────────
// If migrations were baselined (P3005 path) their SQL never ran.
// Apply any missing columns now with IF NOT EXISTS — completely idempotent.
try {
  const { prisma: _prisma } = await import('./lib/prisma.js');
  await _prisma.$executeRawUnsafe(`
    ALTER TABLE "Customer"
      ADD COLUMN IF NOT EXISTS "reviewCreditCents" INTEGER NOT NULL DEFAULT 0;
  `);
  await _prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReviewIncentiveClaim" (
      "id" TEXT NOT NULL,
      "salonId" TEXT NOT NULL,
      "customerId" TEXT NOT NULL,
      "appointmentId" TEXT,
      "token" TEXT NOT NULL,
      "rewardCents" INTEGER NOT NULL,
      "claimedAt" TIMESTAMP(3),
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReviewIncentiveClaim_pkey" PRIMARY KEY ("id")
    );
  `);
  await _prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ReviewIncentiveClaim_token_key" ON "ReviewIncentiveClaim"("token");`);
  await _prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReviewIncentiveClaim_salonId_idx" ON "ReviewIncentiveClaim"("salonId");`);
  await _prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReviewIncentiveClaim_customerId_idx" ON "ReviewIncentiveClaim"("customerId");`);
  await _prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReviewIncentiveClaim_appointmentId_idx" ON "ReviewIncentiveClaim"("appointmentId");`);
  console.log('[STARTUP] Column safety net OK (reviewCreditCents + ReviewIncentiveClaim)');
} catch (colErr) {
  console.error('[STARTUP] Column safety net failed:', colErr);
}

try {
  const { ensureSchemaColumns } = await import('./lib/ensureSchema.js');
  await ensureSchemaColumns();
  console.log('[STARTUP] Schema column guard OK (Appointment columns + ServiceAddon table)');
} catch (e) {
  console.error('[STARTUP] Schema column guard FAILED — bot may error on Appointment queries:', e);
}

try {
  console.log('[STARTUP] Running WhatsApp number backfill (if needed)...');
  const { execSync } = await import('node:child_process');
  execSync('npx tsx scripts/backfill-tenant-whatsapp-number.ts', {
    encoding: 'utf-8',
    cwd: join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (backfillErr) {
  const be = backfillErr as { stderr?: string; stdout?: string; message?: string };
  console.log('[STARTUP] WhatsApp backfill:', be.stdout?.trim() || be.stderr?.trim() || be.message || 'skipped');
}

try {
  const { warnTenantsMissingWhatsAppNumber } = await import('./lib/tenantWhatsAppStartupCheck.js');
  await warnTenantsMissingWhatsAppNumber();
} catch (e) {
  console.error('[STARTUP] Tenant WhatsApp routing check failed:', e);
}

try {
  const { isAnthropicConfigured } = await import('./lib/integrations/ai/claude.js');
  if (!isAnthropicConfigured()) {
    console.warn(
      '[STARTUP] ANTHROPIC_API_KEY is not set — natural-language date parsing and AI assist will not work. Add it on Railway for smarter booking.',
    );
  }
} catch {
  // ignore
}

try {
  console.log('[STARTUP] Syncing super admin password from env (if set)...');
  await syncSuperAdminPasswordFromEnv();
} catch (e) {
  console.error('[STARTUP] Super admin sync failed — continuing:', e);
}

const app = await buildApp();

await app.listen({ port: env.PORT, host: '0.0.0.0' });

// Self-sync our function list with Inngest Cloud now that we're listening, so
// new/changed functions never sit stale waiting for a manual resync.
await selfRegisterInngest(env.PORT);
