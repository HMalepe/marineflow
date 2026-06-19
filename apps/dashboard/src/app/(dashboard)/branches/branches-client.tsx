'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BranchCard, type BranchStats } from '@/components/BranchCard';
import { apiFetch, ApiError } from '@/lib/api';
import { BRANCHES_LABEL } from '@/lib/dashboard-nav';

export interface BranchRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  createdAt: string;
  _count?: { staff: number; appointments: number };
}

interface Props {
  token: string;
  initialBranches: BranchRow[];
  canAdd: boolean;
  canEdit: boolean;
}

export function BranchesClient({ token, initialBranches, canAdd, canEdit }: Props) {
  const [branches, setBranches] = useState(initialBranches);
  const [branchStats, setBranchStats] = useState<Record<string, BranchStats>>({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchRow | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await apiFetch<{ branches: BranchRow[] }>('/branches', {}, token);
    setBranches(data.branches);
  }, [token]);

  const loadStats = useCallback(async () => {
    if (!token || branches.length === 0) {
      setBranchStats({});
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    try {
      const results = await Promise.all(
        branches.map(async (branch) => {
          try {
            const res = await apiFetch<{ stats: BranchStats }>(
              `/branches/${branch.id}/stats`,
              {},
              token,
            );
            return [branch.id, res.stats] as const;
          } catch {
            return [branch.id, null] as const;
          }
        }),
      );
      const next: Record<string, BranchStats> = {};
      for (const [id, stats] of results) {
        if (stats) next[id] = stats;
      }
      setBranchStats(next);
    } finally {
      setStatsLoading(false);
    }
  }, [token, branches]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const totalBookingsThisMonth = useMemo(() => {
    return Object.values(branchStats).reduce((sum, s) => sum + s.bookingsThisMonth, 0);
  }, [branchStats]);

  const bookingShareByBranch = useMemo(() => {
    const map: Record<string, number> = {};
    for (const branch of branches) {
      const bookings = branchStats[branch.id]?.bookingsThisMonth ?? 0;
      map[branch.id] =
        totalBookingsThisMonth > 0 ? Math.round((bookings / totalBookingsThisMonth) * 100) : 0;
    }
    return map;
  }, [branches, branchStats, totalBookingsThisMonth]);

  function openEdit(branch: BranchRow) {
    setEditBranch(branch);
    setName(branch.name);
    setAddress(branch.address ?? '');
    setPhone(branch.phone ?? '');
    setError(null);
  }

  function resetForm() {
    setName('');
    setAddress('');
    setPhone('');
    setError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Branch name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      }, token);
      setAddOpen(false);
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add branch');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBranch) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Branch name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/branches/${editBranch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: trimmed,
          address: address.trim() || null,
          phone: phone.trim() || null,
        }),
      }, token);
      setEditBranch(null);
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update branch');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{BRANCHES_LABEL}</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Multi-location salons show a branch picker on WhatsApp when you have more than one.
            Click a branch to manage its roster and staff — services, prices, and the bot are shared.
            Your main salon address lives under{' '}
            <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
              Settings
            </Link>
            .
          </p>
        </div>
        {canAdd && (
          <Button size="sm" onClick={() => { setAddOpen(true); resetForm(); }}>
            <Plus className="size-4 mr-1.5" />
            Add branch
          </Button>
        )}
      </div>

      {branches.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              No extra branches yet — single-location salons don&apos;t need one.
            </p>
            <p className="text-xs text-muted-foreground">
              Add a second location when customers should choose where to book on WhatsApp.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            stats={branchStats[branch.id] ?? null}
            statsLoading={statsLoading}
            bookingSharePct={bookingShareByBranch[branch.id] ?? 0}
            canEdit={canEdit}
            onEdit={() => openEdit(branch)}
          />
        ))}
      </div>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add branch</SheetTitle>
            <SheetDescription>
              Customers with more than one branch see a location picker when booking on WhatsApp.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void handleAdd(e)} className="space-y-4 py-4">
            <BranchFormFields name={name} address={address} phone={phone} onNameChange={setName} onAddressChange={setAddress} onPhoneChange={setPhone} />
            {error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
            )}
            <SheetFooter className="px-0">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Add branch'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={!!editBranch} onOpenChange={(open) => { if (!open) { setEditBranch(null); resetForm(); } }}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit branch</SheetTitle>
            <SheetDescription>
              Update the name and contact details shown to customers on WhatsApp.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void handleEdit(e)} className="space-y-4 py-4">
            <BranchFormFields name={name} address={address} phone={phone} onNameChange={setName} onAddressChange={setAddress} onPhoneChange={setPhone} />
            {error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
            )}
            <SheetFooter className="px-0">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BranchFormFields({
  name,
  address,
  phone,
  onNameChange,
  onAddressChange,
  onPhoneChange,
}: {
  name: string;
  address: string;
  phone: string;
  onNameChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="branch-name">Branch name</Label>
        <Input
          id="branch-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Sandton"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="branch-address">Address (optional)</Label>
        <Input
          id="branch-address"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Street, suburb, city"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="branch-phone">Phone (optional)</Label>
        <Input
          id="branch-phone"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="+27 11 123 4567"
        />
      </div>
    </>
  );
}
