'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SaveFormFooter } from '@/components/save-feedback';
import { SAVE_MESSAGES } from '@/lib/save-messages';
import { useSaveFeedback } from '@/lib/use-save-feedback';
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
  const { success, error, clear, reportSuccess, reportError } = useSaveFeedback();
  const nameDirty = name.trim() !== user.name && name.trim().length >= 2;
  const emailDirty = email.trim().toLowerCase() !== user.email.toLowerCase() && email.includes('@');
  const dirty = nameDirty || emailDirty;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    clear();
    setSaving(true);

    try {
      if (nameDirty) {
        const result = await updateName(name.trim());
        if (result.error) {
          reportError(result.error);
          return;
        }
      }
      if (emailDirty) {
        const result = await updateEmail(email.trim().toLowerCase());
        if (result.error) {
          reportError(result.error);
          return;
        }
      }
      reportSuccess(SAVE_MESSAGES.profileUpdated);
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
              onChange={(e) => { setName(e.target.value); clear(); }}
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
              onChange={(e) => { setEmail(e.target.value); clear(); }}
              maxLength={120}
              required
            />
          </div>
        </div>

        <SaveFormFooter success={success} error={error}>
          {dirty && (
            <div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}
        </SaveFormFooter>      </form>

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
