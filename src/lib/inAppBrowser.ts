/** Detect embedded browsers that often break PayFast's payment-method UI. */

export function isAndroidUserAgent(ua: string): boolean {
  return /android/i.test(ua);
}

/**
 * WhatsApp / Meta / Instagram in-app browsers (and some Android WebViews).
 * Chrome Custom Tabs often look like normal Chrome — treat all Android as
 * "prefer external browser" for checkout; use this for stronger messaging.
 */
export function isLikelyInAppBrowser(ua: string): boolean {
  const u = ua.toLowerCase();
  return (
    u.includes('whatsapp') ||
    u.includes('fbav') ||
    u.includes('fban') ||
    u.includes('instagram') ||
    u.includes('; wv)') ||
    u.includes('webview')
  );
}

/** Open an https URL in Chrome on Android; falls back to the https URL if Chrome is missing. */
export function androidChromeIntentUrl(httpsUrl: string): string {
  const trimmed = httpsUrl.trim();
  if (!/^https:\/\//i.test(trimmed)) return trimmed;
  const withoutScheme = trimmed.replace(/^https:\/\//i, '');
  const fallback = encodeURIComponent(trimmed);
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
