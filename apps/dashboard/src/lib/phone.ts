/** Digits only from local SA input (after +27 prefix). */
export function stripPhoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Normalize pasted / autofilled SA numbers to local digits only (no +27 / 27 / 0 prefix).
 * The login UI shows a fixed +27 prefix, so values like +27621234567 must become 621234567.
 */
export function parseSaLocalPhoneInput(input: string): string {
  let digits = stripPhoneDigits(input);
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Full international: 27 + 9 local digits (11 total)
  if (digits.startsWith('27') && digits.length >= 11) {
    return digits.slice(2, 11);
  }

  // Duplicate country code in the local-only field (e.g. paste +27 into the national box)
  if (digits.startsWith('27')) {
    return digits.slice(2, 11);
  }

  // National format with leading 0
  if (digits.startsWith('0')) {
    return digits.slice(1, 10);
  }

  return digits.slice(0, 9);
}

/** Format 9-digit local number for display: "82 123 4567" */
export function formatSaPhoneDisplay(input: string): string {
  const d = parseSaLocalPhoneInput(input);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

/** Validate local SA mobile digits (9 digits, no leading 0). */
export function isValidSaPhoneLocal(digits: string): boolean {
  const d = parseSaLocalPhoneInput(digits);
  return /^[1-9]\d{8}$/.test(d);
}

/** Build E.164 phone from +27 prefix and local digits entered by the user. */
export function formatSaPhone(localDigits: string): string {
  return `+27${parseSaLocalPhoneInput(localDigits)}`;
}
