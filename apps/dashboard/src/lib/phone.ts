/** Digits only from local SA input (after +27 prefix). */
export function stripPhoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** Format 9-digit local number for display: "82 123 4567" */
export function formatSaPhoneDisplay(digits: string): string {
  const d = stripPhoneDigits(digits).slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

/** Validate local SA mobile digits (9 digits, no leading 0). */
export function isValidSaPhoneLocal(digits: string): boolean {
  const d = stripPhoneDigits(digits);
  return /^[1-9]\d{8}$/.test(d);
}

/** Build E.164 phone from +27 prefix and local digits entered by the user. */
export function formatSaPhone(localDigits: string): string {
  let digits = stripPhoneDigits(localDigits);

  if (digits.startsWith('27') && digits.length >= 11) {
    return `+${digits.slice(0, 11)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    digits = digits.slice(1);
  }

  return `+27${digits}`;
}
