import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('payfastCredentials', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('uses sandbox credentials only when PAYFAST_IS_TEST is true', async () => {
    process.env.PAYFAST_IS_TEST = 'true';
    process.env.PAYFAST_SANDBOX_MERCHANT_ID = '10000100';
    process.env.PAYFAST_SANDBOX_MERCHANT_KEY = 'sandbox-key';
    process.env.PAYFAST_SANDBOX_PASSPHRASE = 'sandbox-pass';
    process.env.PAYFAST_MERCHANT_ID = 'live-merchant';
    process.env.PAYFAST_MERCHANT_KEY = 'live-key';

    const { payfastCredentials } = await import('./payfast.js');
    const creds = payfastCredentials();

    expect(creds.sandbox).toBe(true);
    expect(creds.merchantId).toBe('10000100');
    expect(creds.merchantKey).toBe('sandbox-key');
    expect(creds.merchantId).not.toBe('live-merchant');
  });

  it('does not treat live merchant ID as configured in sandbox mode', async () => {
    process.env.PAYFAST_IS_TEST = 'true';
    delete process.env.PAYFAST_SANDBOX_MERCHANT_ID;
    delete process.env.PAYFAST_SANDBOX_MERCHANT_KEY;
    process.env.PAYFAST_MERCHANT_ID = 'live-merchant';
    process.env.PAYFAST_MERCHANT_KEY = 'live-key';

    const { isPayfastConfigured } = await import('./payfast.js');
    expect(isPayfastConfigured()).toBe(false);
  });
});
