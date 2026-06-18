import { describe, expect, it } from 'vitest';
import { assertSavepointLabel } from './tenantSession.js';

describe('assertSavepointLabel', () => {
  it('accepts snake_case labels used by bot savepoints', () => {
    expect(() => assertSavepointLabel('services_catalog')).not.toThrow();
    expect(() => assertSavepointLabel('welcome_journey')).not.toThrow();
  });

  it('rejects labels with unsafe characters', () => {
    expect(() => assertSavepointLabel('services;drop')).toThrow(/Invalid savepoint label/);
    expect(() => assertSavepointLabel('')).toThrow(/Invalid savepoint label/);
  });
});
