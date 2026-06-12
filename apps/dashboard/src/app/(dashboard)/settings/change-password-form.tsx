'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { SaveErrorFeedback } from '@/components/save-feedback';
import { PasswordManagerUsernameField } from '@/components/password-manager-username-field';
import {
  loginUrlAfterPasswordChange,
  promptSavePassword,
  resolvePasswordManagerUsername,
} from '@/lib/password-manager';
import { changePassword } from './actions';

function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/i.test(password)) return 'Password must include a letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  return null;
}

interface Props {
  email: string;
  phone?: string | null;
}

export function ChangePasswordForm({ email, phone }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const username = useMemo(
    () => resolvePasswordManagerUsername({ email, phone }),
    [email, phone],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const current = form.get('currentPassword') as string;
    const next = form.get('newPassword') as string;
    const confirm = form.get('confirmPassword') as string;

    if (!current) {
      setError('Enter your current password');
      return;
    }

    const pwError = validateStrongPassword(next);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (current === next) {
      setError('New password must be different from your current password');
      return;
    }
    if (next !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const result = await changePassword(current, next);
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }

      if (username) {
        await promptSavePassword(username, next);
        window.location.assign(loginUrlAfterPasswordChange(username));
        return;
      }

      window.location.assign('/login?passwordChanged=1');
    } catch {
      setSaving(false);
    }
  }

  if (!username) {
    return (
      <p className="text-sm text-destructive">
        Could not determine your login username. Contact support to change your password.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4 max-w-md"
      autoComplete="on"
      method="post"
    >
      <PasswordManagerUsernameField username={username} />

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          required
          autoComplete="current-password"
          disabled={saving}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          required
          autoComplete="new-password"
          minLength={8}
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">
          At least 8 characters, with a letter and a number.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          autoComplete="off"
          minLength={8}
          disabled={saving}
        />
      </div>

      {error && (
        <SaveErrorFeedback message={error} className="rounded-md bg-destructive/10 px-3 py-2" />
      )}

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? 'Saving…' : 'Update password'}
      </Button>
      <p className="text-xs text-muted-foreground">
        After saving, your browser may ask to remember the new password when you sign in again.
      </p>
    </form>
  );
}
