'use client';

import { useState } from 'react';
import { CollapsibleCard } from '@/components/collapsible-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, ApiError } from '@/lib/api';
import type { BranchRow } from '@/app/(dashboard)/branches/branches-client';

interface Props {
  token: string;
  initialBranch: BranchRow;
  canEdit: boolean;
}

export function BranchSettingsClient({ token, initialBranch, canEdit }: Props) {
  const [branch, setBranch] = useState(initialBranch);
  const [name, setName] = useState(branch.name);
  const [address, setAddress] = useState(branch.address ?? '');
  const [phone, setPhone] = useState(branch.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Branch name is required');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await apiFetch<{ branch: BranchRow }>(
        `/branches/${branch.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: trimmed,
            address: address.trim() || null,
            phone: phone.trim() || null,
          }),
        },
        token,
      );
      setBranch(data.branch);
      setName(data.branch.name);
      setAddress(data.branch.address ?? '');
      setPhone(data.branch.phone ?? '');
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save branch');
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsibleCard
      id="branch-settings-form"
      title="Branch details"
      description="Location details for this branch. Service prices, FAQs, and the WhatsApp bot are configured once for the whole salon under main Settings."
      className="max-w-xl"
      defaultOpen
    >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branch-settings-name">Branch name</Label>
            <Input
              id="branch-settings-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              disabled={!canEdit}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch-settings-address">Address</Label>
            <Input
              id="branch-settings-address"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setSaved(false); }}
              disabled={!canEdit}
              placeholder="Street, suburb, city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch-settings-phone">Phone</Label>
            <Input
              id="branch-settings-phone"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
              disabled={!canEdit}
              placeholder="+27 11 123 4567"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
          )}
          {saved && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Branch saved.</p>
          )}

          {canEdit && (
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </form>
    </CollapsibleCard>
  );
}
