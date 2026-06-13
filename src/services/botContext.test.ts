import { describe, expect, it } from 'vitest';

/** Mirrors bot.ts applyContextPatch — undefined removes keys for Prisma Json. */
function applyContextPatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

describe('applyContextPatch', () => {
  it('deletes keys when patch value is undefined', () => {
    expect(
      applyContextPatch(
        { handoffByStaff: true, pendingFirstName: 'Ann' },
        { handoffByStaff: undefined, pendingFirstName: undefined },
      ),
    ).toEqual({});
  });

  it('sets new values and keeps unrelated keys', () => {
    expect(
      applyContextPatch({ errorCount: 2 }, { errorCount: undefined, quickPickOptions: [] }),
    ).toEqual({ quickPickOptions: [] });
  });
});
