'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { DashboardToast } from '@/components/dashboard-toast';
import { SaveFormFooter } from '@/components/save-feedback';
import { SAVE_MESSAGES } from '@/lib/save-messages';
import { useSaveFeedback } from '@/lib/use-save-feedback';
import { cn } from '@/lib/utils';
import { BOT_FAQS_LABEL } from '@/lib/dashboard-nav';
import { CollapsibleSection } from '@/components/collapsible-section';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { FAQ_TEMPLATES, FAQ_CATEGORIES, FAQ_BUSINESS_TYPES } from './faq-templates';
import { countUsedFaqTemplates, filterAvailableFaqTemplates } from '@/lib/faq-template-utils';
import { FAQCard, faqCardClassName, type FaqCardData } from '@/components/FAQCard';

type FaqStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  status: FaqStatus;
  approvedAt: string | null;
  approvedBy: string | null;
}

interface FaqForm {
  question: string;
  answer: string;
}

interface Props {
  token: string;
}

const emptyForm: FaqForm = { question: '', answer: '' };
const WHATSAPP_ANSWER_LIMIT = 3900;

function truncate(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function StatCard({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <Card className={cn(highlight && 'ring-1 ring-green-600/20', warn && 'ring-1 ring-yellow-600/20')}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'text-2xl font-bold mt-1',
            highlight && 'text-green-700 dark:text-green-400',
            warn && 'text-yellow-700 dark:text-yellow-400',
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
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

function SortableFaqCard({
  faq,
  index,
  askCount,
  isMostAsked,
  isNeverTriggered,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  busyId,
  reorderEnabled,
}: {
  faq: Faq;
  index: number;
  askCount: number;
  isMostAsked: boolean;
  isNeverTriggered: boolean;
  onEdit: (faq: Faq) => void;
  onDelete: (faq: Faq) => void;
  onApprove: (faq: Faq) => void;
  onReject: (faq: Faq) => void;
  busyId: string | null;
  reorderEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: faq.id,
    disabled: !reorderEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const busy = busyId === faq.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onEdit(faq)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(faq);
        }
      }}
      className={cn(
        faqCardClassName(faq.status, isDragging),
        'cursor-pointer',
      )}
    >
      <div className="p-4 flex gap-3">
        {reorderEnabled ? (
          <button
            type="button"
            className="mt-1 shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-5" />
          </button>
        ) : (
          <span className="mt-1 w-5 shrink-0" aria-hidden />
        )}

        <div className="flex-1 min-w-0 space-y-2">
          <FAQCard
            faq={faq as FaqCardData}
            index={index}
            askCount={askCount}
            isMostAsked={isMostAsked}
            isNeverTriggered={isNeverTriggered}
            busy={busy}
            onEdit={() => onEdit(faq)}
            onDelete={() => onDelete(faq)}
            onApprove={() => onApprove(faq)}
            onReject={() => onReject(faq)}
          />
        </div>
      </div>
    </div>
  );
}

export function FaqsClient({ token }: Props) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { success: saveSuccess, error: saveError, clear: clearSaveFeedback, reportSuccess, reportError } = useSaveFeedback(3000);
  const [templateStep, setTemplateStep] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('All');
  const [templateBizType, setTemplateBizType] = useState<string>('');

  type SmartResult = { id: string; question: string; decision: 'approve' | 'needs_edit'; reason: string };
  const [smartResults, setSmartResults] = useState<SmartResult[] | null>(null);
  const [smartScanning, setSmartScanning] = useState(false);
  const [smartApplying, setSmartApplying] = useState(false);
  const [faqStats, setFaqStats] = useState<Record<string, { askCount: number }>>({});

  const reorderEnabled = statusFilter === 'all' && !search.trim();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadFaqs = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await apiFetch<{ faqs: Faq[] }>('/faqs', {}, token);
        const sorted = [...(data.faqs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        setFaqs(sorted);
      } catch (e) {
        showToast(e instanceof ApiError ? e.message : 'Failed to load FAQs', 'error');
        setFaqs([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, showToast],
  );

  const loadFaqStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ stats: Record<string, { askCount: number }> }>(
        '/faqs/stats',
        {},
        token,
      );
      setFaqStats(data.stats ?? {});
    } catch {
      setFaqStats({});
    }
  }, [token]);

  useEffect(() => {
    void loadFaqs();
    void loadFaqStats();
  }, [loadFaqs, loadFaqStats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((f) => {
      if (statusFilter === 'approved' && f.status !== 'APPROVED') return false;
      if (statusFilter === 'pending' && f.status !== 'PENDING') return false;
      if (statusFilter === 'rejected' && f.status !== 'REJECTED') return false;
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q)
      );
    });
  }, [faqs, search, statusFilter]);

  const stats = useMemo(() => {
    const approved = faqs.filter((f) => f.status === 'APPROVED').length;
    const pending = faqs.filter((f) => f.status === 'PENDING').length;
    const rejected = faqs.filter((f) => f.status === 'REJECTED').length;
    return { total: faqs.length, approved, pending, rejected };
  }, [faqs]);

  const topAskedIds = useMemo(() => {
    const ranked = faqs
      .filter((f) => f.status === 'APPROVED')
      .map((f) => ({ id: f.id, askCount: faqStats[f.id]?.askCount ?? 0 }))
      .filter((r) => r.askCount > 0)
      .sort((a, b) => b.askCount - a.askCount)
      .slice(0, 3);
    return new Set(ranked.map((r) => r.id));
  }, [faqs, faqStats]);

  const existingFaqQuestions = useMemo(() => faqs.map((f) => f.question), [faqs]);

  const unusedFaqTemplates = useMemo(
    () => filterAvailableFaqTemplates(FAQ_TEMPLATES, existingFaqQuestions),
    [existingFaqQuestions],
  );

  const usedFaqTemplateCount = useMemo(
    () => countUsedFaqTemplates(FAQ_TEMPLATES, existingFaqQuestions),
    [existingFaqQuestions],
  );

  const faqIds = useMemo(() => filtered.map((f) => f.id), [filtered]);
  const answerLen = form.answer.length;
  const answerOverLimit = answerLen > WHATSAPP_ANSWER_LIMIT;

  function openCreate() {
    clearSaveFeedback();
    setEditingId(null);
    setForm(emptyForm);
    setTemplateStep(true);
    setTemplateSearch('');
    setTemplateCategory('All');
    setTemplateBizType('');
    setSheetOpen(true);
  }

  function openEdit(faq: Faq) {
    clearSaveFeedback();
    setEditingId(faq.id);
    setForm({ question: faq.question, answer: faq.answer });
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
    setTemplateCategory('All');
    setTemplateBizType('');
  }

  function applyTemplate(question: string, answer: string) {
    setForm({ question, answer });
    setTemplateStep(false);
  }

  async function handleSave(e: React.FormEvent) {
    const andClose = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('name') === 'addAndClose';
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      reportError('Question and answer are required');
      return;
    }
    if (answerOverLimit) {
      reportError(`Answer must be under ${WHATSAPP_ANSWER_LIMIT} characters for WhatsApp`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
      };

      if (editingId) {
        await apiFetch(`/faqs/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }, token);
        showToast(SAVE_MESSAGES.changesSaved, 'success');
        reportSuccess(SAVE_MESSAGES.changesSaved);
        closeSheet();
      } else {
        await apiFetch('/faqs', {
          method: 'POST',
          body: JSON.stringify({ ...payload, sortOrder: faqs.length }),
        }, token);
        showToast('FAQ added', 'success');
        reportSuccess('FAQ added');
        if (andClose) {
          closeSheet();
        } else {
          setForm(emptyForm);
          setTemplateStep(false);
        }
      }

      await loadFaqs(true);
      await loadFaqStats();
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleSmartScan() {
    setSmartScanning(true);
    try {
      const data = await apiFetch<{ results: SmartResult[]; message?: string; summary?: { total: number; approve: number; needsEdit: number } }>(
        '/faqs/smart-approve',
        { method: 'POST' },
        token,
      );
      if (!data.results?.length) {
        showToast(data.message ?? 'No pending FAQs to review', 'success');
        return;
      }
      setSmartResults(data.results);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Scan failed', 'error');
    } finally {
      setSmartScanning(false);
    }
  }

  async function handleSmartApply() {
    setSmartApplying(true);
    try {
      const data = await apiFetch<{ summary: { approve: number } }>(
        '/faqs/smart-approve?apply=1',
        { method: 'POST' },
        token,
      );
      showToast(`${data.summary.approve} FAQ${data.summary.approve !== 1 ? 's' : ''} approved`, 'success');
      setSmartResults(null);
      await loadFaqs(true);
      await loadFaqStats();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Apply failed', 'error');
    } finally {
      setSmartApplying(false);
    }
  }

  async function updateStatus(faq: Faq, status: FaqStatus) {
    setBusyId(faq.id);
    setFaqs((prev) => prev.map((f) => (f.id === faq.id ? { ...f, status } : f)));
    try {
      await apiFetch(`/faqs/${faq.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token);
      showToast(
        status === 'APPROVED'
          ? 'FAQ approved — bot can now use it'
          : status === 'REJECTED'
            ? 'FAQ rejected and removed from bot search'
            : 'FAQ marked pending',
        'success',
      );
      await loadFaqs(true);
      await loadFaqStats();
    } catch (e) {
      setFaqs((prev) => prev.map((f) => (f.id === faq.id ? faq : f)));
      showToast(e instanceof ApiError ? e.message : 'Status update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/faqs/${deleteTarget.id}`, { method: 'DELETE' }, token);
      showToast('FAQ deleted', 'success');
      setDeleteTarget(null);
      await loadFaqs(true);
      await loadFaqStats();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !reorderEnabled) return;

    const oldIndex = faqs.findIndex((f) => f.id === active.id);
    const newIndex = faqs.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(faqs, oldIndex, newIndex).map((f, i) => ({
      ...f,
      sortOrder: i,
    }));
    const previous = faqs;
    setFaqs(reordered);
    setReordering(true);

    const changed = reordered.filter((f) => {
      const orig = previous.find((p) => p.id === f.id);
      return orig && orig.sortOrder !== f.sortOrder;
    });

    try {
      await Promise.all(
        changed.map((f) =>
          apiFetch(`/faqs/${f.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ sortOrder: f.sortOrder }),
          }, token),
        ),
      );
      showToast('Display order saved', 'success');
    } catch (e) {
      setFaqs(previous);
      showToast(e instanceof ApiError ? e.message : 'Reorder failed', 'error');
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="dashboard-page-flow space-y-6">
      <DashboardPageHeader
        title={BOT_FAQS_LABEL}
        variant="violet"
        subtitle="Manage answers your WhatsApp bot shares. Only approved FAQs appear in the menu and semantic search."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => loadFaqs(true)} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            {stats.pending > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSmartScan()}
                disabled={smartScanning}
                className="border-yellow-600/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
              >
                {smartScanning ? '✨ Scanning…' : `✨ Smart approve (${stats.pending} pending)`}
              </Button>
            )}
            <Button onClick={openCreate}>Add FAQ</Button>
          </>
        }
      />

      <CollapsibleSection id="faqs-stats" title="Overview" defaultOpen>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total FAQs" value={stats.total} />
        <StatCard label="Approved (live)" value={stats.approved} highlight />
        <StatCard label="Pending review" value={stats.pending} warn={stats.pending > 0} />
        <StatCard label="Rejected" value={stats.rejected} />
      </div>
      </CollapsibleSection>

      {stats.pending > 3 && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-yellow-900 dark:text-yellow-100">
            Your bot is answering {stats.approved}/{stats.total} questions. Approve the rest to reduce
            missed conversations and support tickets.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-yellow-600/40 shrink-0"
            onClick={() => setStatusFilter('pending')}
          >
            Review all pending
          </Button>
        </div>
      )}

      <CollapsibleSection
        id="faqs-library"
        title="FAQ library"
        count={filtered.length}
        subtitle={
          reordering
            ? 'Saving order…'
            : reorderEnabled
              ? 'Drag cards to set the order customers see on WhatsApp.'
              : 'Clear search and show all FAQs to reorder.'
        }
        defaultOpen
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={statusFilter === f ? 'default' : 'outline'}
                onClick={() => setStatusFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Search questions or answers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {loading && (
            <p className="text-center text-muted-foreground py-10 text-sm">Loading FAQs…</p>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== 'all'
                  ? 'No FAQs match your filters.'
                  : 'No FAQs yet.'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button size="sm" className="mt-3" onClick={openCreate}>
                  Add your first FAQ
                </Button>
              )}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
              <SortableContext items={faqIds} strategy={verticalListSortingStrategy}>
                <div className={cn('space-y-3', reordering && 'pointer-events-none opacity-60')}>
                  {filtered.map((faq, index) => (
                    <SortableFaqCard
                      key={faq.id}
                      faq={faq}
                      index={index}
                      askCount={faqStats[faq.id]?.askCount ?? 0}
                      isMostAsked={topAskedIds.has(faq.id)}
                      isNeverTriggered={faq.status === 'APPROVED' && (faqStats[faq.id]?.askCount ?? 0) === 0}
                      busyId={busyId}
                      reorderEnabled={reorderEnabled}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                      onApprove={(f) => void updateStatus(f, 'APPROVED')}
                      onReject={(f) => void updateStatus(f, 'REJECTED')}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </CollapsibleSection>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {templateStep ? (
            <>
              <SheetHeader>
                <SheetTitle>Choose a template</SheetTitle>
                <SheetDescription>
                  Pick a template to pre-fill your question and answer, then edit it to match your business.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 border-dashed"
                  onClick={() => setTemplateStep(false)}
                >
                  <span className="text-lg">✏️</span>
                  Write your own from scratch
                </Button>

                <Input
                  placeholder="Search templates…"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  autoFocus
                />

                {/* Business type filter */}
                <div className="dashboard-h-scroll gap-1.5 pb-1 snap-x snap-mandatory">
                  {templateBizType ? (
                    // Drilled in — show only the active pill + a clear button
                    <>
                      <button
                        type="button"
                        onClick={() => { setTemplateBizType(''); setTemplateCategory('All'); }}
                        className="shrink-0 snap-start min-h-[2.25rem] inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap touch-manipulation"
                      >
                        ← All businesses
                      </button>
                      <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary whitespace-nowrap">
                        {templateBizType}
                      </span>
                    </>
                  ) : (
                    // Show all business type pills
                    FAQ_BUSINESS_TYPES.map((biz) => (
                      <button
                        key={biz}
                        type="button"
                        onClick={() => setTemplateBizType(biz)}
                        className="shrink-0 snap-start min-h-[2.25rem] inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap touch-manipulation"
                      >
                        {biz}
                      </button>
                    ))
                  )}
                </div>

                {/* Category filter — only visible when a business type is selected */}
                {templateBizType && (
                <div className="flex flex-wrap gap-1.5">
                  {FAQ_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTemplateCategory(cat)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        templateCategory === cat
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                )}

                {(() => {
                  const q = templateSearch.trim().toLowerCase();
                  const visibleTemplates = unusedFaqTemplates.filter((t) => {
                    const matchesBiz = !templateBizType || t.businessTypes.includes('All') || t.businessTypes.includes(templateBizType);
                    const matchesCat = templateCategory === 'All' || t.category === templateCategory;
                    const matchesSearch = !q || t.question.toLowerCase().includes(q) || t.answer.toLowerCase().includes(q);
                    return matchesBiz && matchesCat && matchesSearch;
                  });
                  return (
                    <div className="dashboard-scroll-panel space-y-1.5 pr-1">
                      {visibleTemplates.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          {unusedFaqTemplates.length === 0
                            ? 'You’ve added all suggested templates — use “Write your own from scratch” for anything else.'
                            : 'No templates match your search.'}
                        </p>
                      )}
                      {visibleTemplates.length > 0 && (
                        <p className="text-xs text-muted-foreground pb-0.5">
                          {visibleTemplates.length} template{visibleTemplates.length !== 1 ? 's' : ''}
                          {usedFaqTemplateCount > 0 && (
                            <span> · {usedFaqTemplateCount} already in your library</span>
                          )}
                        </p>
                      )}
                      {visibleTemplates.map((t) => (
                        <button
                          key={t.question}
                          type="button"
                          onClick={() => applyTemplate(t.question, t.answer)}
                          className="w-full text-left rounded-lg border bg-card px-3 py-2.5 hover:bg-accent hover:border-primary/40 transition-colors group"
                        >
                          <p className="text-sm font-medium leading-snug group-hover:text-accent-foreground">{t.question}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {t.answer.replace(/\n/g, ' ').slice(0, 120)}{t.answer.length > 120 ? '…' : ''}
                          </p>
                          <span className="inline-block mt-1 text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground/70">{t.category}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{editingId ? 'Edit FAQ' : 'Add FAQ'}</SheetTitle>
                <SheetDescription>
                  {editingId
                    ? 'Update the question or answer below.'
                    : 'New FAQs start as pending. Approve them when ready for the WhatsApp bot.'}
                </SheetDescription>
              </SheetHeader>
              <form noValidate onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4 px-4 pb-4">
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => setTemplateStep(true)}
                    className="text-xs text-primary hover:underline text-left"
                  >
                    ← Back to templates
                  </button>
                )}
                <div className="space-y-2">
                  <Label htmlFor="faq-question">Question</Label>
                  <Input
                    id="faq-question"
                    value={form.question}
                    onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                    placeholder="e.g. What are your opening hours?"
                    required
                    autoFocus={!templateStep}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="faq-answer">Answer</Label>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        answerOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {answerLen.toLocaleString()} / {WHATSAPP_ANSWER_LIMIT.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    id="faq-answer"
                    value={form.answer}
                    onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                    placeholder="Write a clear, concise answer customers will see on WhatsApp."
                    required
                    rows={8}
                    className={cn(
                      'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none',
                      'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                      'md:text-sm dark:bg-input/30 resize-y min-h-[120px]',
                      answerOverLimit && 'border-destructive focus-visible:ring-destructive/30',
                    )}
                  />
                  {answerOverLimit && (
                    <p className="text-xs text-destructive">
                      WhatsApp truncates long messages — keep answers under {WHATSAPP_ANSWER_LIMIT.toLocaleString()} characters.
                    </p>
                  )}
                  {form.answer.includes('[') && form.answer.includes(']') && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Replace the <strong>[bracketed]</strong> placeholders with your actual details before saving.
                    </p>
                  )}
                </div>
                <SheetFooter className="px-0 flex-col items-stretch gap-2">
                  <SaveFormFooter success={saveSuccess} error={saveError} loading={saving}>
                  <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={closeSheet}>
                    {editingId ? 'Cancel' : 'Done'}
                  </Button>
                  {!editingId && (
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={saving || answerOverLimit}
                      name="addAndClose"
                      value="1"
                    >
                      {saving ? 'Saving…' : 'Add & close'}
                    </Button>
                  )}
                  <Button type="submit" disabled={saving || answerOverLimit}>
                    {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add FAQ →'}
                  </Button>
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
          onKeyDown={(e) => e.key === 'Escape' && !deleting && setDeleteTarget(null)}
          role="presentation"
        >
          <Card
            className="w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-faq-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 space-y-4">
              <h2 id="delete-faq-title" className="font-semibold">Delete FAQ?</h2>
              <p className="text-sm text-muted-foreground">
                &ldquo;{truncate(deleteTarget.question, 80)}&rdquo; will be removed permanently and dropped from bot search.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Smart approve results modal */}
      {smartResults && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !smartApplying && setSmartResults(null)}
          onKeyDown={(e) => e.key === 'Escape' && !smartApplying && setSmartResults(null)}
          role="presentation"
        >
          <Card
            className="w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base">✨ Smart approve results</CardTitle>
              <p className="text-sm text-muted-foreground">
                {smartResults.filter((r) => r.decision === 'approve').length} ready to approve
                {' · '}
                {smartResults.filter((r) => r.decision === 'needs_edit').length} need editing
              </p>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 space-y-2 pb-2">
              {smartResults.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 flex items-start gap-2.5',
                    r.decision === 'approve'
                      ? 'border-green-600/25 bg-green-600/5'
                      : 'border-yellow-600/25 bg-yellow-500/5',
                  )}
                >
                  <span className="text-base mt-0.5 shrink-0">
                    {r.decision === 'approve' ? '✅' : '✏️'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug truncate">{r.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>
                  </div>
                </div>
              ))}
            </CardContent>
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setSmartResults(null)} disabled={smartApplying}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSmartApply()}
                disabled={smartApplying || smartResults.filter((r) => r.decision === 'approve').length === 0}
              >
                {smartApplying
                  ? 'Approving…'
                  : `Approve ${smartResults.filter((r) => r.decision === 'approve').length} FAQ${smartResults.filter((r) => r.decision === 'approve').length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
