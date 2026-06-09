'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SERVICE_TEMPLATES, SERVICE_INDUSTRY_GROUPS, SERVICE_BUSINESS_TYPES_BY_GROUP, SERVICE_CATEGORIES_BY_TYPE } from './service-templates';
import type { ServiceTemplate } from './service-templates';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMin: number;
  bufferMin: number;
  active: boolean;
}

interface ServiceForm {
  name: string;
  description: string;
  priceRands: string;
  durationMin: string;
  bufferMin: string;
}

type StatusFilter = 'all' | 'active' | 'inactive';

interface Props {
  token: string;
}

const emptyForm: ServiceForm = {
  name: '',
  description: '',
  priceRands: '',
  durationMin: '60',
  bufferMin: '0',
};

function formatPrice(cents: number): string {
  return `R ${(cents / 100).toFixed(2)}`;
}

function formatDuration(service: Service): string {
  if (service.bufferMin > 0) {
    return `${service.durationMin} + ${service.bufferMin} min buffer`;
  }
  return `${service.durationMin} min`;
}

function serviceToForm(s: Service): ServiceForm {
  return {
    name: s.name,
    description: s.description ?? '',
    priceRands: (s.priceCents / 100).toFixed(2),
    durationMin: String(s.durationMin),
    bufferMin: String(s.bufferMin),
  };
}

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-4 max-w-sm',
        type === 'success'
          ? 'bg-card border-green-600/30 text-foreground'
          : 'bg-destructive/10 border-destructive/40 text-destructive',
      )}
    >
      {type === 'success' ? (
        <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-0 shrink-0">
          Saved
        </Badge>
      ) : (
        <Badge variant="destructive" className="shrink-0">
          Error
        </Badge>
      )}
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground text-xs ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function ServicesClient({ token }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [templateStep, setTemplateStep] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateGroup, setTemplateGroup] = useState('');
  const [templateBizType, setTemplateBizType] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadServices = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await apiFetch<{ services: Service[] }>('/services', {}, token);
      setServices(data.services ?? []);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Failed to load services', 'error');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [services, search, statusFilter]);

  const activeCount = services.filter((s) => s.active).length;
  const inactiveCount = services.length - activeCount;

  const slotPreviewMin =
    (parseInt(form.durationMin, 10) || 0) + (parseInt(form.bufferMin, 10) || 0);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setTemplateStep(true);
    setTemplateSearch('');
    setTemplateBizType('');
    setTemplateCategory('');
    setSheetOpen(true);
  }

  function openEdit(service: Service) {
    setEditingId(service.id);
    setForm(serviceToForm(service));
    setTemplateStep(false);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setTemplateStep(false);
    setTemplateSearch('');
    setTemplateBizType('');
    setTemplateCategory('');
  }

  function applyTemplate(t: ServiceTemplate) {
    setForm({
      name: t.name,
      description: t.description,
      priceRands: String(t.suggestedPriceRands),
      durationMin: String(t.suggestedDurationMin),
      bufferMin: '0',
    });
    setTemplateStep(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    const priceCents = Math.round((parseFloat(form.priceRands) + Number.EPSILON) * 100);
    const durationMin = parseInt(form.durationMin, 10);
    const bufferMin = parseInt(form.bufferMin, 10) || 0;

    if (!Number.isFinite(priceCents) || priceCents < 0) {
      showToast('Enter a valid price in Rands', 'error');
      return;
    }
    if (!Number.isFinite(durationMin) || durationMin < 1) {
      showToast('Duration must be at least 1 minute', 'error');
      return;
    }
    if (bufferMin < 0) {
      showToast('Buffer time cannot be negative', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceCents,
        durationMin,
        bufferMin,
      };

      if (editingId) {
        await apiFetch(`/services/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }, token);
        showToast(`${form.name.trim()} updated`, 'success');
      } else {
        await apiFetch('/services', {
          method: 'POST',
          body: JSON.stringify({ ...payload, active: true }),
        }, token);
        showToast(`${form.name.trim()} created`, 'success');
      }

      closeSheet();
      await loadServices(true);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: Service, e: React.MouseEvent) {
    e.stopPropagation();
    const nextActive = !service.active;
    setTogglingId(service.id);
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, active: nextActive } : s)),
    );
    try {
      await apiFetch(`/services/${service.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: nextActive }),
      }, token);
      showToast(
        nextActive ? `${service.name} is now bookable` : `${service.name} hidden from booking`,
        'success',
      );
    } catch (err) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: service.active } : s)),
      );
      showToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await apiFetch<{ ok: boolean; deactivated?: boolean }>(
        `/services/${deleteTarget.id}`,
        { method: 'DELETE' },
        token,
      );
      showToast(
        result.deactivated
          ? `${deleteTarget.name} has bookings — marked inactive instead`
          : `${deleteTarget.name} removed`,
        'success',
      );
      setDeleteTarget(null);
      await loadServices(true);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage what customers can book via WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadServices(true)} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button onClick={openCreate}>Add Service</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total services" value={services.length} />
        <StatCard label="Active (bookable)" value={activeCount} highlight />
        <StatCard label="Inactive" value={inactiveCount} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Service catalog</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}
                </Button>
              ))}
            </div>
          </div>
          <Input
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm mt-2"
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[90px]"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Loading services…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <p className="text-muted-foreground text-sm">
                      {search || statusFilter !== 'all'
                        ? 'No services match your filters.'
                        : 'No services yet.'}
                    </p>
                    {!search && statusFilter === 'all' && (
                      <Button size="sm" className="mt-3" onClick={openCreate}>
                        Add your first service
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((service) => (
                <TableRow
                  key={service.id}
                  className={cn(
                    'cursor-pointer group',
                    !service.active && 'opacity-60',
                  )}
                  onClick={() => openEdit(service)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(service);
                    }
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{service.name}</span>
                      {!service.active && (
                        <Badge variant="secondary" className="text-[10px]">
                          Hidden
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[240px] truncate text-muted-foreground">
                    {service.description || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatPrice(service.priceCents)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDuration(service)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={togglingId === service.id}
                      onClick={(e) => toggleActive(service, e)}
                      className={cn(
                        service.active
                          ? 'border-green-600/30 text-green-700 dark:text-green-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {togglingId === service.id
                        ? '…'
                        : service.active
                          ? 'Active'
                          : 'Inactive'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(service);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {templateStep ? (
            <>
              <SheetHeader>
                <SheetTitle>Choose a template</SheetTitle>
                <SheetDescription>
                  Pick a service to pre-fill the form, then customise it. Or start from scratch.
                </SheetDescription>
              </SheetHeader>
              <TemplatePicker
                search={templateSearch}
                onSearch={setTemplateSearch}
                group={templateGroup}
                onGroup={(v) => { setTemplateGroup(v); setTemplateBizType(''); setTemplateCategory(''); }}
                bizType={templateBizType}
                onBizType={(v) => { setTemplateBizType(v); setTemplateCategory(''); }}
                category={templateCategory}
                onCategory={setTemplateCategory}
                onSelect={applyTemplate}
                onSkip={() => setTemplateStep(false)}
              />
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{editingId ? 'Edit service' : 'New service'}</SheetTitle>
                <SheetDescription>
                  {editingId
                    ? 'Changes apply to new bookings. Existing appointments keep their original details.'
                    : 'Active services appear in the WhatsApp booking menu immediately.'}
                </SheetDescription>
              </SheetHeader>
              {!editingId && (
                <div className="px-4 pt-1 pb-0">
                  <button
                    type="button"
                    onClick={() => setTemplateStep(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    ← Back to templates
                  </button>
                </div>
              )}
              <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4 px-4 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Haircut & Style"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What the customer can expect"
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none md:text-sm dark:bg-input/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (R) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.priceRands}
                      onChange={(e) => setForm((f) => ({ ...f, priceRands: e.target.value }))}
                      placeholder="250.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (min) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      step="5"
                      value={form.durationMin}
                      onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buffer">Buffer after appointment (min)</Label>
                  <Input
                    id="buffer"
                    type="number"
                    min="0"
                    step="5"
                    value={form.bufferMin}
                    onChange={(e) => setForm((f) => ({ ...f, bufferMin: e.target.value }))}
                  />
                  {slotPreviewMin > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Slot blocked on calendar: <strong>{slotPreviewMin} min</strong> total
                    </p>
                  )}
                </div>
                <SheetFooter className="px-0 pt-2 flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeSheet} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create service'}
                  </Button>
                </SheetFooter>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <SheetContent side="right" className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Remove service?</SheetTitle>
            <SheetDescription>
              {deleteTarget && (
                <>
                  You&apos;re about to remove <strong>{deleteTarget.name}</strong>.
                  If it has existing bookings, we&apos;ll hide it from new bookings instead of deleting it.
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-6 flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Removing…' : 'Remove service'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

function TemplatePicker({
  search,
  onSearch,
  group,
  onGroup,
  bizType,
  onBizType,
  category,
  onCategory,
  onSelect,
  onSkip,
}: {
  search: string;
  onSearch: (v: string) => void;
  group: string;
  onGroup: (v: string) => void;
  bizType: string;
  onBizType: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  onSelect: (t: ServiceTemplate) => void;
  onSkip: () => void;
}) {
  const bizTypesInGroup = group ? (SERVICE_BUSINESS_TYPES_BY_GROUP[group] ?? []) : [];
  const categories = bizType ? (SERVICE_CATEGORIES_BY_TYPE[bizType] ?? []) : [];

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    return SERVICE_TEMPLATES.filter((t) => {
      if (group && t.industryGroup !== group) return false;
      if (bizType && t.businessType !== bizType) return false;
      if (category && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.businessType.toLowerCase().includes(q)
      );
    });
  })();

  const chipClass = (active: boolean) => cn(
    'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
    active
      ? 'bg-primary text-primary-foreground border-primary'
      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-center font-medium"
        onClick={onSkip}
      >
        ✏️ Write your own from scratch
      </Button>

      <Input
        placeholder="Search services… (fade, massage, pedicure…)"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        autoFocus
      />

      {/* Level 1 — Industry group */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Industry</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onGroup('')} className={chipClass(!group)}>All</button>
          {SERVICE_INDUSTRY_GROUPS.map((g) => (
            <button key={g} type="button" onClick={() => onGroup(g)} className={chipClass(group === g)}>{g}</button>
          ))}
        </div>
      </div>

      {/* Level 2 — Business type (only shown when a group is selected) */}
      {group && bizTypesInGroup.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Business type</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onBizType('')} className={chipClass(!bizType)}>All</button>
            {bizTypesInGroup.map((bt) => (
              <button key={bt} type="button" onClick={() => onBizType(bt)} className={chipClass(bizType === bt)}>{bt}</button>
            ))}
          </div>
        </div>
      )}

      {/* Level 3 — Category (only shown when a business type is selected) */}
      {bizType && categories.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Category</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onCategory('')} className={chipClass(!category)}>All</button>
            {categories.map((cat) => (
              <button key={cat} type="button" onClick={() => onCategory(cat)} className={chipClass(category === cat)}>{cat}</button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} template{filtered.length !== 1 ? 's' : ''} — click one to pre-fill the form
      </p>

      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No templates match. <button type="button" className="text-primary hover:underline" onClick={onSkip}>Start from scratch</button>.
          </p>
        ) : (
          filtered.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(t)}
              className="text-left rounded-lg border border-border hover:border-primary/50 hover:bg-muted/60 transition-colors p-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm leading-tight group-hover:text-primary">{t.name}</p>
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap shrink-0">
                  {t.suggestedDurationMin > 0 ? `R ${t.suggestedPriceRands} · ${t.suggestedDurationMin} min` : `R ${t.suggestedPriceRands}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">{t.category}</span>
                {!bizType && (
                  <span className="text-[10px] bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">{t.businessType}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && 'ring-1 ring-green-600/20')}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', highlight && 'text-green-700 dark:text-green-400')}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
