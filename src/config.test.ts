import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/** Mirror of envBoolean in config.ts — keep in sync when changing parser. */
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

describe('envBoolean', () => {
  const parsePayfast = envBoolean(false);

  it('treats string "false" as false (Railway / .env quirk)', () => {
    expect(parsePayfast.parse('false')).toBe(false);
  });

  it('treats string "true" as true', () => {
    expect(parsePayfast.parse('true')).toBe(true);
  });

  it('defaults when unset', () => {
    expect(parsePayfast.parse(undefined)).toBe(false);
  });
});
