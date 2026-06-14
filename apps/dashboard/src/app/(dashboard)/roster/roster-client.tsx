'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Copy, Check, X, ClipboardPaste } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkingHour {
  id: string;
  weekday: number; // 0=Sun … 6=Sat
  startTime: string;
  endTime: string;
}

interface TimeOffBlock {
  id: string;
  start: string; // YYYY-MM-DD
  end: string;
  reason: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  active: boolean;
  isBookable: boolean;
  workingHours: WorkingHour[];
  timeOff: TimeOffBlock[];
}

interface Shift { startTime: string; endTime: string }
interface Props { token: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}

function addMonths(d: Date, n: number): Date {
  const c = new Date(d); c.setMonth(c.getMonth() + n); return c;
}

function getMonthStart(d: Date): Date {
  const c = new Date(d); c.setDate(1); c.setHours(0, 0, 0, 0); return c;
}

function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Mon-first weekday index (0=Mon … 6=Sun)
function mondayIndex(jsDay: number) { return jsDay === 0 ? 6 : jsDay - 1; }

function buildCalendarWeeks(monthStart: Date): (Date | null)[][] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstMondayOffset = mondayIndex(new Date(year, month, 1).getDay());
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(firstMondayOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function getDayInfo(s: StaffMember, date: Date): { shift: Shift | null; isTimeOff: boolean; timeOffId: string | null } {
  const dateStr = toIso(date);
  const wd = date.getDay();
  const timeOffEntry = s.timeOff.find((t) => inRange(dateStr, t.start, t.end)) ?? null;
  const isTimeOff = !!timeOffEntry;
  const wh = s.workingHours.find((w) => w.weekday === wd) ?? null;
  const shift = isTimeOff ? null : wh ? { startTime: wh.startTime, endTime: wh.endTime } : null;
  return { shift, isTimeOff, timeOffId: timeOffEntry?.id ?? null };
}

function avatarColor(name: string) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length]!;
}

function initials(s: StaffMember) {
  return (s.displayName ?? s.name)
    .split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RosterClient({ token }: Props) {
  const todayRef = useRef<Date>((() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  })());
  const today = todayRef.current;
  const currentMonth = useMemo(() => getMonthStart(today), [today]);

  const [month, setMonth]       = useState<Date>(currentMonth);
  const [staff, setStaff]       = useState<StaffMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [copiedShift, setCopiedShift]   = useState<Shift | null>(null);
  // toast
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monthEnd = useMemo(() => addDays(getMonthStart(addMonths(month, 1)), -1), [month]);
  const weeks    = useMemo(() => buildCalendarWeeks(month), [month]);

  const canGoPrev = month.getTime() > currentMonth.getTime();
  const canGoNext = addMonths(month, 1).getTime() <= addMonths(currentMonth, 12).getTime();

  function showToast(message: string, type: 'success' | 'error') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchRoster = useCallback(async (from: Date, to: Date) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch<{ staff: StaffMember[] }>(
        `/roster?from=${toIso(from)}&to=${toIso(to)}`, {}, token,
      );
      setStaff(data.staff ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRoster(month, monthEnd); }, [fetchRoster, month, monthEnd]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Roster</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Click any date to manage shifts and time off.
          </p>
        </div>

        {/* Copied shift chip */}
        {copiedShift && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
            <ClipboardPaste className="w-3.5 h-3.5" />
            {copiedShift.startTime}–{copiedShift.endTime} ready to paste
            <button onClick={() => setCopiedShift(null)} className="ml-1 opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => canGoPrev && setMonth((m) => addMonths(m, -1))} disabled={!canGoPrev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant={month.getTime() === currentMonth.getTime() ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMonth(currentMonth)}
        >
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={() => canGoNext && setMonth((m) => addMonths(m, 1))} disabled={!canGoNext}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="text-base font-semibold ml-1">
          {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </span>
        {loading && <span className="text-xs text-muted-foreground animate-pulse ml-auto">Loading…</span>}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => fetchRoster(month, monthEnd)}>Retry</Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && staff.length === 0 && !error && (
        <div className="rounded-xl border border-dashed px-8 py-16 text-center space-y-3">
          <p className="text-muted-foreground">No staff members yet.</p>
          <Link href="/staff" className={buttonVariants({ size: 'sm' })}>Add staff</Link>
        </div>
      )}

      {/* Staff legend */}
      {!loading && staff.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn('w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold', avatarColor(s.name))}>
                {initials(s)}
              </div>
              {s.displayName ?? s.name}
            </div>
          ))}
        </div>
      )}

      {/* Calendar */}
      {(loading || staff.length > 0) && (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {label}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((date, di) => {
                  if (!date) return (
                    <div key={di} className="rounded-lg bg-muted/10 min-h-[90px]" />
                  );
                  const dateStr = toIso(date);
                  const isPast  = date.getTime() < today.getTime();
                  const isToday = dateStr === toIso(today);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => !isPast && setSelectedDate(date)}
                      disabled={isPast || loading}
                      className={cn(
                        'rounded-lg border p-2 text-left transition-all min-h-[90px] flex flex-col gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isPast
                          ? 'bg-muted/10 border-transparent opacity-40 cursor-not-allowed'
                          : 'border-border/50 hover:border-primary/40 hover:bg-accent/5 cursor-pointer',
                        isToday && 'border-primary bg-primary/5',
                      )}
                    >
                      <span className={cn(
                        'text-xs font-semibold leading-none',
                        isToday ? 'text-primary' : 'text-foreground',
                      )}>
                        {date.getDate()}
                      </span>

                      {loading ? (
                        <div className="h-3 bg-muted rounded-full animate-pulse w-10 mt-1" />
                      ) : (
                        <div className="flex flex-wrap gap-[3px] mt-0.5">
                          {staff.map((s) => {
                            const { shift, isTimeOff } = getDayInfo(s, date);
                            const isScheduled = !!getDayInfo(s, date).shift || isTimeOff;
                            return (
                              <div
                                key={s.id}
                                title={`${s.displayName ?? s.name}${isTimeOff ? ' — Off' : shift ? ` — ${shift.startTime}–${shift.endTime}` : ' — Not scheduled'}`}
                                className={cn(
                                  'w-4 h-4 rounded-full text-white flex items-center justify-center text-[8px] font-bold flex-shrink-0',
                                  isTimeOff
                                    ? 'bg-destructive/80'
                                    : shift
                                      ? avatarColor(s.name)
                                      : 'bg-muted-foreground/20',
                                )}
                              >
                                {isTimeOff ? '×' : isScheduled ? '' : '·'}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Mini shift summary for today */}
                      {!loading && isToday && (
                        <div className="text-[9px] text-primary/70 mt-auto">
                          {staff.filter((s) => getDayInfo(s, date).shift).length}/{staff.length} working
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day detail sheet */}
      {selectedDate && (
        <DaySheet
          key={toIso(selectedDate)}
          token={token}
          staff={staff}
          date={selectedDate}
          today={today}
          copiedShift={copiedShift}
          onCopy={setCopiedShift}
          onClose={() => setSelectedDate(null)}
          onRefresh={() => fetchRoster(month, monthEnd)}
          onToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl text-sm font-medium transition-all',
          toast.type === 'success'
            ? 'bg-foreground text-background'
            : 'bg-destructive text-destructive-foreground',
        )}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─── Day Sheet ────────────────────────────────────────────────────────────────

interface DaySheetProps {
  token: string;
  staff: StaffMember[];
  date: Date;
  today: Date;
  copiedShift: Shift | null;
  onCopy: (s: Shift) => void;
  onClose: () => void;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

function DaySheet({ token, staff, date, today, copiedShift, onCopy, onClose, onRefresh, onToast }: DaySheetProps) {
  const dateStr  = toIso(date);
  const wd       = date.getDay();
  const maxDate  = addDays(today, 180);

  const [busyId, setBusyId]         = useState<string | null>(null);
  const [expandId, setExpandId]     = useState<string | null>(null);
  const [addStart, setAddStart]     = useState(dateStr);
  const [addEnd, setAddEnd]         = useState(dateStr);
  const [reason, setReason]         = useState('');
  const [formError, setFormError]   = useState<string | null>(null);
  const [copiedId, setCopiedId]     = useState<string | null>(null); // briefly shows ✓

  const dayLabel = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  async function handleToggleTimeOff(s: StaffMember, isTimeOff: boolean, timeOffId: string | null) {
    setBusyId(s.id);
    try {
      if (isTimeOff && timeOffId) {
        await apiFetch(`/staff/${s.id}/time-off/${timeOffId}`, { method: 'DELETE' }, token);
        onToast(`${s.displayName ?? s.name} back on roster`, 'success');
      } else {
        await apiFetch(
          `/staff/${s.id}/time-off`,
          { method: 'POST', body: JSON.stringify({ start: dateStr, end: dateStr, reason: undefined }) },
          token,
        );
        onToast(`${s.displayName ?? s.name} marked off`, 'success');
      }
      onRefresh();
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : 'Failed to update', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePasteShift(s: StaffMember) {
    if (!copiedShift) return;
    setBusyId(s.id);
    try {
      // Get all current days, update/add this weekday
      const existingHours = s.workingHours.filter((wh) => wh.weekday !== wd);
      const newHours = [
        ...existingHours.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })),
        { weekday: wd, startTime: copiedShift.startTime, endTime: copiedShift.endTime },
      ];
      await apiFetch(
        `/staff/${s.id}/working-hours`,
        { method: 'PUT', body: JSON.stringify({ hours: newHours }) },
        token,
      );
      onToast(`${s.displayName ?? s.name} — ${copiedShift.startTime}–${copiedShift.endTime} on ${DAY_NAMES[wd]}s`, 'success');
      onRefresh();
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : 'Failed to paste shift', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePasteToWeekdays(s: StaffMember) {
    if (!copiedShift) return;
    setBusyId(s.id);
    try {
      const weekdays = [1, 2, 3, 4, 5]; // Mon–Fri
      const weekend  = s.workingHours.filter((wh) => !weekdays.includes(wh.weekday));
      const newHours = [
        ...weekdays.map((d) => ({ weekday: d, startTime: copiedShift.startTime, endTime: copiedShift.endTime })),
        ...weekend.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })),
      ];
      await apiFetch(
        `/staff/${s.id}/working-hours`,
        { method: 'PUT', body: JSON.stringify({ hours: newHours }) },
        token,
      );
      onToast(`${s.displayName ?? s.name} — ${copiedShift.startTime}–${copiedShift.endTime} Mon–Fri`, 'success');
      onRefresh();
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : 'Failed to apply', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddTimeOffRange() {
    setFormError(null);
    if (!addStart || !addEnd || addStart > addEnd) {
      setFormError('Invalid date range.'); return;
    }
    const diffDays = (new Date(addEnd).getTime() - new Date(addStart).getTime()) / 86_400_000;
    if (diffDays > 180) { setFormError('Max 180 days.'); return; }

    const s = expandId ? (staff.find((m) => m.id === expandId) ?? null) : null;
    if (!s) return;

    setBusyId(s.id);
    try {
      await apiFetch(
        `/staff/${s.id}/time-off`,
        { method: 'POST', body: JSON.stringify({ start: addStart, end: addEnd, reason: reason.trim() || undefined }) },
        token,
      );
      onToast(`Time off added for ${s.displayName ?? s.name}`, 'success');
      setReason(''); setAddStart(dateStr); setAddEnd(dateStr); setExpandId(null);
      onRefresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to add time off');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{dayLabel}</SheetTitle>
          <SheetDescription>
            {copiedShift ? (
              <span className="text-primary font-medium flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5" />
                {copiedShift.startTime}–{copiedShift.endTime} ready — tap Paste or Apply Mon–Fri
              </span>
            ) : (
              'Tap a shift to copy it, or manage time off below.'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3 px-1">
          {staff.map((s) => {
            const { shift, isTimeOff, timeOffId } = getDayInfo(s, date);
            const busy = busyId === s.id;
            const isExpanded = expandId === s.id;
            const color = avatarColor(s.name);

            return (
              <div
                key={s.id}
                className={cn(
                  'rounded-xl border p-3 space-y-2 transition-all',
                  isTimeOff ? 'bg-destructive/5 border-destructive/20' : 'border-border bg-card',
                )}
              >
                {/* Staff row */}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden', color)}>
                    {s.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
                    ) : initials(s)}
                  </div>

                  {/* Name + current status */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.displayName ?? s.name}</div>
                    <div className={cn(
                      'text-xs',
                      isTimeOff ? 'text-destructive' : shift ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                    )}>
                      {isTimeOff ? 'Time off' : shift ? `${shift.startTime} – ${shift.endTime}` : 'Not scheduled'}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Copy shift button */}
                    {shift && (
                      <button
                        onClick={() => {
                          onCopy(shift);
                          setCopiedId(s.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        title="Copy this shift"
                        className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >
                        {copiedId === s.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Paste shift button */}
                    {copiedShift && !isTimeOff && (
                      <button
                        onClick={() => handlePasteShift(s)}
                        disabled={busy}
                        title={`Paste ${copiedShift.startTime}–${copiedShift.endTime} to ${DAY_NAMES[wd]}s`}
                        className="h-8 px-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        Paste
                      </button>
                    )}

                    {/* Time off toggle */}
                    <button
                      onClick={() => handleToggleTimeOff(s, isTimeOff, timeOffId)}
                      disabled={busy}
                      title={isTimeOff ? 'Mark as working' : 'Mark as off'}
                      className={cn(
                        'h-8 px-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50',
                        isTimeOff
                          ? 'bg-green-600/10 border border-green-600/30 text-green-700 dark:text-green-400 hover:bg-green-600/20'
                          : 'bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20',
                      )}
                    >
                      {busy ? '…' : isTimeOff ? 'Restore' : 'Mark off'}
                    </button>
                  </div>
                </div>

                {/* Paste to whole week banner */}
                {copiedShift && !isTimeOff && (
                  <button
                    onClick={() => handlePasteToWeekdays(s)}
                    disabled={busy}
                    className="w-full text-xs text-primary/80 hover:text-primary border border-dashed border-primary/20 hover:border-primary/40 rounded-lg py-1.5 transition-all disabled:opacity-50"
                  >
                    Apply {copiedShift.startTime}–{copiedShift.endTime} to all Mon–Fri →
                  </button>
                )}

                {/* Expand for date-range time off */}
                {!isTimeOff && (
                  <button
                    onClick={() => setExpandId(isExpanded ? null : s.id)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {isExpanded ? 'Cancel' : 'Add leave / date range…'}
                  </button>
                )}

                {/* Date range time off form */}
                {isExpanded && (
                  <div className="space-y-3 pt-1 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start</Label>
                        <Input type="date" value={addStart} min={toIso(today)} max={toIso(maxDate)}
                          onChange={(e) => { setAddStart(e.target.value); if (addEnd < e.target.value) setAddEnd(e.target.value); setFormError(null); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End</Label>
                        <Input type="date" value={addEnd} min={addStart || toIso(today)} max={toIso(maxDate)}
                          onChange={(e) => { setAddEnd(e.target.value); setFormError(null); }} />
                      </div>
                    </div>
                    <Input placeholder="Reason (optional)" value={reason} maxLength={200}
                      onChange={(e) => setReason(e.target.value)} />
                    {formError && <p className="text-xs text-destructive">{formError}</p>}
                    <Button size="sm" onClick={handleAddTimeOffRange} disabled={busyId === s.id} className="w-full">
                      {busyId === s.id ? 'Saving…' : 'Add time off'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose} className="w-full">Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
