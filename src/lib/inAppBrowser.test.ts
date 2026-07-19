import { describe, expect, it } from 'vitest';
import {
  androidChromeIntentUrl,
  isAndroidUserAgent,
  isLikelyInAppBrowser,
} from './inAppBrowser.js';

describe('inAppBrowser', () => {
  it('detects Android', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0.0.0')).toBe(
      true,
    );
    expect(isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      false,
    );
  });

  it('detects WhatsApp / WebView style agents', () => {
    expect(
      isLikelyInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 WhatsApp/2.24.0',
      ),
    ).toBe(true);
    expect(
      isLikelyInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(true);
    expect(
      isLikelyInAppBrowser(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(false);
  });

  it('builds a Chrome Intent URL with https fallback', () => {
    const url = 'https://api.example.com/pay/checkout/pay_1?continue=1';
    const intent = androidChromeIntentUrl(url);
    expect(intent).toContain('intent://api.example.com/pay/checkout/pay_1?continue=1#Intent;');
    expect(intent).toContain('scheme=https');
    expect(intent).toContain('package=com.android.chrome');
    expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent(url)}`);
  });
});
