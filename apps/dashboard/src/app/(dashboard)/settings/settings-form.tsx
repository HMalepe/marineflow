'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { updateName, updateEmail } from './actions';

function formatRole(role: string): string {
  return role.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    salonId: string;
  };
}

export function SettingsForm({ user }: Props) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nameDirty = name.trim() !== user.name && name.trim().length >= 2;
  const emailDirty = email.trim().toLowerCase() !== user.email.toLowerCase() && email.includes('@');
  const dirty = nameDirty || emailDirty;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      if (nameDirty) {
        const result = await updateName(name.trim());
        if (result.error) { setError(result.error); return; }
      }
      if (emailDirty) {
        const result = await updateEmail(email.trim().toLowerCase());
        if (result.error) { setError(result.error); return; }
      }
      setSuccess('Profile updated');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void handleSave(e)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="display-name">Your name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setSuccess(null); }}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSuccess(null); }}
              maxLength={120}
              required
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive mt-2">{error}</p>
        )}
        {success && (
          <p role="status" className="text-sm text-green-600 dark:text-green-400 mt-2">{success} ✓</p>
        )}

        {dirty && (
          <div className="mt-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </form>

      <Separator />

      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="text-sm font-medium">Role</p>
          <Badge variant="secondary" className="mt-1 capitalize">
            {formatRole(user.role)}
          </Badge>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Salon ID</p>
          <code className="text-xs text-muted-foreground break-all">{user.salonId}</code>
        </div>
      </div>
    </div>
  );
}
