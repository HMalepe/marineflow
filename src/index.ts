import 'dotenv/config';
import { execSync } from 'node:child_process';
import { buildApp } from './app.js';
import { env } from './config.js';

// Apply any pending database migrations before starting the server
try {
  console.log('[STARTUP] Running prisma migrate deploy...');
  const output = execSync('npx prisma migrate deploy', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('[STARTUP] Migration result:', output);
} catch (e: unknown) {
  const err = e as { stderr?: string; stdout?: string; message?: string };
  console.error('[STARTUP] Migration FAILED:', err.stderr || err.stdout || err.message);
}

const app = await buildApp();

await app.listen({ port: env.PORT, host: '0.0.0.0' });
