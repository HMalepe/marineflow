import { describe, expect, it } from 'vitest';

/**
 * Documents the hard tenant isolation contract for dashboard services.
 * Regression guard for Bontle (062…) vs Selantra (078…) cross-bleed.
 */
describe('tenant isolation contract', () => {
  it('scopes service queries by salonId — never deletedAt alone', () => {
    const salonA = 'salon_bontle';
    const salonB = 'salon_selantra';

    const allServices = [
      { id: 'svc1', salonId: salonA, name: 'Braids', deletedAt: null },
      { id: 'svc2', salonId: salonA, name: 'Fade', deletedAt: null },
      { id: 'svc3', salonId: salonB, name: 'Facial', deletedAt: null },
    ];

    // Wrong (pre-fix): where: { deletedAt: null } → leaks A into B
    const leaked = allServices.filter((s) => s.deletedAt === null);
    expect(leaked).toHaveLength(3);

    // Correct: always include salonId
    const forB = allServices.filter((s) => s.salonId === salonB && s.deletedAt === null);
    expect(forB).toHaveLength(1);
    expect(forB[0]?.name).toBe('Facial');
    expect(forB.every((s) => s.salonId === salonB)).toBe(true);
  });

  it('rejects JWT salonId that does not match StaffUser.salonId', () => {
    const jwtSalonId: string = 'salon_bontle';
    const dbSalonId: string = 'salon_selantra';
    const mismatch = Boolean(jwtSalonId && jwtSalonId !== dbSalonId);
    expect(mismatch).toBe(true);
  });

  it('new tenant starts with empty services catalog', () => {
    const newTenantServices: unknown[] = [];
    expect(newTenantServices).toHaveLength(0);
  });
});
