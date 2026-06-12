'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { SaveErrorFeedback } from '@/components/save-feedback';
import { changePassword } from './actions';

function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/i.test(password)) return 'Password must include a letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  return null;
}

export function ChangePasswordForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const current = form.get('currentPassword') as string;
    const next = form.get('newPassword') as string;
    const confirm = form.get('confirmPassword') as string;

    const pwError = validateStrongPassword(next);
    if (pwError) { setError(pwError); return; }
    if (next !== confirm) { setError('Passwords do not match'); return; }

    setSaving(true);
    const result = await changePassword(current, next);
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      // Session cleared server-side — redirect to login.
      router.push('/login');
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput id="newPassword" name="newPassword" required autoComplete="new-password" minLength={8} />
        <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="new-password" minLength={8} />
      </div>

      {error && <SaveErrorFeedback message={error} className="rounded-md bg-destructive/10 px-3 py-2" />}

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  );
}
