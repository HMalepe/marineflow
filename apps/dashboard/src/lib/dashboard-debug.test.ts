import { describe, expect, it } from 'vitest';
import { isDashboardDebugClientEnabled } from './dashboard-debug-flag';
import {
  isDashboardDebugEnabled,
  isNextInternalNavigationError,
  serializeDashboardError,
} from './dashboard-debug';

describe('dashboard-debug', () => {
  it('isDashboardDebugClientEnabled respects NEXT_PUBLIC_DASHBOARD_DEBUG', () => {
    const prev = process.env.NEXT_PUBLIC_DASHBOARD_DEBUG;
    process.env.NEXT_PUBLIC_DASHBOARD_DEBUG = 'true';
    expect(isDashboardDebugClientEnabled()).toBe(true);
    expect(isDashboardDebugEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_DASHBOARD_DEBUG = '0';
    expect(isDashboardDebugClientEnabled()).toBe(false);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_DASHBOARD_DEBUG;
    else process.env.NEXT_PUBLIC_DASHBOARD_DEBUG = prev;
  });

  it('serializeDashboardError captures Error fields', () => {
    const err = new Error('boom');
    const out = serializeDashboardError(err);
    expect(out.message).toBe('boom');
    expect(out.name).toBe('Error');
    expect(out.stack).toBeTruthy();
  });

  it('isNextInternalNavigationError detects NEXT_ digests', () => {
    expect(isNextInternalNavigationError({ digest: 'NEXT_REDIRECT' })).toBe(true);
    expect(isNextInternalNavigationError(new Error('x'))).toBe(false);
  });
});
