import crypto from 'node:crypto';

/** PayFast expects PHP-style urlencode: spaces as +, percent-hex in UPPERCASE. */
export function payfastUrlEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, '+')
    .replace(/%[0-9a-f]{2}/gi, (hex) => hex.toUpperCase());
}

/**
 * MD5 signature for PayFast custom integration (field order = attribute table order, not alphabetical).
 * @see https://developers.payfast.co.za/docs#step_2__create_security_signature
 */
export function buildPayfastSignature(
  orderedFields: Array<[string, string]>,
  passphrase?: string,
): string {
  const pairs = orderedFields
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${payfastUrlEncode(value)}`);

  let paramString = pairs.join('&');
  if (passphrase?.trim()) {
    paramString += `&passphrase=${payfastUrlEncode(passphrase)}`;
  }

  return crypto.createHash('md5').update(paramString).digest('hex');
}

/** Build a GET redirect URL using the same encoding as the signature. */
export function buildPayfastRedirectUrl(
  baseUrl: string,
  orderedFields: Array<[string, string]>,
  signature: string,
): string {
  const query = orderedFields
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${payfastUrlEncode(value)}`)
    .join('&');
  return `${baseUrl}?${query}&signature=${signature}`;
}

export function trimPayfastCredential(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function resolvePayfastIsSandbox(explicitIsTest: boolean, nodeEnv: string): boolean {
  // Honour PAYFAST_IS_TEST when set; default is false (live) even in development.
  void nodeEnv;
  return explicitIsTest;
}

export const PAYFAST_PROCESS_URL_SANDBOX = 'https://sandbox.payfast.co.za/eng/process';
export const PAYFAST_PROCESS_URL_LIVE = 'https://www.payfast.co.za/eng/process';
