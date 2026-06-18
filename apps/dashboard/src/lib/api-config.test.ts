import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './api-config';

describe('resolveApiUrl', () => {
  it('uses same-origin proxy paths in the browser', () => {
    expect(resolveApiUrl('api', '/me', { forBrowser: true })).toBe('/api/backend/me');
    expect(resolveApiUrl('admin', '/stats', { forBrowser: true })).toBe('/admin/backend/stats');
    expect(resolveApiUrl('agency', '/salons', { forBrowser: true })).toBe('/agency/backend/salons');
  });

  it('uses upstream API URL on the server', () => {
    expect(resolveApiUrl('api', '/settings', { forBrowser: false })).toMatch(/\/api\/settings$/);
  });
});
