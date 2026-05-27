import 'dotenv/config';
import { execSync } from 'node:child_process';
import { buildApp } from './app.js';
import { env } from './config.js';

// Apply pending migrations on startup.
// migrate deploy is safe to run repeatedly — it skips already-applied migrations.
// db push was replaced because it fails on Unsupported("vector(1536)") schema types.
try {
  console.log('[STARTUP] Running prisma migrate deploy...');
  const output = execSync('npx prisma migrate deploy', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('[STARTUP] Migrations OK:', output.trim() || '(no output)');
} catch (e: unknown) {
  const err = e as { stderr?: string; stdout?: string; message?: string };
  console.error('[STARTUP] Migration FAILED — server starting anyway:', err.stderr || err.stdout || err.message);
}

const app = await buildApp();

await app.listen({ port: env.PORT, host: '0.0.0.0' });
