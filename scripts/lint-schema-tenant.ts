/**
 * CI Schema Linter — ensures all business models have a salonId field.
 *
 * Usage: npx tsx scripts/lint-schema-tenant.ts
 * Exit 1 if any business model is missing salonId.
 *
 * Platform models (no tenant scope required) are allowlisted.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLATFORM_MODELS = new Set([
  'Salon',
  'StaffUser',
]);

const schemaPath = resolve(import.meta.dirname ?? '.', '../prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf-8');

const modelRegex = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
const errors: string[] = [];

let match: RegExpExecArray | null;
while ((match = modelRegex.exec(schema)) !== null) {
  const modelName = match[1]!;
  const body = match[2]!;

  if (PLATFORM_MODELS.has(modelName)) continue;

  const hasSalonId = /salonId\s+String/.test(body);
  const hasSalonRelation = /salon\s+Salon/.test(body);
  const isJoinOrSubquery = /\w+Id\s+String/.test(body) && !hasSalonId;

  if (isJoinOrSubquery && !hasSalonId) {
    const referencesParentWithSalon =
      /(\w+)\s+\w+\s+@relation\(fields:\s*\[\w+Id\]/.test(body);
    if (referencesParentWithSalon) continue;
  }

  if (!hasSalonId && !hasSalonRelation) {
    errors.push(`  ✗ Model "${modelName}" is missing salonId (not in platform allowlist)`);
  }
}

if (errors.length > 0) {
  console.error('❌ Schema tenant lint FAILED:\n');
  errors.forEach((e) => console.error(e));
  console.error(`\n${errors.length} model(s) missing salonId.`);
  console.error('If this model is a platform table, add it to PLATFORM_MODELS in this script.');
  process.exit(1);
} else {
  console.log('✅ All business models have salonId — tenant lint passed.');
}
