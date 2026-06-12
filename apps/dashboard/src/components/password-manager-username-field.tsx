import type { PasswordManagerUsername } from '@/lib/password-manager';

/** Hidden username field so password managers associate the new password with the account. */
export function PasswordManagerUsernameField({ username }: { username: PasswordManagerUsername | null }) {
  if (!username?.value.trim()) return null;

  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value={username.value}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only pointer-events-none"
    />
  );
}
