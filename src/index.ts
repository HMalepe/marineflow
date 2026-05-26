import 'dotenv/config';
import { execSync } from 'node:child_process';
import { buildApp } from './app.js';
import { env } from './config.js';

// Sync database schema on startup
try {
  console.log('[STARTUP] Running prisma db push...');
  const output = execSync('npx prisma db push --accept-data-loss', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('[STARTUP] Schema sync OK:', output);
} catch (e: unknown) {
  const err = e as { stderr?: string; stdout?: string; message?: string };
  console.error('[STARTUP] Schema sync FAILED:', err.stderr || err.stdout || err.message);
}

const app = await buildApp();

await app.listen({ port: env.PORT, host: '0.0.0.0' });
