'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Film,
  ImageIcon,
  Loader2,
  Megaphone,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { CampaignMediaUpload, type CampaignMediaType } from './campaign-media-upload';
import { EmojiBar } from './emoji-bar';

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELLED';
type StatusFilter = 'all' | 'draft' | 'scheduled' | 'sent';
type AudienceType = 'all' | 'tags' | 'inactive';
type DeliveryMode = 'draft' | 'schedule' | 'now';
type PendingAction = { type: 'send' | 'cancel'; campaign: Campaign };

interface AudienceFilter {
  type: AudienceType;
  tags?: string[];
  inactiveDays?: number;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  mediaUrl: string | null;
  mediaType: CampaignMediaType | null;
  status: CampaignStatus;
  audienceFilter: AudienceFilter;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  delivered: number;
  failed: number;
  createdAt: string;
  updatedAt: string;
}

interface CampaignForm {
  name: string;
  message: string;
  mediaUrl: string | null;
  mediaType: CampaignMediaType | null;
  audienceType: AudienceType;
  tags: string[];
  inactiveDays: string;
  deliveryMode: DeliveryMode;
  scheduledAtLocal: string;
}

interface Props {
  token: string;
}

const emptyForm: CampaignForm = {
  name: '',
  message: '',
  mediaUrl: null,
  mediaType: null,
  audienceType: 'all',
  tags: [],
  inactiveDays: '90',
  deliveryMode: 'draft',
  scheduledAtLocal: '',
};

const MESSAGE_MAX = 1024;
const PREVIEW_NAME = 'Thandi';

const MESSAGE_STARTERS = [
  'Hi! ✨ Book this week and enjoy 15% off your next visit!',
  'We miss you 💚 Come back this month for a complimentary treatment add-on.',
  'Slow Tuesday? Walk-ins welcome — reply BOOK to reserve your spot 📅',
];

function defaultScheduleLocal(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function audienceFilterFromForm(form: CampaignForm): AudienceFilter {
  if (form.audienceType === 'tags') return { type: 'tags', tags: form.tags };
  if (form.audienceType === 'inactive') {
    const days = parseInt(form.inactiveDays, 10);
    return { type: 'inactive', inactiveDays: Number.isFinite(days) && days > 0 ? days : 90 };
  }
  return { type: 'all' };
}

function formFromCampaign(c: Campaign): CampaignForm {
  const af = c.audienceFilter ?? { type: 'all' as const };
  return {
    name: c.name,
    message: c.message,
    mediaUrl: c.mediaUrl,
    mediaType: c.mediaType,
    audienceType: af.type ?? 'all',
    tags: af.tags ?? [],
    inactiveDays: String(af.inactiveDays ?? 90),
    deliveryMode: c.status === 'SCHEDULED' ? 'schedule' : 'draft',
    scheduledAtLocal: c.scheduledAt
      ? toLocalDatetimeInput(new Date(c.scheduledAt))
      : defaultScheduleLocal(),
  };
}

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function audienceLabel(filter: AudienceFilter): string {
  if (filter.type === 'tags' && filter.tags?.length) {
    return filter.tags.length === 1 ? `Tag: ${filter.tags[0]}` : `${filter.tags.length} tags selected`;
  }
  if (filter.type === 'inactive') {
    return `Inactive ${filter.inactiveDays ?? 90}+ days`;
  }
  return 'All POPIA accepted';
}

function deliveryRate(c: Campaign): string | null {
  if (c.status !== 'COMPLETED' || c.totalRecipients === 0) return null;
  const pct = Math.round((c.delivered / c.totalRecipients) * 100);
  return `${pct}% delivered`;
}

function statusMeta(status: CampaignStatus) {
  switch (status) {
    case 'DRAFT':
      return {
        label: 'Draft',
        className: 'bg-muted text-muted-foreground border-border',
        accent: 'border-l-muted-foreground/40',
      };
    case 'SCHEDULED':
      return {
        label: 'Scheduled',
        className: 'bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-600/30',
        accent: 'border-l-blue-500',
      };
    case 'SENDING':
      return {
        label: 'Sending',
        className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-600/30',
        accent: 'border-l-amber-500',
      };
    case 'COMPLETED':
      return {
        label: 'Sent',
        className: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30',
        accent: 'border-l-green-500',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-destructive/10 text-destructive border-destructive/30',
        accent: 'border-l-destructive/50',
      };
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  accent?: 'green' | 'blue' | 'neutral';
}) {
  return (
    <Card
      className={cn(
        'overflow-hidden',
        accent === 'green' && 'ring-1 ring-green-600/15',
        accent === 'blue' && 'ring-1 ring-blue-600/15',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs font-medium">{label}</CardDescription>
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              accent === 'green' && 'bg-[#25d366]/15 text-[#128c7e]',
              accent === 'blue' && 'bg-blue-600/10 text-blue-600 dark:text-blue-400',
              !accent && 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold tabular-nums tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground leading-relaxed pb-4">{hint}</CardContent>
    </Card>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#128c7e]/10 text-xs font-bold text-[#128c7e]">
          {step}
        </span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="pl-10 space-y-3">{children}</div>
    </section>
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
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl animate-in slide-in-from-bottom-4 max-w-md backdrop-blur-sm',
        type === 'success' ? 'bg-card/95 border-green-600/30' : 'bg-destructive/10 border-destructive/40 text-destructive',
      )}
    >
      {type === 'success' ? (
        <CheckCircle2 className="size-4 text-green-600 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="size-4 shrink-0 mt-0.5" />
      )}
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground text-xs shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <strong key={i}>{part.slice(1, -1)}</strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

function WhatsAppPreview({
  message,
  mediaUrl,
  mediaType,
}: {
  message: string;
  mediaUrl: string | null;
  mediaType: CampaignMediaType | null;
}) {
  const caption = message.trim() || (mediaUrl ? '' : 'Your newsletter preview will appear here…');
  const greeting = `Hi ${PREVIEW_NAME}!`;
  const fullText = caption.startsWith('Hi ') ? caption : caption ? `${greeting} ${caption}` : greeting;

  return (
    <div className="rounded-xl border bg-gradient-to-b from-[#e5ddd5] to-[#d9d0c7] dark:from-[#0b141a] dark:to-[#111b21] p-4 shadow-inner">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="size-3.5 text-[#128c7e]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          WhatsApp newsletter preview
        </p>
      </div>
      <div className="mx-auto max-w-[260px] rounded-[1.25rem] border-[6px] border-[#1f2c34] dark:border-[#2a3942] bg-[#0b141a] p-2 shadow-lg space-y-1">
        {mediaUrl && (
          <div className="rounded-lg overflow-hidden bg-black/40">
            {mediaType === 'video' ? (
              <video src={mediaUrl} className="w-full max-h-36 object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="" className="w-full max-h-36 object-cover" />
            )}
          </div>
        )}
        {(fullText || !mediaUrl) && (
          <div className="rounded-lg rounded-tl-sm bg-[#dcf8c6] dark:bg-[#005c4b] px-3 py-2.5 text-[13px] leading-relaxed text-[#111] dark:text-[#e9edef] whitespace-pre-wrap break-words">
            <WhatsAppText text={fullText} />
          </div>
        )}
        <p className="text-[9px] text-right text-[#8696a0] pr-0.5">12:30 ✓✓</p>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">
        Emojis, photos &amp; videos · POPIA opt-in required
      </p>
    </div>
  );
}

function ConfirmPanel({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading,
  variant = 'default',
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: 'default' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        variant === 'danger'
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-amber-500/40 bg-amber-500/10',
      )}
    >
      <div className="flex gap-2">
        <AlertTriangle
          className={cn('size-4 shrink-0 mt-0.5', variant === 'danger' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300')}
        />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className={cn(
            variant === 'danger' ? 'bg-destructive hover:bg-destructive/90' : 'bg-[#128c7e] hover:bg-[#0d6b5f]',
            'text-white',
          )}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel ?? 'Go back'}
        </Button>
      </div>
    </div>
  );
}

export function CampaignsClient({ token }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [optedInCount, setOptedInCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmSendInSheet, setConfirmSendInSheet] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAll = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [listRes, metaRes] = await Promise.all([
        apiFetch<{ campaigns: Campaign[] }>('/campaigns', {}, token),
        apiFetch<{ tags: string[]; optedInCount: number }>('/campaigns/meta', {}, token),
      ]);
      setCampaigns(listRes.campaigns);
      setTags(metaRes.tags);
      setOptedInCount(metaRes.optedInCount);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not load campaigns', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const hasSending = useMemo(() => campaigns.some((c) => c.status === 'SENDING'), [campaigns]);

  useEffect(() => {
    if (!hasSending) return;
    const id = setInterval(() => void loadAll(true), 8000);
    return () => clearInterval(id);
  }, [hasSending, loadAll]);

  const previewAudience = useCallback(async () => {
    if (!token) return;
    setAudienceLoading(true);
    try {
      const res = await apiFetch<{ count: number }>(
        '/campaigns/audience-preview',
        {
          method: 'POST',
          body: JSON.stringify({ audienceFilter: audienceFilterFromForm(form) }),
        },
        token,
      );
      setAudienceCount(res.count);
    } catch {
      setAudienceCount(null);
    } finally {
      setAudienceLoading(false);
    }
  }, [token, form]);

  useEffect(() => {
    if (!sheetOpen) return;
    const timer = setTimeout(() => void previewAudience(), 280);
    return () => clearTimeout(timer);
  }, [sheetOpen, form.audienceType, form.tags, form.inactiveDays, previewAudience]);

  const filterCounts = useMemo(() => {
    return {
      all: campaigns.length,
      draft: campaigns.filter((c) => c.status === 'DRAFT').length,
      scheduled: campaigns.filter((c) => c.status === 'SCHEDULED' || c.status === 'SENDING').length,
      sent: campaigns.filter((c) => c.status === 'COMPLETED' || c.status === 'CANCELLED').length,
    };
  }, [campaigns]);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'draft') return c.status === 'DRAFT';
      if (statusFilter === 'scheduled') return c.status === 'SCHEDULED' || c.status === 'SENDING';
      return c.status === 'COMPLETED' || c.status === 'CANCELLED';
    });
  }, [campaigns, statusFilter]);

  const stats = useMemo(() => {
    const drafts = campaigns.filter((c) => c.status === 'DRAFT').length;
    const scheduled = campaigns.filter((c) => c.status === 'SCHEDULED').length;
    const sent = campaigns.filter((c) => c.status === 'COMPLETED').length;
    return { drafts, scheduled, sent };
  }, [campaigns]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, scheduledAtLocal: defaultScheduleLocal() });
    setAudienceCount(null);
    setConfirmSendInSheet(false);
    setSheetOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm(formFromCampaign(c));
    setAudienceCount(null);
    setConfirmSendInSheet(false);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingId(null);
    setConfirmSendInSheet(false);
  };

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const insertEmoji = (emoji: string) => {
    const el = messageRef.current;
    if (!el) {
      setForm((f) => ({ ...f, message: f.message + emoji }));
      return;
    }
    const start = el.selectionStart ?? form.message.length;
    const end = el.selectionEnd ?? start;
    const next = form.message.slice(0, start) + emoji + form.message.slice(end);
    setForm((f) => ({ ...f, message: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const insertBold = () => {
    const el = messageRef.current;
    if (!el) {
      setForm((f) => ({ ...f, message: f.message + '**' }));
      return;
    }
    const start = el.selectionStart ?? form.message.length;
    const end = el.selectionEnd ?? start;
    const selected = form.message.slice(start, end);
    const wrapped = selected ? `*${selected}*` : '**';
    const next = form.message.slice(0, start) + wrapped + form.message.slice(end);
    setForm((f) => ({ ...f, message: next }));
    requestAnimationFrame(() => {
      el.focus();
      if (selected) {
        el.setSelectionRange(start + wrapped.length, start + wrapped.length);
      } else {
        el.setSelectionRange(start + 1, start + 1);
      }
    });
  };

  const validateForm = (): boolean => {
    if (!form.name.trim()) {
      showToast('Add a newsletter name so you can find it later', 'error');
      return false;
    }
    if (!form.message.trim() && !form.mediaUrl) {
      showToast('Add a caption, photo, or video for your newsletter', 'error');
      return false;
    }
    if (form.audienceType === 'tags' && form.tags.length === 0) {
      showToast('Choose at least one customer tag', 'error');
      return false;
    }
    if (form.deliveryMode === 'schedule' && !form.scheduledAtLocal) {
      showToast('Choose when this campaign should send', 'error');
      return false;
    }
    if (audienceCount === 0 && (form.deliveryMode === 'now' || form.deliveryMode === 'schedule')) {
      showToast('No customers match this audience — adjust targeting first, or save as a draft', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!token || !validateForm()) return;
    if (form.deliveryMode === 'now' && !confirmSendInSheet) {
      setConfirmSendInSheet(true);
      return;
    }

    setSaving(true);
    try {
      const audienceFilter = audienceFilterFromForm(form);
      const scheduledAt =
        form.deliveryMode === 'schedule' ? new Date(form.scheduledAtLocal).toISOString() : null;
      const contentPayload = {
        name: form.name.trim(),
        message: form.message.trim(),
        mediaUrl: form.mediaUrl,
        mediaType: form.mediaType,
        audienceFilter,
      };

      if (editingId) {
        if (form.deliveryMode === 'now') {
          await apiFetch(
            `/campaigns/${editingId}`,
            {
              method: 'PATCH',
              body: JSON.stringify(contentPayload),
            },
            token,
          );
          await apiFetch(`/campaigns/${editingId}/send`, { method: 'POST' }, token);
          showToast('Newsletter queued — messages are on their way', 'success');
        } else {
          await apiFetch(
            `/campaigns/${editingId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                ...contentPayload,
                scheduledAt: form.deliveryMode === 'schedule' ? scheduledAt : null,
              }),
            },
            token,
          );
          showToast(
            form.deliveryMode === 'schedule' ? 'Schedule updated' : 'Draft saved',
            'success',
          );
        }
      } else {
        await apiFetch(
          '/campaigns',
          {
            method: 'POST',
            body: JSON.stringify({
              ...contentPayload,
              scheduledAt: form.deliveryMode === 'schedule' ? scheduledAt : null,
              sendNow: form.deliveryMode === 'now',
            }),
          },
          token,
        );
        showToast(
          form.deliveryMode === 'now'
            ? 'Newsletter queued — messages are on their way'
            : form.deliveryMode === 'schedule'
              ? `Scheduled for ${formatWhen(scheduledAt)}`
              : 'Draft saved — finish and send when ready',
          'success',
        );
      }
      closeSheet();
      await loadAll(true);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong — please try again', 'error');
    } finally {
      setSaving(false);
      setConfirmSendInSheet(false);
    }
  };

  const executePendingAction = async () => {
    if (!token || !pendingAction) return;
    setActionId(pendingAction.campaign.id);
    try {
      if (pendingAction.type === 'send') {
        await apiFetch(`/campaigns/${pendingAction.campaign.id}/send`, { method: 'POST' }, token);
        showToast('Campaign queued — messages are on their way', 'success');
      } else {
        await apiFetch(`/campaigns/${pendingAction.campaign.id}/cancel`, { method: 'POST' }, token);
        showToast('Campaign cancelled', 'success');
      }
      setPendingAction(null);
      await loadAll(true);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Action failed', 'error');
    } finally {
      setActionId(null);
    }
  };

  const isEditable = (c: Campaign) => c.status === 'DRAFT' || c.status === 'SCHEDULED';

  const filterLabels: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'sent', label: 'History' },
  ];

  const primaryCta =
    confirmSendInSheet && form.deliveryMode === 'now'
      ? 'Confirm & send now'
      : form.deliveryMode === 'now'
        ? 'Send now'
        : form.deliveryMode === 'schedule'
          ? editingId
            ? 'Update schedule'
            : 'Schedule campaign'
          : editingId
            ? 'Save changes'
            : 'Save draft';

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Hero */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#128c7e]">
            Customer retention
          </p>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#25d366]/20 to-[#128c7e]/10 ring-1 ring-[#25d366]/20">
              <Megaphone className="size-5 text-[#128c7e]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">WhatsApp Newsletter</h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-xl leading-relaxed">
                Rich marketing to opted-in customers — text, emojis, photos, and videos to fill
                chairs and bring clients back.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 sm:pt-8">
          <Button variant="outline" size="sm" onClick={() => void loadAll(true)} disabled={refreshing}>
            <RefreshCw className={cn('size-4 mr-1.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-[#128c7e] hover:bg-[#0d6b5f] text-white shadow-sm"
          >
            <Plus className="size-4 mr-1.5" />
            New newsletter
          </Button>
        </div>
      </div>

      {/* Zero audience banner */}
      {!loading && optedInCount === 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
            <div className="flex gap-3 flex-1">
              <Users className="size-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">No marketing audience yet</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Customers must reply *ACCEPT* on WhatsApp before newsletters can reach them.
                  Pending customers are prompted automatically on their next message.
                </p>
              </div>
            </div>
            <Link
              href="/customers"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              View customers
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          label="Reachable audience"
          value={loading ? '—' : optedInCount}
          hint="Customers who replied ACCEPT to POPIA marketing consent"
          accent="green"
        />
        <StatCard
          icon={CalendarClock}
          label="Queued to send"
          value={loading ? '—' : stats.scheduled}
          hint="Scheduled campaigns waiting for their send time"
          accent={stats.scheduled > 0 ? 'blue' : 'neutral'}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed sends"
          value={loading ? '—' : stats.sent}
          hint={
            stats.drafts > 0
              ? `${stats.drafts} draft${stats.drafts === 1 ? '' : 's'} ready to finish`
              : 'Track delivery in history below'
          }
          accent="neutral"
        />
      </div>

      {/* List section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            title="Your newsletters"
            description="Drafts, scheduled sends, and delivery history"
          />
          {hasSending && (
            <Badge variant="outline" className="w-fit border-amber-500/40 text-amber-800 dark:text-amber-300 gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              Sending in progress — auto-refreshing
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {filterLabels.map(({ key, label }) => (
            <Button
              key={key}
              variant={statusFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(key)}
              className={cn(
                'gap-1.5',
                statusFilter === key && 'bg-[#128c7e] hover:bg-[#0d6b5f] shadow-sm',
              )}
            >
              {label}
              {!loading && (
                <span
                  className={cn(
                    'tabular-nums text-[10px] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center',
                    statusFilter === key ? 'bg-white/20' : 'bg-muted',
                  )}
                >
                  {filterCounts[key]}
                </span>
              )}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[120px] rounded-xl bg-muted animate-pulse ring-1 ring-border/50" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#25d366]/10 mb-5">
                <Sparkles className="size-7 text-[#128c7e]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Your first campaign starts here</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">
                Fill quiet days, bring back lapsed clients, or announce a seasonal offer — all
                directly on WhatsApp.
              </p>
              <Button
                onClick={openCreate}
                className="bg-[#128c7e] hover:bg-[#0d6b5f] text-white"
              >
                <Plus className="size-4 mr-1.5" />
                Create campaign
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No campaigns in this view. Try another filter or{' '}
                <button type="button" className="text-[#128c7e] font-medium hover:underline" onClick={openCreate}>
                  create a new one
                </button>
                .
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const meta = statusMeta(c.status);
              const busy = actionId === c.id;
              const rate = deliveryRate(c);
              const isPendingThis = pendingAction?.campaign.id === c.id;

              return (
                <Card
                  key={c.id}
                  className={cn(
                    'overflow-hidden border-l-4 transition-shadow hover:shadow-md',
                    meta.accent,
                    c.status === 'SENDING' && 'ring-1 ring-amber-500/20',
                  )}
                >
                  <CardContent className="p-0">
                    {isPendingThis && pendingAction && (
                      <div className="px-5 pt-5">
                        <ConfirmPanel
                          title={pendingAction.type === 'send' ? 'Send this campaign now?' : 'Cancel this campaign?'}
                          body={
                            pendingAction.type === 'send'
                              ? `"${c.name}" will message ${audienceLabel(c.audienceFilter)} immediately. This cannot be undone.`
                              : `"${c.name}" will be removed from the queue and won't send.`
                          }
                          confirmLabel={pendingAction.type === 'send' ? 'Yes, send now' : 'Yes, cancel'}
                          onConfirm={() => void executePendingAction()}
                          onCancel={() => setPendingAction(null)}
                          loading={busy}
                          variant={pendingAction.type === 'cancel' ? 'danger' : 'default'}
                        />
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold truncate">{c.name}</h3>
                          <Badge variant="outline" className={cn('shrink-0', meta.className)}>
                            {meta.label}
                          </Badge>
                          {c.mediaUrl && (
                            <Badge variant="outline" className="text-xs gap-1 font-normal">
                              {c.mediaType === 'video' ? (
                                <Film className="size-3" />
                              ) : (
                                <ImageIcon className="size-3" />
                              )}
                              {c.mediaType === 'video' ? 'Video' : 'Photo'}
                            </Badge>
                          )}
                          {rate && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {rate}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{c.message}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Target className="size-3" />
                            {audienceLabel(c.audienceFilter)}
                          </span>
                          {c.status === 'SCHEDULED' && c.scheduledAt && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="size-3" />
                              Sends {formatWhen(c.scheduledAt)}
                            </span>
                          )}
                          {c.status === 'COMPLETED' && c.sentAt && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3" />
                              Sent {formatWhen(c.sentAt)}
                            </span>
                          )}
                          {c.status === 'COMPLETED' && (
                            <span>
                              {c.delivered} delivered · {c.failed} failed · {c.totalRecipients} total
                            </span>
                          )}
                          {c.status === 'SENDING' && (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <Loader2 className="size-3 animate-spin" />
                              Delivering messages…
                            </span>
                          )}
                        </div>
                      </div>
                      {isEditable(c) && !isPendingThis && (
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => openEdit(c)} disabled={busy}>
                            <Pencil className="size-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingAction({ type: 'send', campaign: c })}
                            disabled={busy}
                            className="border-[#25d366]/40 text-[#128c7e] hover:bg-[#25d366]/10"
                          >
                            <Play className="size-3.5 mr-1" />
                            Send now
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingAction({ type: 'cancel', campaign: c })}
                            disabled={busy}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto px-6">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="text-xl">
              {editingId ? 'Edit newsletter' : 'Create newsletter'}
            </SheetTitle>
            <SheetDescription className="leading-relaxed">
              Build a rich WhatsApp message with caption, emojis, and optional photo or video.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-8 py-4">
            <FormSection step={1} title="Newsletter content" description="Caption, media, and emojis your customers receive">
              <div className="space-y-2">
                <Label htmlFor="camp-name">Internal name</Label>
                <Input
                  id="camp-name"
                  placeholder="March mid-week promo"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">Only visible to you — not sent to customers.</p>
              </div>

              <div className="space-y-2">
                <Label>Photo or video</Label>
                <CampaignMediaUpload
                  token={token}
                  mediaUrl={form.mediaUrl}
                  mediaType={form.mediaType}
                  onChange={({ mediaUrl, mediaType }) =>
                    setForm((f) => ({ ...f, mediaUrl, mediaType }))
                  }
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="camp-msg">Caption &amp; message</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Bold (*text*)"
                      onClick={insertBold}
                      className="flex h-6 w-6 items-center justify-center rounded border border-input bg-background text-xs font-bold hover:bg-muted transition-colors"
                    >
                      B
                    </button>
                    <span
                      className={cn(
                        'text-[11px] tabular-nums',
                        form.message.length > MESSAGE_MAX * 0.9 && 'text-amber-600',
                        form.message.length > MESSAGE_MAX && 'text-destructive',
                      )}
                    >
                      {form.message.length}/{MESSAGE_MAX}
                    </span>
                  </div>
                </div>
                <textarea
                  ref={messageRef}
                  id="camp-msg"
                  rows={4}
                  maxLength={MESSAGE_MAX}
                  placeholder="Hi! ✨ Book this week and get 15% off — reply BOOK to reserve."
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128c7e]/30 resize-y min-h-[108px] leading-relaxed"
                />
                <EmojiBar onInsert={insertEmoji} />
                {!form.message.trim() && (
                  <div className="flex flex-wrap gap-1.5">
                    {MESSAGE_STARTERS.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, message: starter }))}
                        className="text-left text-[11px] rounded-full border px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {starter.slice(0, 52)}…
                      </button>
                    ))}
                  </div>
                )}
                <WhatsAppPreview
                  message={form.message}
                  mediaUrl={form.mediaUrl}
                  mediaType={form.mediaType}
                />
              </div>
            </FormSection>

            <Separator />

            <FormSection step={2} title="Audience" description="Only opted-in customers can be messaged (POPIA)">
              {(
                [
                  ['all', 'Everyone who accepted', 'POPIA opt-in — replied ACCEPT on WhatsApp'],
                  ['tags', 'By tag', 'VIP, colour clients, members — tags from customer profiles'],
                  ['inactive', 'Win-back', 'Re-engage customers who haven\'t visited recently'],
                ] as const
              ).map(([type, title, desc]) => (
                <label
                  key={type}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-all',
                    form.audienceType === type
                      ? 'border-[#128c7e] bg-[#25d366]/5 shadow-sm ring-1 ring-[#128c7e]/10'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name="audience"
                    className="mt-1 accent-[#128c7e]"
                    checked={form.audienceType === type}
                    onChange={() => setForm((f) => ({ ...f, audienceType: type }))}
                  />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </label>
              ))}

              {form.audienceType === 'tags' && (
                <div className="space-y-2">
                  {tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
                      No tags yet.{' '}
                      <Link href="/customers" className="text-[#128c7e] font-medium hover:underline">
                        Add tags on customer profiles
                      </Link>{' '}
                      to target specific groups.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                            form.tags.includes(tag)
                              ? 'bg-[#128c7e] text-white border-[#128c7e] shadow-sm'
                              : 'hover:bg-muted',
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {form.audienceType === 'inactive' && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="inactive-days" className="shrink-0 text-sm text-muted-foreground">
                    Last visit over
                  </Label>
                  <Input
                    id="inactive-days"
                    type="number"
                    min={7}
                    max={365}
                    className="w-20"
                    value={form.inactiveDays}
                    onChange={(e) => setForm((f) => ({ ...f, inactiveDays: e.target.value }))}
                  />
                  <span className="text-sm text-muted-foreground">days ago</span>
                </div>
              )}

              <div
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm ring-1',
                  audienceCount === 0 && audienceCount !== null
                    ? 'bg-destructive/5 ring-destructive/20 text-destructive'
                    : 'bg-muted/50 ring-border/60',
                )}
              >
                <Users className="size-4 shrink-0 opacity-70" />
                {audienceLoading ? (
                  <span className="text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Calculating reach…
                  </span>
                ) : audienceCount === 0 ? (
                  <span>No customers match — widen your audience or check consent</span>
                ) : audienceCount !== null ? (
                  <span>
                    <strong className="tabular-nums font-semibold">{audienceCount}</strong>{' '}
                    customer{audienceCount === 1 ? '' : 's'} will receive this
                  </span>
                ) : (
                  <span className="text-muted-foreground">Reach estimate appears as you configure audience</span>
                )}
              </div>
            </FormSection>

            <Separator />

            <FormSection step={3} title="Delivery" description="Save for later, schedule, or send immediately">
              {(
                [
                  ['draft', 'Save as draft', 'Come back and send when ready'],
                  ['schedule', 'Schedule send', 'Pick a future date and time'],
                  ['now', 'Send immediately', 'Queue messages right away'],
                ] as const
              ).map(([mode, title, desc]) => (
                <label
                  key={mode}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-all',
                    form.deliveryMode === mode
                      ? 'border-[#128c7e] bg-[#25d366]/5 shadow-sm ring-1 ring-[#128c7e]/10'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name="delivery"
                    className="mt-1 accent-[#128c7e]"
                    checked={form.deliveryMode === mode}
                    onChange={() => {
                      setForm((f) => ({
                        ...f,
                        deliveryMode: mode,
                        scheduledAtLocal: f.scheduledAtLocal || defaultScheduleLocal(),
                      }));
                      setConfirmSendInSheet(false);
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}

              {form.deliveryMode === 'schedule' && (
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-at">Send at</Label>
                  <Input
                    id="schedule-at"
                    type="datetime-local"
                    value={form.scheduledAtLocal}
                    min={toLocalDatetimeInput(new Date(Date.now() + 5 * 60_000))}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledAtLocal: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    We check every 5 minutes — delivery may begin up to 5 minutes after your chosen
                    time.
                  </p>
                </div>
              )}

              {confirmSendInSheet && form.deliveryMode === 'now' && (
                <ConfirmPanel
                  title="Ready to send?"
                  body={`This will queue WhatsApp messages to ${audienceCount ?? 'your selected'} customers. You won't be able to recall them once sent.`}
                  confirmLabel="Confirm & send"
                  cancelLabel="Review again"
                  onConfirm={() => void handleSave()}
                  onCancel={() => setConfirmSendInSheet(false)}
                  loading={saving}
                />
              )}
            </FormSection>
          </div>

          {!confirmSendInSheet && (
            <SheetFooter className="flex-col sm:flex-col gap-2 border-t pt-5 mt-2">
              <Button
                className="w-full h-11 bg-[#128c7e] hover:bg-[#0d6b5f] text-white font-medium shadow-sm"
                onClick={() => void handleSave()}
                disabled={saving || (audienceCount === 0 && form.deliveryMode !== 'draft') || (!form.message.trim() && !form.mediaUrl)}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : form.deliveryMode === 'now' ? (
                  <Send className="size-4 mr-2" />
                ) : form.deliveryMode === 'schedule' ? (
                  <CalendarClock className="size-4 mr-2" />
                ) : null}
                {primaryCta}
              </Button>
              <Button variant="ghost" className="w-full" onClick={closeSheet} disabled={saving}>
                Discard
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
