/**
 * CI Schema Linter — ensures all business models have a salonId field.
 *
 * Usage: npx tsx scripts/lint-schema-tenant.ts
 * Exit 1 if any business model is missing salonId.
 *
 * Platform models (no tenant scope required) are allowlisted below.
 * Sub-models that inherit tenant scope via a parent FK are also allowed
 * (e.g., TicketMessage belongs to Ticket which has salonId).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLATFORM_MODELS = new Set([
  'Salon',
  'SubscriptionPlan',
]);

const CHILD_MODELS = new Set([
  'TicketMessage',
  'LoyaltyLedger',
  'StaffService',
  'Message',
  'TimeOff',
]);

const schemaPath = resolve(import.meta.dirname ?? '.', '../prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf-8');

const models: { name: string; body: string }[] = [];
const modelStartRegex = /^model\s+(\w+)\s*\{/gm;
let match: RegExpExecArray | null;

while ((match = modelStartRegex.exec(schema)) !== null) {
  const modelName = match[1]!;
  const startIdx = match.index + match[0].length;
  let depth = 1;
  let i = startIdx;
  while (i < schema.length && depth > 0) {
    if (schema[i] === '{') depth++;
    else if (schema[i] === '}') depth--;
    i++;
  }
  models.push({ name: modelName, body: schema.slice(startIdx, i - 1) });
}

const errors: string[] = [];

for (const { name, body } of models) {
  if (PLATFORM_MODELS.has(name)) continue;
  if (CHILD_MODELS.has(name)) continue;

  const hasSalonId = /\bsalonId\s+String/.test(body);

  if (!hasSalonId) {
    errors.push(`  ✗ Model "${name}" is missing salonId (not in allowlist)`);
  }
}

if (errors.length > 0) {
  console.error('❌ Schema tenant lint FAILED:\n');
  errors.forEach((e) => console.error(e));
  console.error(`\n${errors.length} model(s) missing salonId.`);
  console.error('If this is a child model inheriting tenant scope, add it to CHILD_MODELS.');
  console.error('If this is a platform table, add it to PLATFORM_MODELS.');
  process.exit(1);
} else {
  console.log('✅ All business models have salonId — tenant lint passed.');
}
