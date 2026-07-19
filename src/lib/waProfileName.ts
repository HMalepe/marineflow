/**
 * Derive a usable first name from a WhatsApp profile display name
 * (Twilio `ProfileName` / Meta `contacts[].profile.name`).
 */
export function firstNameFromWaProfile(profileName: string | undefined | null): string | null {
  if (!profileName?.trim()) return null;

  // Strip common emoji / symbols; keep letters, spaces, hyphen, apostrophe.
  const cleaned = profileName
    .trim()
    .replace(/[^\p{L}\p{M}\s'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  const first = cleaned.split(' ')[0] ?? '';
  // Letters (any language) / hyphen / apostrophe, 1–80 chars — mirrors bot PROFILE_NAME_REGEX intent.
  if (!/^[\p{L}\p{M}\s'-]{1,80}$/u.test(first)) return null;
  // Avoid treating phone-like leftovers as names
  if (/^\d+$/.test(first)) return null;
  return first;
}
