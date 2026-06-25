'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
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
import { ChevronLeft, ChevronRight, Copy, Check, X, ClipboardPaste, Plus } from 'lucide-react';
import { CollapsibleSection } from '@/components/collapsible-section';
import { PremiumDisclosure } from '@/components/premium-disclosure';
import { SectionPanel } from '@/components/section-panel';
import { useSalonLiveUpdates } from '@/hooks/use-salon-live-updates';
import { StaffAvatar } from '@/components/staff-avatar';
import { StaffAvatarUpload } from '@/components/staff-avatar-upload';
import { StaffCard } from '@/components/StaffCard';
import {
  StaffUtilisationRow,
  type StaffUtilisationData,
} from '@/components/StaffUtilisationRow';

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
  serviceNames?: string[];
  linkedServiceIds?: string[];
}

interface Shift { startTime: string; endTime: string }
interface Props {
  token: string;
  openAddStaff?: boolean;
  branchId?: string;
  hidePageHeader?: boolean;
}

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

// ─── Main component ───────────────────────────────────────────────────────────

export function RosterClient({ token, openAddStaff = false, branchId, hidePageHeader = false }: Props) {
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
  const [addStaffOpen, setAddStaffOpen] = useState(openAddStaff);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [utilisation, setUtilisation] = useState<StaffUtilisationData[]>([]);

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

  const fetchRoster = useCallback(async (from: Date, to: Date, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const branchQuery = branchId ? `&branchId=${encodeURIComponent(branchId)}` : '';
      const data = await apiFetch<{ staff: StaffMember[] }>(
        `/roster?from=${toIso(from)}&to=${toIso(to)}${branchQuery}`, {}, token,
      );
      setStaff(data.staff ?? []);
      setError(null);
    } catch (e) {
      if (!silent) {
        setError(e instanceof ApiError ? e.message : 'Failed to load roster');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, branchId]);

  const fetchUtilisation = useCallback(async () => {
    try {
      const branchQuery = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
      const data = await apiFetch<{ staff: StaffUtilisationData[] }>(
        `/staff/utilisation${branchQuery}`,
        {},
        token,
      );
      setUtilisation(data.staff ?? []);
    } catch {
      setUtilisation([]);
    }
  }, [token, branchId]);

  useEffect(() => { fetchRoster(month, monthEnd); }, [fetchRoster, month, monthEnd]);
  useEffect(() => { void fetchUtilisation(); }, [fetchUtilisation]);

  const onLiveUpdate = useCallback(
    () => {
      void fetchRoster(month, monthEnd, true);
      void fetchUtilisation();
    },
    [fetchRoster, fetchUtilisation, month, monthEnd],
  );
  const { connected: liveConnected } = useSalonLiveUpdates(token, onLiveUpdate);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page-flow">

      {/* Header */}
      {!hidePageHeader && (
      <div className="flex items-start justify-between gap-4 flex-wrap dashboard-page-header">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">Roster</h1>
          <PremiumDisclosure label="How roster works">
            Tap any future date to manage shifts and time off.
            {liveConnected && (
              <>
                {' '}
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                  Live sync
                </span>
              </>
            )}
          </PremiumDisclosure>
        </div>

        <Button size="sm" onClick={() => setAddStaffOpen(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" />
          Add staff
        </Button>

        {/* Copied shift chip — desktop only inline; mobile shows below when set */}
        {copiedShift && (
          <div className="hidden md:flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
            <ClipboardPaste className="w-3.5 h-3.5" />
            {copiedShift.startTime}–{copiedShift.endTime} ready to paste
            <button onClick={() => setCopiedShift(null)} className="ml-1 opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      )}

      {hidePageHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Click any date to manage shifts and time off.
            {liveConnected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                Live sync
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {copiedShift && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary rounded-full px-3 py-1 text-xs font-medium">
                <ClipboardPaste className="w-3 h-3" />
                {copiedShift.startTime}–{copiedShift.endTime}
                <button onClick={() => setCopiedShift(null)} className="opacity-60 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <Button size="sm" onClick={() => setAddStaffOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add staff
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="dashboard-section border-destructive/40 bg-destructive/5">
          <div className="dashboard-section-body flex items-center justify-between gap-3 text-sm text-destructive py-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => fetchRoster(month, monthEnd)}>Retry</Button>
          </div>
        </div>
      )}

      {!loading && staff.length === 0 && !error && (
        <div className="dashboard-section border-dashed">
          <div className="dashboard-section-body px-6 py-14 text-center space-y-3">
            <p className="text-muted-foreground">No staff members yet.</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Add your team so they appear on the roster and in WhatsApp booking.
            </p>
            <Button size="sm" onClick={() => setAddStaffOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add staff
            </Button>
          </div>
        </div>
      )}

      {copiedShift && (
        <div className="md:hidden flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary rounded-full px-3 py-2 text-xs font-medium w-fit">
          <ClipboardPaste className="w-3 h-3" />
          {copiedShift.startTime}–{copiedShift.endTime}
          <button onClick={() => setCopiedShift(null)} className="opacity-60 hover:opacity-100 touch-manipulation min-h-[2rem] min-w-[2rem] flex items-center justify-center">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {!loading && staff.length > 0 && (
        <CollapsibleSection
          id="roster-team"
          title="Your team"
          count={staff.length}
          subtitle="Tap a member to edit"
          manualToggle
        >
          <div className="roster-staff-strip">
            {staff.map((s) => (
              <StaffCard
                key={s.id}
                staff={s}
                token={token}
                onEdit={() => setEditStaff(s)}
                onServicesLinked={() => {
                  void fetchRoster(month, monthEnd, true);
                  void fetchUtilisation();
                }}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {!loading && staff.length > 0 && (
        <CollapsibleSection
          id="roster-capacity"
          title="Today's capacity"
          subtitle="Booked slots vs availability"
          manualToggle
        >
          <StaffUtilisationRow staff={staff} utilisation={utilisation} embedded />
        </CollapsibleSection>
      )}

      {/* Calendar */}
      {(loading || staff.length > 0) && (
        <SectionPanel
          className="roster-calendar-section"
          title="Schedule calendar"
          subtitle={month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          action={
            <div className="flex items-center gap-1 roster-month-nav">
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
            </div>
          }
        >
          {loading && (
            <p className="text-xs text-muted-foreground animate-pulse px-1 pb-2">Loading schedule…</p>
          )}
          <div className="roster-calendar-grid">
            <div className="roster-weekday-row">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="roster-week-row">
                {week.map((date, di) => {
                  if (!date) return (
                    <div key={di} className="bg-muted/15 min-h-[90px]" />
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
                        'roster-day-cell p-2 text-left transition-colors min-h-[90px] flex flex-col gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset touch-manipulation',
                        isPast
                          ? 'bg-muted/20 opacity-45 cursor-not-allowed'
                          : 'bg-card hover:bg-accent/10 cursor-pointer',
                        isToday && 'bg-primary/[0.07] ring-1 ring-inset ring-primary/35',
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
                            const label = s.displayName ?? s.name;
                            const tooltip = `${label}${isTimeOff ? ' — Off' : shift ? ` — ${shift.startTime}–${shift.endTime}` : ' — Not scheduled'}`;

                            if (isTimeOff) {
                              return (
                                <div
                                  key={s.id}
                                  title={tooltip}
                                  className="size-[18px] rounded-full bg-destructive/80 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0 ring-1 ring-background"
                                >
                                  ×
                                </div>
                              );
                            }

                            if (!shift) {
                              return (
                                <div
                                  key={s.id}
                                  title={tooltip}
                                  className="size-[18px] rounded-full bg-muted-foreground/20 flex items-center justify-center text-[8px] text-muted-foreground flex-shrink-0"
                                >
                                  ·
                                </div>
                              );
                            }

                            return (
                              <StaffAvatar
                                key={s.id}
                                name={s.name}
                                displayName={s.displayName}
                                avatarUrl={s.avatarUrl}
                                size="xs"
                                title={tooltip}
                                className="ring-1 ring-background"
                              />
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
        </SectionPanel>
      )}

      <AddStaffSheet
        token={token}
        branchId={branchId}
        open={addStaffOpen}
        onOpenChange={setAddStaffOpen}
        onCreated={() => {
          fetchRoster(month, monthEnd);
          showToast('Staff member added', 'success');
        }}
        onError={(msg) => showToast(msg, 'error')}
      />

      {editStaff && (
        <EditStaffSheet
          token={token}
          staff={editStaff}
          onClose={() => setEditStaff(null)}
          onSaved={() => {
            setEditStaff(null);
            fetchRoster(month, monthEnd);
            showToast('Profile updated', 'success');
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
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
          'fixed left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl text-sm font-medium transition-all dashboard-toast-bottom',
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
      <SheetContent className="w-full sm:max-w-lg dashboard-sheet-scroll flex flex-col">
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
                  <StaffAvatar
                    name={s.name}
                    displayName={s.displayName}
                    avatarUrl={s.avatarUrl}
                    size="md"
                  />

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
                        className="min-h-[2.75rem] min-w-[2.75rem] rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors touch-manipulation"
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
                        className="min-h-[2.75rem] px-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1 touch-manipulation"
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
                        'min-h-[2.75rem] px-3 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 touch-manipulation',
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
                    className="w-full text-xs text-primary/80 hover:text-primary border border-dashed border-primary/20 hover:border-primary/40 rounded-lg py-2.5 min-h-[2.75rem] transition-all disabled:opacity-50 touch-manipulation"
                  >
                    Apply {copiedShift.startTime}–{copiedShift.endTime} to all Mon–Fri →
                  </button>
                )}

                {/* Expand for date-range time off */}
                {!isTimeOff && (
                  <button
                    onClick={() => setExpandId(isExpanded ? null : s.id)}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline min-h-[2.75rem] touch-manipulation"
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

// ─── Add staff sheet ──────────────────────────────────────────────────────────

interface AddStaffSheetProps {
  token: string;
  branchId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  onError: (message: string) => void;
}

function AddStaffSheet({ token, branchId, open, onOpenChange, onCreated, onError }: AddStaffSheetProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isBookable, setIsBookable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setDisplayName('');
    setSpecialties('');
    setAvatarUrl(null);
    setIsBookable(true);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Name is required.');
      return;
    }

    const specialtyList = specialties
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    setFormError(null);
    try {
      await apiFetch<{ staff: StaffMember }>(
        '/staff',
        {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedName,
            displayName: displayName.trim() || null,
            specialties: specialtyList,
            isBookable,
            avatarUrl,
            ...(branchId ? { branchId } : {}),
          }),
        },
        token,
      );
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to add staff member';
      setFormError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md dashboard-sheet-scroll flex flex-col">
        <SheetHeader>
          <SheetTitle>Add staff member</SheetTitle>
          <SheetDescription>
            They&apos;ll appear on the roster and as a booking option on WhatsApp when bookable.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <StaffAvatarUpload
            token={token}
            name={name || 'Staff'}
            displayName={displayName || null}
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
            disabled={saving}
          />

          <div className="space-y-1.5">
            <Label htmlFor="staff-name">Full name *</Label>
            <Input
              id="staff-name"
              placeholder="e.g. Sarah Ndlovu"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormError(null);
              }}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-display">Display name (optional)</Label>
            <Input
              id="staff-display"
              placeholder="Shown to clients — defaults to full name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-specialties">Specialties (optional)</Label>
            <Input
              id="staff-specialties"
              placeholder="e.g. Braids, Colour, Nails"
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">Separate with commas</p>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isBookable}
              onChange={(e) => setIsBookable(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Available for WhatsApp bookings
          </label>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <SheetFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : 'Add staff'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit staff sheet ─────────────────────────────────────────────────────────

interface EditStaffSheetProps {
  token: string;
  staff: StaffMember;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

function EditStaffSheet({ token, staff, onClose, onSaved, onError }: EditStaffSheetProps) {
  const [displayName, setDisplayName] = useState(staff.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(staff.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(
        `/staff/${staff.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            displayName: displayName.trim() || null,
            avatarUrl,
          }),
        },
        token,
      );
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update profile';
      setFormError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md dashboard-sheet-scroll flex flex-col">
        <SheetHeader>
          <SheetTitle>{staff.displayName ?? staff.name}</SheetTitle>
          <SheetDescription>
            Update their profile photo and display name shown on the roster.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <StaffAvatarUpload
            token={token}
            name={staff.name}
            displayName={displayName || staff.displayName}
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
            disabled={saving}
          />

          <div className="space-y-1.5">
            <Label htmlFor="edit-staff-display">Display name</Label>
            <Input
              id="edit-staff-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={staff.name}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">Legal name: {staff.name}</p>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <SheetFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
