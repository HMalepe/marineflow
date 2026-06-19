'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StaffAvatar } from '@/components/staff-avatar';
import { cn } from '@/lib/utils';

export interface StaffCardMember {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  serviceNames?: string[];
  linkedServiceIds?: string[];
}

interface ActiveService {
  id: string;
  name: string;
  active: boolean;
}

interface StaffCardProps {
  staff: StaffCardMember;
  token: string;
  onEdit?: () => void;
  onServicesLinked?: () => void;
}

export function StaffCard({ staff, token, onEdit, onServicesLinked }: StaffCardProps) {
  const hasServices = (staff.serviceNames?.length ?? 0) > 0;
  const [linkOpen, setLinkOpen] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [allServices, setAllServices] = useState<ActiveService[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingServices, setLoadingServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openLinkModal = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setLinkOpen(true);
      setShowCta(false);
    },
    [],
  );

  useEffect(() => {
    if (!linkOpen || !token) return;
    let cancelled = false;
    setLoadingServices(true);
    setError(null);

    void (async () => {
      try {
        const data = await apiFetch<{ services: ActiveService[] }>('/services', {}, token);
        const active = (data.services ?? []).filter((s) => s.active);
        if (!cancelled) {
          setAllServices(active);
          const linked = new Set(staff.linkedServiceIds ?? []);
          if (linked.size === 0 && staff.serviceNames?.length) {
            for (const svc of active) {
              if (staff.serviceNames.includes(svc.name)) linked.add(svc.id);
            }
          }
          setSelectedIds(linked);
        }
      } catch {
        if (!cancelled) setError('Could not load services');
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [linkOpen, token, staff.linkedServiceIds, staff.serviceNames]);

  async function handleSaveLinks() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/staff/${staff.id}/link-services`, {
        method: 'POST',
        body: JSON.stringify({ serviceIds: [...selectedIds] }),
      }, token);
      setLinkOpen(false);
      onServicesLinked?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to link services');
    } finally {
      setSaving(false);
    }
  }

  function toggleService(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div
        className="relative flex items-start gap-2 rounded-xl border bg-card px-3 py-2 min-w-0 text-left hover:border-primary/40 hover:bg-accent/5 transition-colors"
        onMouseEnter={() => !hasServices && setShowCta(true)}
        onMouseLeave={() => setShowCta(false)}
      >
        <button
          type="button"
          onClick={onEdit}
          className="flex items-start gap-2 flex-1 min-w-0 text-left shrink-0"
          title="Edit profile"
        >
          <StaffAvatar
            name={staff.name}
            displayName={staff.displayName}
            avatarUrl={staff.avatarUrl}
            size="sm"
            className="mt-0.5"
          />
          <p className="text-xs font-semibold leading-tight truncate pt-0.5">
            {staff.displayName ?? staff.name}
          </p>
        </button>

        <div className="min-w-0 flex-1 -ml-1">
          {hasServices ? (
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {staff.serviceNames!.join(' · ')}
            </p>
          ) : (
            <button type="button" onClick={openLinkModal} className="text-left">
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-auto leading-snug">
                ⚠ No services — bot can&apos;t assign bookings
              </Badge>
            </button>
          )}
        </div>

        {!hasServices && showCta && (
          <button
            type="button"
            onClick={openLinkModal}
            className="absolute inset-x-0 bottom-0 translate-y-full pt-1 z-10"
          >
            <span className="block text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-1 hover:bg-primary/15 transition-colors">
              Link services now →
            </span>
          </button>
        )}
      </div>

      {linkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !saving && setLinkOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && !saving && setLinkOpen(false)}
          role="presentation"
        >
          <Card
            className="w-full max-w-md max-h-[85vh] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-services-title"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 flex flex-col gap-4 min-h-0">
              <div>
                <h2 id="link-services-title" className="font-semibold">
                  Link services — {staff.displayName ?? staff.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select which services this staff member can perform. Without at least one, the WhatsApp bot cannot assign bookings to them.
                </p>
              </div>

              {loadingServices && (
                <p className="text-sm text-muted-foreground animate-pulse">Loading services…</p>
              )}

              {!loadingServices && allServices.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No active services yet. Add services first under Services.
                </p>
              )}

              {!loadingServices && allServices.length > 0 && (
                <div className="overflow-y-auto max-h-64 rounded-lg border divide-y">
                  {allServices.map((svc) => (
                    <label
                      key={svc.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary shrink-0"
                        checked={selectedIds.has(svc.id)}
                        onChange={() => toggleService(svc.id)}
                      />
                      <span className="text-sm">{svc.name}</span>
                    </label>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setLinkOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={saving || loadingServices || selectedIds.size === 0}
                  onClick={() => void handleSaveLinks()}
                >
                  {saving ? 'Saving…' : `Save (${selectedIds.size})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
