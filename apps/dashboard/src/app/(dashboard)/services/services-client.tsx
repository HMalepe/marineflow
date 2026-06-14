'use client';

import React, { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, FolderOpen, Folder, Pencil, Plus } from 'lucide-react';
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
import { DashboardToast } from '@/components/dashboard-toast';
import { SaveFormFooter } from '@/components/save-feedback';
import { SAVE_MESSAGES } from '@/lib/save-messages';
import { useSaveFeedback } from '@/lib/use-save-feedback';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMin: number;
  bufferMin: number;
  active: boolean;
  sortOrder: number;
  category?: { id: string; name: string } | null;
}

interface ServiceCategory {
  id: string;
  name: string;
}

interface ServiceForm {
  name: string;
  description: string;
  priceRands: string;
  durationMin: string;
  bufferMin: string;
  categoryId: string;
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
  categoryId: '',
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
    categoryId: s.category?.id ?? '',
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
  return <DashboardToast message={message} type={type} onDismiss={onDismiss} />;
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
  const { success: saveSuccess, error: saveError, clear: clearSaveFeedback, reportSuccess, reportError } = useSaveFeedback();

  // Service categories
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [catInput, setCatInput] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catDeletingId, setCatDeletingId] = useState<string | null>(null);
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [catEditName, setCatEditName] = useState('');
  const [showAddCatInput, setShowAddCatInput] = useState(false);

  // Track which accordion groups are open (default: all open)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

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

  const loadCategories = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ categories: ServiceCategory[] }>('/service-categories', {}, token);
      setCategories(data.categories ?? []);
    } catch {
      // non-critical
    }
  }, [token]);

  useEffect(() => {
    void loadServices();
    void loadCategories();
  }, [loadServices, loadCategories]);

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    const name = catInput.trim();
    if (!name) return;
    setCatSaving(true);
    try {
      await apiFetch('/service-categories', { method: 'POST', body: JSON.stringify({ name }) }, token);
      setCatInput('');
      setShowAddCatInput(false);
      void loadCategories();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to add category', 'error');
    } finally {
      setCatSaving(false);
    }
  }

  async function handleRenameCategory(id: string) {
    const name = catEditName.trim();
    if (!name) return;
    setCatSaving(true);
    try {
      await apiFetch(`/service-categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }, token);
      setCatEditId(null);
      void loadCategories();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to rename category', 'error');
    } finally {
      setCatSaving(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    setCatDeletingId(id);
    try {
      await apiFetch(`/service-categories/${id}`, { method: 'DELETE' }, token);
      void loadCategories();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to delete category', 'error');
    } finally {
      setCatDeletingId(null);
    }
  }

  async function handleReorder(serviceId: string, direction: 'up' | 'down') {
    // Assign sequential sort orders first to eliminate gaps/ties, then swap
    const sorted = [...services].sort((a: Service, b: Service) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const normalised = sorted.map((s, i) => ({ ...s, sortOrder: i * 10 }));
    const idx = normalised.findIndex((s) => s.id === serviceId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= normalised.length) return;
    const a = normalised[idx]!;
    const b = normalised[swapIdx]!;
    // Swap their sort orders
    const aOrder = b.sortOrder;
    const bOrder = a.sortOrder;
    try {
      await Promise.all([
        apiFetch(`/services/${a.id}/sort-order`, { method: 'PATCH', body: JSON.stringify({ sortOrder: aOrder }) }, token),
        apiFetch(`/services/${b.id}/sort-order`, { method: 'PATCH', body: JSON.stringify({ sortOrder: bOrder }) }, token),
      ]);
      setServices((prev: Service[]) =>
        prev.map((s: Service) => s.id === a.id ? { ...s, sortOrder: aOrder } : s.id === b.id ? { ...s, sortOrder: bOrder } : s),
      );
    } catch {
      void loadServices(true); // re-sync on failure
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s: Service) => {
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [services, search, statusFilter]);

  const activeCount = services.filter((s: Service) => s.active).length;
  const inactiveCount = services.length - activeCount;

  const slotPreviewMin =
    (parseInt(form.durationMin, 10) || 0) + (parseInt(form.bufferMin, 10) || 0);

  function openCreate(presetCategoryId = '') {
    clearSaveFeedback();
    setEditingId(null);
    setForm({ ...emptyForm, categoryId: presetCategoryId });
    setTemplateStep(true);
    setTemplateSearch('');
    setTemplateBizType('');
    setTemplateCategory('');
    setSheetOpen(true);
  }

  function openEdit(service: Service) {
    clearSaveFeedback();
    setEditingId(service.id);
    setForm(serviceToForm(service));
    setTemplateStep(false);
    setSheetOpen(true);
  }

  function closeSheet() {
    clearSaveFeedback();
    setSheetOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setTemplateStep(false);
    setTemplateSearch('');
    setTemplateBizType('');
    setTemplateCategory('');
  }

  function applyTemplate(t: ServiceTemplate) {
    const matchedCat = categories.find(
      (c: ServiceCategory) => c.name.toLowerCase() === t.category.toLowerCase(),
    );
    setForm((f: ServiceForm) => ({
      name: t.name,
      description: t.description,
      priceRands: String(t.suggestedPriceRands),
      durationMin: String(t.suggestedDurationMin),
      bufferMin: '0',
      categoryId: matchedCat ? matchedCat.id : f.categoryId,
    }));
    setTemplateStep(false);
  }

  async function handleSave(e: FormEvent, andClose = false) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('name');
    const shouldClose = andClose || submitter === 'addAndClose' || !!editingId;

    if (!form.name.trim()) {
      reportError('Name is required');
      return;
    }

    const priceCents = Math.round((parseFloat(form.priceRands) + Number.EPSILON) * 100);
    const durationMin = parseInt(form.durationMin, 10);
    const bufferMin = parseInt(form.bufferMin, 10) || 0;

    if (!Number.isFinite(priceCents) || priceCents < 0) {
      reportError('Enter a valid price in Rands');
      return;
    }
    if (!Number.isFinite(durationMin) || durationMin < 1) {
      reportError('Duration must be at least 1 minute');
      return;
    }
    if (bufferMin < 0) {
      reportError('Buffer time cannot be negative');
      return;
    }

    setSaving(true);
    try {
      const savedName = form.name.trim();
      const payload: Record<string, unknown> = {
        name: savedName,
        description: form.description.trim() || undefined,
        priceCents,
        durationMin,
        bufferMin,
        categoryId: form.categoryId || null,
      };

      if (editingId) {
        await apiFetch(`/services/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }, token);
      } else {
        await apiFetch('/services', {
          method: 'POST',
          body: JSON.stringify({ ...payload, active: true }),
        }, token);
      }

      await loadServices(true);

      const successMessage = editingId ? SAVE_MESSAGES.changesSaved : `${savedName} added`;

      if (shouldClose) {
        showToast(successMessage, 'success');
        closeSheet();
      } else {
        reportSuccess(successMessage);
        setForm({ ...emptyForm, categoryId: form.categoryId });
        setTemplateStep(false);
      }
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: Service, e: MouseEvent) {
    e.stopPropagation();
    const nextActive = !service.active;
    setTogglingId(service.id);
    setServices((prev: Service[]) =>
      prev.map((s: Service) => (s.id === service.id ? { ...s, active: nextActive } : s)),
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
      setServices((prev: Service[]) =>
        prev.map((s: Service) => (s.id === service.id ? { ...s, active: service.active } : s)),
      );
      showToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    setDeleteTarget(null); // close sheet immediately so user sees feedback
    try {
      const result = await apiFetch<{ ok: boolean; deactivated?: boolean }>(
        `/services/${target.id}`,
        { method: 'DELETE' },
        token,
      );
      showToast(
        result.deactivated
          ? `${target.name} has bookings — marked inactive instead`
          : `${target.name} removed`,
        'success',
      );
      await loadServices(true);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function toggleGroup(groupKey: string) {
    setOpenGroups((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function isGroupOpen(groupKey: string) {
    // Open by default (not in the "closed" set)
    return !openGroups.has(groupKey);
  }

  // Build grouped structure
  const groupedServices = useMemo(() => {
    const groups = new Map<string, { category: ServiceCategory | null; services: Service[] }>();

    // Add named category groups in order
    for (const cat of categories) {
      groups.set(cat.id, { category: cat, services: [] });
    }

    // Distribute filtered services
    for (const svc of filtered) {
      const catId = svc.category?.id;
      if (catId && groups.has(catId)) {
        groups.get(catId)!.services.push(svc);
      } else {
        if (!groups.has('__other__')) {
          groups.set('__other__', { category: null, services: [] });
        }
        groups.get('__other__')!.services.push(svc);
      }
    }

    // Return as array, "Other" always last
    const result: Array<{ key: string; category: ServiceCategory | null; services: Service[] }> = [];
    for (const [key, value] of groups) {
      if (key !== '__other__') {
        result.push({ key, ...value });
      }
    }
    const other = groups.get('__other__');
    if (other) {
      result.push({ key: '__other__', ...other });
    }
    return result;
  }, [filtered, categories]);

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
          <Button onClick={() => openCreate()}>Add Service</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total services" value={services.length} />
        <StatCard label="Active (bookable)" value={activeCount} highlight />
        <StatCard label="Inactive" value={inactiveCount} />
      </div>

      {/* Service catalog */}
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
            onChange={(e: { target: { value: string } }) => setSearch(e.target.value)}
            className="max-w-sm mt-2"
          />
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {loading && (
            <p className="text-center text-muted-foreground py-10 text-sm">Loading services…</p>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== 'all'
                  ? 'No services match your filters.'
                  : 'No services yet.'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button size="sm" className="mt-3" onClick={() => openCreate()}>
                  Add your first service
                </Button>
              )}
            </div>
          )}
          {!loading && groupedServices.map((group: { key: string; category: ServiceCategory | null; services: Service[] }) => {
            const groupKey = group.key;
            const isOther = groupKey === '__other__';
            const label = isOther ? 'Other' : (group.category?.name ?? 'Other');
            const activeInGroup = group.services.filter((s: Service) => s.active).length;
            const open = isGroupOpen(groupKey);

            return (
              <div key={groupKey} className="rounded-lg border border-border overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 group/header">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {open ? (
                      <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Folder className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{label}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {activeInGroup} active / {group.services.length} total
                    </span>
                    <ChevronRight
                      className={cn(
                        'size-3.5 text-muted-foreground transition-transform ml-auto shrink-0',
                        open && 'rotate-90',
                      )}
                    />
                  </button>

                  {/* Category actions (non-other groups) */}
                  {!isOther && group.category && (
                    <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0">
                      {catEditId === group.category.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={catEditName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatEditName(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter') void handleRenameCategory(group.category!.id);
                              if (e.key === 'Escape') setCatEditId(null);
                            }}
                            className="text-xs bg-background border border-input rounded px-1.5 py-0.5 outline-none w-28 focus:border-ring"
                            maxLength={80}
                          />
                          <button
                            type="button"
                            onClick={() => void handleRenameCategory(group.category!.id)}
                            disabled={catSaving}
                            className="text-xs text-primary hover:underline px-1"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setCatEditId(null)}
                            className="text-xs text-muted-foreground hover:underline px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setCatEditId(group.category!.id); setCatEditName(group.category!.name); }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                            title="Rename category"
                          >
                            <Pencil className="size-3" />
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCategory(group.category!.id)}
                            disabled={catDeletingId === group.category.id}
                            className="text-xs text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                            title="Delete category"
                          >
                            {catDeletingId === group.category.id ? '…' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Add service to this group */}
                  <button
                    type="button"
                    onClick={() => openCreate(isOther ? '' : (group.category?.id ?? ''))}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors shrink-0 opacity-0 group-hover/header:opacity-100"
                    title="Add service to this category"
                  >
                    <Plus className="size-3" />
                    Add
                  </button>
                </div>

                {/* Service rows */}
                {open && (
                  <div className="divide-y divide-border">
                    {group.services.length === 0 && (
                      <p className="text-xs text-muted-foreground px-4 py-3 italic">
                        No services in this category.
                      </p>
                    )}
                    {group.services
                      .slice()
                      .sort((a: Service, b: Service) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                      .map((service: Service) => (
                        <div
                          key={service.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 group/row hover:bg-muted/30 transition-colors',
                            !service.active && 'opacity-60',
                          )}
                        >
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              title="Move up"
                              onClick={() => void handleReorder(service.id, 'up')}
                              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              title="Move down"
                              onClick={() => void handleReorder(service.id, 'down')}
                              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                          </div>

                          {/* Name + badge */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{service.name}</span>
                              {!service.active && (
                                <Badge variant="secondary" className="text-[10px]">Hidden</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDuration(service)}
                            </p>
                          </div>

                          {/* Price */}
                          <span className="text-sm font-mono text-muted-foreground shrink-0 hidden sm:block">
                            {formatPrice(service.priceCents)}
                          </span>

                          {/* Active toggle */}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={togglingId === service.id}
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => toggleActive(service, e)}
                            className={cn(
                              'shrink-0 h-7 text-xs',
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

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => openEdit(service)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted transition-colors shrink-0 opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                            title="Edit service"
                          >
                            <Pencil className="size-3" />
                            Edit
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => { closeSheet(); setDeleteTarget(service); }}
                            className="text-xs text-muted-foreground hover:text-destructive px-1.5 py-1 rounded hover:bg-muted transition-colors shrink-0 opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                            title="Delete service"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add category button */}
          <div className="pt-1">
            {showAddCatInput ? (
              <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => void handleAddCategory(e)} className="flex gap-2 max-w-sm">
                <Input
                  autoFocus
                  placeholder="New category name…"
                  value={catInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatInput(e.target.value)}
                  maxLength={80}
                />
                <Button type="submit" size="sm" disabled={catSaving || !catInput.trim()}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddCatInput(false); setCatInput(''); }}>Cancel</Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddCatInput(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="size-3.5" />
                Add category
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={(open: boolean) => !open && closeSheet()}>
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
              <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => void handleSave(e)} className="flex flex-col gap-4 px-4 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f: ServiceForm) => ({ ...f, name: e.target.value }))}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f: ServiceForm) => ({ ...f, description: e.target.value }))}
                    placeholder="What the customer can expect"
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none md:text-sm dark:bg-input/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <select
                    id="categoryId"
                    value={form.categoryId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f: ServiceForm) => ({ ...f, categoryId: e.target.value }))}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="">— No category —</option>
                    {categories.map((c: ServiceCategory) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f: ServiceForm) => ({ ...f, priceRands: e.target.value }))}
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f: ServiceForm) => ({ ...f, durationMin: e.target.value }))}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f: ServiceForm) => ({ ...f, bufferMin: e.target.value }))}
                  />
                  {slotPreviewMin > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Slot blocked on calendar: <strong>{slotPreviewMin} min</strong> total
                    </p>
                  )}
                </div>
                <SheetFooter className="px-0 pt-2 flex-col items-stretch gap-2 sm:flex-col">
                  <SaveFormFooter success={saveSuccess} error={saveError}>
                  <div className="flex flex-row justify-end gap-2 flex-wrap">
                  {editingId ? (
                    <>
                      <Button type="button" variant="outline" onClick={closeSheet} disabled={saving}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="ghost" size="sm" onClick={closeSheet} disabled={saving}>
                        Done
                      </Button>
                      <Button type="submit" name="addAndClose" variant="outline" size="sm" disabled={saving}>
                        Add &amp; close
                      </Button>
                      <Button type="submit" name="addMore" size="sm" disabled={saving}>
                        {saving ? 'Saving…' : 'Add service →'}
                      </Button>
                    </>
                  )}
                  </div>
                  </SaveFormFooter>
                </SheetFooter>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && !deleting && setDeleteTarget(null)}
          role="presentation"
        >
          <Card
            className="w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-service-title"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
          >
            <CardContent className="p-6 space-y-4">
              <h2 id="delete-service-title" className="font-semibold">Remove service?</h2>
              <p className="text-sm text-muted-foreground">
                You&apos;re about to remove <strong>{deleteTarget.name}</strong>.
                If it has existing bookings, we&apos;ll hide it from new bookings instead of deleting it.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
                  {deleting ? 'Removing…' : 'Remove service'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
        autoFocus
      />

      {/* Level 1 — Industry group (drill-down: selecting one hides the rest) */}
      <div>
        {group ? (
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => { onGroup(''); }}
              className="text-xs text-primary hover:underline"
            >
              ← All industries
            </button>
            <span className="text-xs font-semibold">{group}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Industry</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {group ? (
            <button type="button" className={chipClass(true)}>{group}</button>
          ) : (
            SERVICE_INDUSTRY_GROUPS.map((g) => (
              <button key={g} type="button" onClick={() => onGroup(g)} className={chipClass(false)}>{g}</button>
            ))
          )}
        </div>
      </div>

      {/* Level 2 — Business type (drill-down: selecting one hides the rest) */}
      {group && bizTypesInGroup.length > 0 && (
        <div>
          {bizType ? (
            <div className="flex items-center gap-2 mb-1.5">
              <button
                type="button"
                onClick={() => onBizType('')}
                className="text-xs text-primary hover:underline"
              >
                ← All {group} types
              </button>
              <span className="text-xs font-semibold">{bizType}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Business type</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {bizType ? (
              <button type="button" className={chipClass(true)}>{bizType}</button>
            ) : (
              bizTypesInGroup.map((bt) => (
                <button key={bt} type="button" onClick={() => onBizType(bt)} className={chipClass(false)}>{bt}</button>
              ))
            )}
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
