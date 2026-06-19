'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Star,
  Tag,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiFetch, ApiError } from '@/lib/api';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { CustomerJourneyTimeline } from '@/components/CustomerJourneyTimeline';
import { cn } from '@/lib/utils';

interface AppointmentSummary {
  id: string;
  start: string;
  status: string;
  serviceName: string;
  staffName: string;
}

interface MessageSummary {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
}

interface CustomerDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  waId: string | null;
  marketingConsentStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  marketingConsentAt: string | null;
  noShowCount: number;
  bookingCount: number;
  noShowRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  loyaltyStamps: number;
  lifetimeValueCents: number;
  tags: string[];
  dateOfBirth: string | null;
  appointments: AppointmentSummary[];
  messages: MessageSummary[];
}

type Tab = 'overview' | 'journey' | 'appointments' | 'messages';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
];

function avatarGradient(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

function getDisplayName(c: CustomerDetail): string {
  if (c.displayName) return c.displayName;
  const first = c.firstName?.trim();
  const last = c.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  if (c.waId) return formatPhone(c.waId);
  return 'Unknown customer';
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || '?';
  return trimmed.slice(0, 2).toUpperCase();
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/^\+/, '');
  if (digits.startsWith('27') && digits.length === 11) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw.startsWith('+') ? raw : `+${raw}`;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  NO_SHOW: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
};

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border bg-card px-5 py-4 text-center min-w-[90px]">
      <Icon className="size-4 text-muted-foreground" />
      <p className="text-2xl font-bold tabular-nums leading-none mt-1">{value}</p>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

function AppointmentRow({ a }: { a: AppointmentSummary }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0 hover:bg-muted/30 px-2 rounded-lg transition-colors">
      <div className="w-8 flex flex-col items-center shrink-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase">
          {new Date(a.start).toLocaleDateString('en-ZA', { month: 'short' })}
        </p>
        <p className="text-lg font-bold leading-none">{new Date(a.start).getDate()}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{a.serviceName}</p>
        <p className="text-xs text-muted-foreground">
          {a.staffName} ·{' '}
          {new Date(a.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <span
        className={cn(
          'px-2 py-0.5 rounded-md text-xs font-medium shrink-0',
          STATUS_STYLES[a.status] ?? 'bg-muted text-muted-foreground',
        )}
      >
        {a.status.replace(/_/g, ' ')}
      </span>
    </div>
  );
}

function MessageBubble({ m }: { m: MessageSummary }) {
  const isIn = m.direction === 'INBOUND';
  return (
    <div className={cn('flex', isIn ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isIn
            ? 'rounded-tl-sm bg-muted text-foreground'
            : 'rounded-tr-sm bg-[#dcf8c6] dark:bg-[#005c4b] text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className={cn('text-[10px] mt-1 text-muted-foreground', !isIn && 'text-right')}>
          {new Date(m.createdAt).toLocaleString('en-ZA', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

interface ServiceBrief { id: string; name: string; priceCents: number; durationMin: number }
interface StaffBrief { id: string; name: string; displayName: string | null }

export function CustomerDetailClient({ customer, token }: { customer: CustomerDetail; token: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [tags, setTags] = useState<string[]>(customer.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [dob, setDob] = useState(customer.dateOfBirth ?? '');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobSaved, setDobSaved] = useState(false);

  // Manual booking sheet
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bServices, setBServices] = useState<ServiceBrief[]>([]);
  const [bStaff, setBStaff] = useState<StaffBrief[]>([]);
  const [bServiceId, setBServiceId] = useState('');
  const [bStaffId, setBStaffId] = useState('');
  const [bDate, setBDate] = useState('');
  const [bSlots, setBSlots] = useState<{ start: string; end: string }[]>([]);
  const [bSlotIso, setBSlotIso] = useState('');
  const [bNotes, setBNotes] = useState('');
  const [bSlotsLoading, setBSlotsLoading] = useState(false);
  const [bSaving, setBSaving] = useState(false);
  const [bError, setBError] = useState<string | null>(null);
  const [bSuccess, setBSuccess] = useState(false);

  const loadBookingData = useCallback(async () => {
    try {
      const [svcData, staffData] = await Promise.all([
        apiFetch<{ services: ServiceBrief[] }>('/services', {}, token),
        apiFetch<{ staff: StaffBrief[] }>('/staff', {}, token),
      ]);
      setBServices((svcData.services ?? []).filter((s: ServiceBrief & { active?: boolean }) => s.active !== false));
      setBStaff((staffData.staff ?? []).filter((s: StaffBrief & { active?: boolean; isBookable?: boolean }) => s.active !== false && s.isBookable !== false));
    } catch { /* non-critical */ }
  }, [token]);

  useEffect(() => {
    if (bookingOpen && bServices.length === 0) void loadBookingData();
  }, [bookingOpen, bServices.length, loadBookingData]);

  useEffect(() => {
    if (!bServiceId || !bStaffId || !bDate) { setBSlots([]); setBSlotIso(''); return; }
    setBSlotsLoading(true);
    setBSlots([]);
    setBSlotIso('');
    void apiFetch<{ slots: { start: string; end: string }[]; tooLong: boolean }>(
      `/appointments/slots?serviceId=${bServiceId}&staffId=${bStaffId}&date=${bDate}`, {}, token,
    ).then((d) => {
      setBSlots(d.slots ?? []);
    }).catch(() => {}).finally(() => setBSlotsLoading(false));
  }, [bServiceId, bStaffId, bDate, token]);

  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bServiceId || !bStaffId || !bSlotIso) return;
    setBSaving(true);
    setBError(null);
    try {
      await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({ customerId: customer.id, serviceId: bServiceId, staffId: bStaffId, startIso: bSlotIso, notes: bNotes }),
      }, token);
      setBSuccess(true);
      setTimeout(() => { setBookingOpen(false); setBSuccess(false); setBServiceId(''); setBStaffId(''); setBDate(''); setBSlots([]); setBSlotIso(''); setBNotes(''); }, 1500);
    } catch (err) {
      setBError(err instanceof ApiError ? err.message : 'Booking failed — please try again');
    } finally {
      setBSaving(false);
    }
  }

  async function saveTags(nextTags: string[]) {
    setTagSaving(true);
    setTagError(null);
    try {
      await apiFetch(`/customers/${customer.id}`, { method: 'PATCH', body: JSON.stringify({ tags: nextTags }) }, token);
      setTags(nextTags);
    } catch (e) {
      setTagError(e instanceof ApiError ? e.message : 'Failed to save tag');
    } finally {
      setTagSaving(false);
    }
  }

  function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || tags.includes(t) || tags.length >= 20) return;
    void saveTags([...tags, t]);
    setTagInput('');
  }

  function handleRemoveTag(tag: string) {
    void saveTags(tags.filter((t) => t !== tag));
  }

  async function handleSaveDob(e: React.FormEvent) {
    e.preventDefault();
    setDobSaving(true);
    try {
      await apiFetch(`/customers/${customer.id}`, { method: 'PATCH', body: JSON.stringify({ dateOfBirth: dob || null }) }, token);
      setDobSaved(true);
      setTimeout(() => setDobSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setDobSaving(false);
    }
  }

  // Compute visit streak (consecutive calendar weeks with at least one completed visit)
  const visitStreak = (() => {
    const completedDates = customer.appointments
      .filter((a) => a.status === 'COMPLETED')
      .map((a) => {
        const d = new Date(a.start);
        // ISO week number: DST-safe, uses year*100+week so no cross-year collisions
        const jan4 = new Date(d.getFullYear(), 0, 4);
        const startOfWeek1 = new Date(jan4.getTime() - ((jan4.getDay() || 7) - 1) * 86400000);
        const week = d.getFullYear() * 100 + Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 86400000)) + 1;
        return week;
      })
      .sort((a, b) => b - a);
    const unique = [...new Set(completedDates)];
    if (unique.length === 0) return 0;
    let streak = 1;
    for (let i = 0; i < unique.length - 1; i++) {
      if (unique[i]! - unique[i + 1]! === 1) streak++;
      else break;
    }
    return streak;
  })();

  const name = getDisplayName(customer);
  const gradient = avatarGradient(customer.waId ?? customer.id);
  const completedVisits = customer.appointments.filter((a) => a.status === 'COMPLETED').length;
  const lastCompleted = customer.appointments.find((a) => a.status === 'COMPLETED');

  const consentBadge =
    customer.marketingConsentStatus === 'ACCEPTED'
      ? { text: 'Marketing accepted', className: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30' }
      : customer.marketingConsentStatus === 'DECLINED'
        ? { text: 'Marketing declined', className: 'bg-muted text-muted-foreground border-border' }
        : { text: 'Awaiting POPIA choice', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-600/30' };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'journey', label: 'Journey' },
    { key: 'appointments', label: APPOINTMENTS_LABEL, count: customer.appointments.length },
    { key: 'messages', label: 'Messages', count: customer.messages.length },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All customers
      </Link>

      {/* Hero card */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className={cn('h-20 bg-gradient-to-r opacity-50', gradient)} />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex items-end gap-4 mb-4">
            <div
              className={cn(
                'flex size-20 items-center justify-center rounded-2xl text-white text-2xl font-bold ring-4 ring-background bg-gradient-to-br shrink-0',
                gradient,
              )}
            >
              {getInitials(name)}
            </div>
            <div className="pb-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{name}</h1>
              <div className="flex flex-wrap gap-2 items-center mt-1.5">
                <Badge variant="outline" className={consentBadge.className}>
                  {consentBadge.text}
                </Badge>
                {customer.noShowRisk === 'HIGH' && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                    High no-show risk
                  </Badge>
                )}
                {customer.noShowRisk === 'MEDIUM' && (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300">
                    Confirm before visit
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Contact row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {customer.waId && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" />
                <span className="font-mono">{formatPhone(customer.waId)}</span>
              </span>
            )}
            {customer.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5 shrink-0" />
                {customer.email}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5 shrink-0" />
              Since{' '}
              {new Date(customer.createdAt).toLocaleDateString('en-ZA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            <Link
              href={`/appointments?customer=${customer.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium bg-card hover:bg-muted/60 transition-colors"
            >
              <Calendar className="size-3.5" />
              View appointments
            </Link>
            {customer.waId && (
              <Link
                href={`/conversations?waId=${customer.waId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium bg-card hover:bg-muted/60 transition-colors"
              >
                <MessageSquare className="size-3.5" />
                Open conversation
              </Link>
            )}
            {customer.waId && (
              <a
                href={`https://wa.me/${customer.waId.replace(/^\+/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#25d366]/40 px-3 py-1.5 text-xs font-medium text-[#128c7e] dark:text-[#25d366] bg-[#25d366]/5 hover:bg-[#25d366]/10 transition-colors"
              >
                <Phone className="size-3.5" />
                WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <Plus className="size-3.5" />
              Book appointment
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <StatPill icon={CheckCircle2} label="Visits" value={completedVisits} />
        <StatPill
          icon={Calendar}
          label={APPOINTMENTS_LABEL}
          value={customer.bookingCount}
          sub={customer.noShowCount > 0 ? `${customer.noShowCount} no-show` : undefined}
        />
        <StatPill icon={Star} label="Stamps" value={customer.loyaltyStamps} />
        <StatPill
          icon={TrendingUp}
          label="No-show %"
          value={
            customer.bookingCount > 0
              ? `${Math.round((customer.noShowCount / customer.bookingCount) * 100)}%`
              : '0%'
          }
        />
        <StatPill
          icon={Clock}
          label="Last visit"
          value={
            lastCompleted
              ? new Date(lastCompleted.start).toLocaleDateString('en-ZA', {
                  day: 'numeric',
                  month: 'short',
                })
              : '—'
          }
        />
        {customer.lifetimeValueCents > 0 && (
          <StatPill
            icon={DollarSign}
            label="Lifetime value"
            value={`R${Math.round(customer.lifetimeValueCents / 100).toLocaleString('en-ZA')}`}
          />
        )}
        {visitStreak >= 2 && (
          <StatPill
            icon={TrendingUp}
            label="Week streak"
            value={visitStreak}
            sub="consecutive weeks"
          />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
              tab === key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'text-[10px] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums',
                  tab === key ? 'bg-foreground/10' : 'bg-muted',
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Marketing consent
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2.5 rounded-full shrink-0',
                  customer.marketingConsentStatus === 'ACCEPTED'
                    ? 'bg-green-500'
                    : customer.marketingConsentStatus === 'DECLINED'
                      ? 'bg-slate-400'
                      : 'bg-amber-400',
                )}
              />
              <p className="text-sm font-medium">{consentBadge.text}</p>
            </div>
            {customer.marketingConsentAt && (
              <p className="text-xs text-muted-foreground">
                Updated {new Date(customer.marketingConsentAt).toLocaleDateString('en-ZA')}
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Most recent appointment
            </p>
            {customer.appointments.length > 0 ? (
              <>
                <p className="text-sm font-medium">{customer.appointments[0].serviceName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(customer.appointments[0].start).toLocaleDateString('en-ZA', {
                    day: 'numeric',
                    month: 'long',
                  })}{' '}
                  · {customer.appointments[0].staffName}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No appointments yet</p>
            )}
          </div>

          {/* Date of birth */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Birthday</p>
            <form onSubmit={(e) => void handleSaveDob(e)} className="flex items-center gap-2">
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={dobSaving}>
                {dobSaved ? 'Saved ✓' : dobSaving ? 'Saving…' : 'Save'}
              </Button>
            </form>
            {dob && (
              <p className="text-xs text-muted-foreground">
                {new Date(dob).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="rounded-xl border bg-card p-4 space-y-3 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Tag className="size-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted border px-2.5 py-0.5 text-xs font-medium">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={tagSaving}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && <p className="text-xs text-muted-foreground">No tags yet</p>}
            </div>
            <form onSubmit={handleAddTag} className="flex gap-2 max-w-xs">
              <Input
                placeholder="Add tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                maxLength={40}
                className="h-7 text-xs"
              />
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={tagSaving || !tagInput.trim()}>
                Add
              </Button>
            </form>
            {tagError && <p className="text-xs text-destructive">{tagError}</p>}
          </div>
        </div>
      )}

      {/* Tab: Appointments */}
      {tab === 'appointments' && (
        <div>
          {customer.appointments.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No appointments yet</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card px-4 py-2">
              {customer.appointments.map((a) => (
                <AppointmentRow key={a.id} a={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Journey */}
      {tab === 'journey' && (
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <p className="text-xs text-muted-foreground mb-4">
            Every WhatsApp touchpoint, booking, payment, and campaign — in one chronological thread.
          </p>
          <CustomerJourneyTimeline token={token} customerId={customer.id} />
        </div>
      )}

      {/* Tab: Messages */}
      {tab === 'messages' && (
        <div>
          {customer.messages.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {customer.messages.map((m) => (
                <MessageBubble key={m.id} m={m} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual booking sheet */}
      <Sheet open={bookingOpen} onOpenChange={setBookingOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Book appointment</SheetTitle>
            <SheetDescription>Schedule a new appointment for {name}</SheetDescription>
          </SheetHeader>

          {bSuccess ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CheckCircle2 className="size-12 text-green-500" />
              <p className="font-semibold text-lg">Booking confirmed!</p>
            </div>
          ) : (
            <form onSubmit={handleBookingSubmit} className="space-y-5">
              {/* Service */}
              <div className="space-y-1.5">
                <Label htmlFor="b-service">Service</Label>
                <select
                  id="b-service"
                  value={bServiceId}
                  onChange={(e) => { setBServiceId(e.target.value); setBSlots([]); setBSlotIso(''); }}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a service…</option>
                  {bServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.durationMin}min · R{Math.round(s.priceCents / 100)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Staff */}
              <div className="space-y-1.5">
                <Label htmlFor="b-staff">Staff member</Label>
                <select
                  id="b-staff"
                  value={bStaffId}
                  onChange={(e) => { setBStaffId(e.target.value); setBSlots([]); setBSlotIso(''); }}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select staff…</option>
                  {bStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.displayName ?? s.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="b-date">Date</Label>
                <Input
                  id="b-date"
                  type="date"
                  value={bDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => { setBDate(e.target.value); setBSlots([]); setBSlotIso(''); }}
                />
              </div>

              {/* Slots */}
              {(bServiceId && bStaffId && bDate) && (
                <div className="space-y-1.5">
                  <Label>Available times</Label>
                  {bSlotsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="size-4 animate-spin" /> Loading slots…
                    </div>
                  ) : bSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No availability on this date.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {bSlots.map((slot) => {
                        const label = new Date(slot.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={() => setBSlotIso(slot.start)}
                            className={cn(
                              'rounded-lg border py-2 text-sm font-medium transition-colors',
                              bSlotIso === slot.start
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card hover:bg-muted',
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="b-notes">Notes (optional)</Label>
                <textarea
                  id="b-notes"
                  value={bNotes}
                  onChange={(e) => setBNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. bring own shampoo, sensitive scalp…"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {bError && <p className="text-sm text-destructive">{bError}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={!bServiceId || !bStaffId || !bSlotIso || bSaving}
              >
                {bSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Confirm booking
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
