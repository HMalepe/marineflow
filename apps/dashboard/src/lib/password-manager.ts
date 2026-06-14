/** Helpers for browser password manager integration (save / update prompts). */

import { sanitizePostLoginRedirect } from './post-login-redirect';

export type PasswordManagerUsername =
  | { type: 'email'; value: string }
  | { type: 'phone'; value: string };

export type LoginRedirectTab = 'email' | 'whatsapp';

export interface LoginRedirectParams {
  passwordChanged: boolean;
  tab: LoginRedirectTab;
  email: string;
  phone: string;
  /** Path to open after sign-in (from middleware session expiry). */
  redirectPath: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailForPasswordManager(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalize to E.164 (+27…) or null when invalid. */
export function normalizePhoneForPasswordManager(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length === 11) return `+${digits}`;
  if (/^[1-9]\d{8}$/.test(digits)) return `+27${digits}`;
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export function isValidPasswordManagerEmail(email: string): boolean {
  const normalized = normalizeEmailForPasswordManager(email);
  return normalized.length > 0 && normalized.length <= 254 && EMAIL_RE.test(normalized);
}

export function resolvePasswordManagerUsername(params: {
  email: string;
  phone?: string | null;
  /** When true, use email even if phone exists (e.g. email-tab login). */
  preferEmail?: boolean;
}): PasswordManagerUsername | null {
  const phone = params.phone ? normalizePhoneForPasswordManager(params.phone) : null;
  const email = normalizeEmailForPasswordManager(params.email);
  const emailValid = isValidPasswordManagerEmail(email);

  if (params.preferEmail && emailValid) return { type: 'email', value: email };
  if (phone) return { type: 'phone', value: phone };
  if (emailValid) return { type: 'email', value: email };
  return null;
}

export function passwordManagerUsernameId(username: PasswordManagerUsername): string {
  return username.value;
}

export function parseLoginRedirectParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): LoginRedirectParams {
  const passwordChanged = searchParams.get('passwordChanged') === '1';

  const emailRaw = searchParams.get('email') ?? '';
  const email = isValidPasswordManagerEmail(emailRaw)
    ? normalizeEmailForPasswordManager(emailRaw)
    : '';

  const phoneRaw = searchParams.get('phone') ?? '';
  const phone = normalizePhoneForPasswordManager(phoneRaw) ?? '';

  const tabParam = searchParams.get('tab');
  let tab: LoginRedirectTab = tabParam === 'email' ? 'email' : 'whatsapp';
  if (tab === 'email' && !email) tab = phone ? 'whatsapp' : 'whatsapp';
  if (tab === 'whatsapp' && !phone && email) tab = 'email';

  return {
    passwordChanged,
    tab,
    email,
    phone,
    redirectPath: sanitizePostLoginRedirect(searchParams.get('redirect')),
  };
}

export function loginUrlAfterPasswordChange(username: PasswordManagerUsername): string {
  const params = new URLSearchParams({ passwordChanged: '1' });
  if (username.type === 'email') {
    params.set('email', username.value);
    params.set('tab', 'email');
  } else {
    params.set('phone', username.value);
    params.set('tab', 'whatsapp');
  }
  return `/login?${params.toString()}`;
}

/**
 * Ask the browser to save/update the password (Chrome, Edge, Safari 17+).
 * Requires HTTPS and a user gesture (e.g. form submit).
 */
export async function promptSavePassword(
  username: PasswordManagerUsername,
  password: string,
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  if (!username.value.trim() || !password) return false;

  const PasswordCredentialCtor = (
    globalThis as typeof globalThis & {
      PasswordCredential?: new (data: {
        id: string;
        password: string;
        name?: string;
      }) => Credential;
    }
  ).PasswordCredential;

  if (!PasswordCredentialCtor || !navigator.credentials?.store) return false;

  try {
    const cred = new PasswordCredentialCtor({
      id: username.value,
      password,
      name: username.value,
    });
    await navigator.credentials.store(cred);
    return true;
  } catch {
    return false;
  }
}
