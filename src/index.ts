import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildApp } from './app.js';
import { env } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function deploy(): string {
  return execSync('npx prisma migrate deploy', {
    encoding: 'utf-8',
    cwd: join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
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

  if (!errOutput.includes('P3005')) {
    console.error('[STARTUP] Migration FAILED — server starting anyway:', errOutput);
  } else {
    // P3005: DB has tables but no migration history — baseline then retry.
    console.log('[STARTUP] P3005 detected — auto-baselining existing migrations...');
    try {
      const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');
      const toBaseline = readdirSync(migrationsDir)
        .filter((d) => /^\d{14}_/.test(d))
        .sort()
        // Skip the idempotent guard migration — let deploy run its SQL
        .filter((d) => !d.includes('ensure_webhook_tables'));

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

const app = await buildApp();

await app.listen({ port: env.PORT, host: '0.0.0.0' });
