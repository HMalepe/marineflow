'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { updateName } from './actions';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== user.name && name.trim().length >= 2;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await updateName(name.trim());
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void handleSave(e)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="display-name">Name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email} readOnly className="bg-muted" />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive mt-2">{error}</p>
        )}
        {dirty && (
          <div className="mt-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save name'}
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
