'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  addDays,
  allWeekdays,
  applyShiftToWeekdays,
  DAY_JS_MON,
  DAY_LABELS_MON,
  DAY_LABELS_SHORT,
  fmtShort,
  getMonday,
  inRange,
  scheduleToPayload,
  shiftForWeekday,
  SHIFT_PRESETS,
  toIso,
  weekdaysMonFri,
  weekdaysRestOfWeekFrom,
  workingHoursToSchedule,
  type ScheduleDay,
  type ShiftClipboard,
  type StaffMember,
} from '@/lib/staff-schedule';
import { Badge } from '@/components/ui/badge';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DashboardToast } from '@/components/dashboard-toast';
import { SaveErrorFeedback, SaveSuccessFeedback } from '@/components/save-feedback';
import { SAVE_MESSAGES } from '@/lib/save-messages';

interface Props {
  token: string;
}

interface SelectedCell {
  staffId: string;
  date: Date;
}

type ViewTab = 'calendar' | 'team';
type ApplyScope = 'day' | 'weekdays' | 'all' | 'rest';

export function RosterClient({ token }: Props) {
  const todayRef = useRef<Date>((() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })());
  const today = todayRef.current;

  const currentWeekStart = useMemo(() => getMonday(today), [today]);
  const maxWeekStart = useMemo(() => addDays(currentWeekStart, 26 * 7), [currentWeekStart]);

  const [view, setView] = useState<ViewTab>('calendar');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [salonDefaults, setSalonDefaults] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [clipboard, setClipboard] = useState<ShiftClipboard | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const canGoPrev = weekStart.getTime() > currentWeekStart.getTime();
  const canGoNext = addDays(weekStart, 7).getTime() <= maxWeekStart.getTime();

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchRoster = useCallback(
    async (from: Date, to: Date) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ staff: StaffMember[]; salonScheduleDefaults?: ScheduleDay[] }>(
          `/roster?from=${toIso(from)}&to=${toIso(to)}`,
          {},
          token,
        );
        setStaff(data.staff ?? []);
        setSalonDefaults(data.salonScheduleDefaults ?? []);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load roster');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchRoster(weekStart, weekEnd);
  }, [fetchRoster, weekStart, weekEnd]);

  const goPrev = () => { if (canGoPrev) setWeekStart((w) => addDays(w, -7)); };
  const goNext = () => { if (canGoNext) setWeekStart((w) => addDays(w, 7)); };
  const goToday = () => setWeekStart(currentWeekStart);

  function countWorking(date: Date): { working: number; total: number } {
    const dateStr = toIso(date);
    const wd = date.getDay();
    const bookable = staff.filter((s) => s.active && s.isBookable);
    const working = bookable.filter((s) => {
      if (s.timeOff.some((t) => inRange(dateStr, t.start, t.end))) return false;
      if (s.workingHours.some((wh) => wh.weekday === wd)) return true;
      return salonDefaults.some((d) => d.weekday === wd && d.enabled);
    });
    return { working: working.length, total: bookable.length };
  }

  const sheetStaff = selectedCell ? staff.find((s) => s.id === selectedCell.staffId) ?? null : null;
  const sheetDate = selectedCell?.date ?? null;

  function handleCellClick(s: StaffMember, date: Date) {
    if (date.getTime() < today.getTime()) return;
    if (clipboard) {
      void pasteShift(s, date.getDay(), clipboard);
      return;
    }
    setSelectedCell({ staffId: s.id, date });
  }

  async function pasteShift(member: StaffMember, weekday: number, shift: ShiftClipboard) {
    const schedule = workingHoursToSchedule(member.workingHours, salonDefaults);
    const next = applyShiftToWeekdays(schedule, [weekday], shift);
    try {
      await apiFetch(
        `/staff/${member.id}/working-hours`,
        { method: 'PUT', body: JSON.stringify({ hours: scheduleToPayload(next) }) },
        token,
      );
      showToast(`Applied to ${DAY_LABELS_SHORT[weekday]}`, 'success');
      await fetchRoster(weekStart, weekEnd);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Paste failed', 'error');
    }
  }

  function copyFromCell(member: StaffMember, date: Date) {
    const wd = date.getDay();
    setClipboard(shiftForWeekday(member.workingHours, wd, salonDefaults));
    showToast('Shift copied — tap cells to paste', 'success');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Roster</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Shifts follow Settings → Business hours by default. Tap a cell to customise, or copy across days.
          </p>
        </div>
        <div className="flex rounded-xl border p-0.5 bg-muted/40">
          <button
            type="button"
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-lg transition-colors',
              view === 'calendar' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => setView('calendar')}
          >
            Calendar
          </button>
          <button
            type="button"
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-lg transition-colors',
              view === 'team' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => setView('team')}
          >
            Team
          </button>
        </div>
      </div>

      {clipboard && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">
            {clipboard.enabled
              ? `Copied: ${clipboard.startTime}–${clipboard.endTime}`
              : 'Copied: Day off'}
          </span>
          <span className="text-muted-foreground">Tap any future cell to paste</span>
          <Button type="button" size="sm" variant="outline" className="ml-auto h-7" onClick={() => setClipboard(null)}>
            Clear
          </Button>
        </div>
      )}

      {view === 'team' ? (
        <TeamPanel token={token} staff={staff} loading={loading} onRefresh={() => fetchRoster(weekStart, weekEnd)} showToast={showToast} />
      ) : (
        <>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={!canGoPrev}>← Prev</Button>
                <Button
                  type="button"
                  variant={weekStart.getTime() === currentWeekStart.getTime() ? 'default' : 'outline'}
                  size="sm"
                  onClick={goToday}
                >
                  Today
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={goNext} disabled={!canGoNext}>Next →</Button>
                <span className="ml-2 text-sm font-medium">
                  Week of {fmtShort(weekStart)} – {fmtShort(weekEnd)}
                </span>
                {loading && <span className="ml-auto text-xs text-muted-foreground animate-pulse">Loading…</span>}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => fetchRoster(weekStart, weekEnd)}>Retry</Button>
            </div>
          )}

          {!loading && staff.length === 0 && !error && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center space-y-2">
                <p className="text-muted-foreground">No staff members yet.</p>
                <Button type="button" size="sm" onClick={() => setView('team')}>Add staff in Team tab</Button>
              </CardContent>
            </Card>
          )}

          {(loading || staff.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Weekly schedule</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium w-44 min-w-[11rem]">Staff</th>
                      {DAY_LABELS_MON.map((label, i) => {
                        const date = weekDates[i]!;
                        const isPast = date.getTime() < today.getTime();
                        const isToday = toIso(date) === toIso(today);
                        return (
                          <th key={label} className={cn('text-center px-2 py-2 font-medium', isToday && 'bg-primary/8', isPast && 'opacity-40')}>
                            <div>{label}</div>
                            <div className="text-xs font-normal text-muted-foreground">
                              {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    {!loading && (
                      <tr className="border-b bg-muted/20">
                        <td className="px-4 py-1.5 text-xs text-muted-foreground font-medium">Working</td>
                        {weekDates.map((date, i) => {
                          const isPast = date.getTime() < today.getTime();
                          const { working, total } = countWorking(date);
                          return (
                            <td key={i} className={cn('text-center px-2 py-1.5', isPast && 'opacity-40')}>
                              <span className={cn('text-xs font-semibold', working === 0 && total > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                                {working} / {total}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 3 }).map((_, ri) => (
                          <tr key={ri} className="border-b animate-pulse">
                            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-28" /></td>
                            {DAY_LABELS_MON.map((l) => (
                              <td key={l} className="px-2 py-3"><div className="h-5 bg-muted rounded mx-auto w-16" /></td>
                            ))}
                          </tr>
                        ))
                      : staff.map((member) => (
                          <tr key={member.id} className={cn('border-b hover:bg-muted/10', (!member.active || !member.isBookable) && 'opacity-50')}>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                                  {member.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    (member.displayName ?? member.name).charAt(0).toUpperCase()
                                  )}
                                </div>
                                <span className="font-medium truncate max-w-[7rem]">{member.displayName ?? member.name}</span>
                              </div>
                            </td>
                            {weekDates.map((date, i) => {
                              const dateStr = toIso(date);
                              const wd = DAY_JS_MON[i]!;
                              const isPast = date.getTime() < today.getTime();
                              const timeOffs = member.timeOff.filter((t) => inRange(dateStr, t.start, t.end));
                              const wh = member.workingHours.find((w) => w.weekday === wd);
                              const defaultDay = salonDefaults.find((d) => d.weekday === wd);
                              const onLeave = timeOffs.length > 0;
                              const isPasteTarget = clipboard && !isPast;
                              const displayShift = wh
                                ? { start: wh.startTime, end: wh.endTime, fromDefault: false }
                                : defaultDay?.enabled
                                  ? { start: defaultDay.startTime, end: defaultDay.endTime, fromDefault: true }
                                  : null;

                              return (
                                <td
                                  key={i}
                                  className={cn(
                                    'px-2 py-2 text-center transition-colors relative',
                                    isPast ? 'opacity-40' : 'cursor-pointer hover:bg-accent/30',
                                    isPasteTarget && 'ring-2 ring-inset ring-primary/40 bg-primary/5',
                                  )}
                                  onClick={() => !isPast && handleCellClick(member, date)}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    if (!isPast) copyFromCell(member, date);
                                  }}
                                >
                                  {onLeave ? (
                                    <Badge variant="destructive" className="text-xs px-1.5 py-0 font-normal">Leave</Badge>
                                  ) : displayShift ? (
                                    <Badge
                                      className={cn(
                                        'text-xs px-1.5 py-0 font-normal whitespace-nowrap',
                                        displayShift.fromDefault
                                          ? 'bg-muted text-foreground hover:bg-muted border border-dashed border-muted-foreground/40'
                                          : 'bg-green-600 hover:bg-green-600',
                                      )}
                                    >
                                      {displayShift.start}–{displayShift.end}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">Off</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground px-4 py-3 border-t">
                  Tip: right-click or long-press a cell to copy · tap to edit · paste mode highlights cells
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {sheetStaff && sheetDate && (
        <ScheduleCellSheet
          key={`${sheetStaff.id}-${toIso(sheetDate)}`}
          token={token}
          staff={sheetStaff}
          date={sheetDate}
          today={today}
          weekDates={weekDates}
          salonDefaults={salonDefaults}
          onClose={() => setSelectedCell(null)}
          onRefresh={() => fetchRoster(weekStart, weekEnd)}
          onCopy={(shift) => {
            setClipboard(shift);
            showToast('Shift copied — tap cells to paste', 'success');
          }}
          showToast={showToast}
        />
      )}

      {toast && (
        <DashboardToast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

// ─── Schedule cell sheet (tap-to-edit with apply-to) ─────────────────────────

function ScheduleCellSheet({
  token,
  staff,
  date,
  today,
  weekDates,
  salonDefaults,
  onClose,
  onRefresh,
  onCopy,
  showToast,
}: {
  token: string;
  staff: StaffMember;
  date: Date;
  today: Date;
  weekDates: Date[];
  salonDefaults: ScheduleDay[];
  onClose: () => void;
  onRefresh: () => void;
  onCopy: (shift: ShiftClipboard) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const dateStr = toIso(date);
  const wd = date.getDay();
  const recurringHour = staff.workingHours.find((wh) => wh.weekday === wd);
  const defaultShift = shiftForWeekday(staff.workingHours, wd, salonDefaults);
  const overlappingTimeOff = staff.timeOff.filter((t) => inRange(dateStr, t.start, t.end));

  const [enabled, setEnabled] = useState(recurringHour ? true : defaultShift.enabled);
  const [startTime, setStartTime] = useState(recurringHour?.startTime ?? defaultShift.startTime);
  const [endTime, setEndTime] = useState(recurringHour?.endTime ?? defaultShift.endTime);
  const [applyScope, setApplyScope] = useState<ApplyScope>('day');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [leaveReason, setLeaveReason] = useState('');

  async function saveSchedule() {
    if (enabled && startTime >= endTime) {
      setFormError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const base = workingHoursToSchedule(staff.workingHours, salonDefaults);
      const shift: ShiftClipboard = { enabled, startTime, endTime };
      let weekdays: number[];
      switch (applyScope) {
        case 'weekdays':
          weekdays = weekdaysMonFri();
          break;
        case 'all':
          weekdays = allWeekdays();
          break;
        case 'rest':
          weekdays = weekdaysRestOfWeekFrom(wd);
          break;
        default:
          weekdays = [wd];
      }
      const next = applyShiftToWeekdays(base, weekdays, shift);
      await apiFetch(
        `/staff/${staff.id}/working-hours`,
        { method: 'PUT', body: JSON.stringify({ hours: scheduleToPayload(next) }) },
        token,
      );
      setSaveSuccess(SAVE_MESSAGES.changesSaved);
      onRefresh();
      window.setTimeout(() => {
        setSaveSuccess(null);
        onClose();
      }, 1200);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function markLeaveForRange(start: string, end: string) {
    setSaving(true);
    try {
      await apiFetch(
        `/staff/${staff.id}/time-off`,
        { method: 'POST', body: JSON.stringify({ start, end, reason: leaveReason.trim() || 'Leave' }) },
        token,
      );
      setSaveSuccess('Leave added');
      onRefresh();
      window.setTimeout(() => {
        setSaveSuccess(null);
        onClose();
      }, 1200);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to add leave');
    } finally {
      setSaving(false);
    }
  }

  async function removeLeave(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(`/staff/${staff.id}/time-off/${id}`, { method: 'DELETE' }, token);
      onRefresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Remove failed');
    } finally {
      setDeletingId(null);
    }
  }

  const weekStartStr = toIso(weekDates[0]!);
  const weekEndStr = toIso(weekDates[6]!);

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{staff.displayName ?? staff.name}</SheetTitle>
          <SheetDescription>{fmtShort(date)} · {DAY_LABELS_SHORT[wd]}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4 px-1">
          {/* Working hours */}
          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Working hours</p>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((v) => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 rounded-full transition-colors',
                  enabled ? 'bg-primary' : 'bg-muted-foreground/25',
                )}
              >
                <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', enabled ? 'translate-x-[22px]' : 'translate-x-0.5')} />
              </button>
            </div>

            {enabled && (
              <>
                <div className="flex items-center gap-2">
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-sm" />
                  <span className="text-muted-foreground">–</span>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-sm" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SHIFT_PRESETS.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs rounded-full"
                      onClick={() => { setStartTime(p.start); setEndTime(p.end); setEnabled(true); }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Apply to</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ['day', 'This day only'],
                  ['weekdays', 'Mon–Fri'],
                  ['rest', 'Rest of week'],
                  ['all', 'Every day'],
                ] as const).map(([scope, label]) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setApplyScope(scope)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                      applyScope === scope ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onCopy({ enabled, startTime, endTime })}>
                Copy shift
              </Button>
              <Button type="button" size="sm" className="flex-1" disabled={saving || !!saveSuccess} onClick={() => void saveSchedule()}>
                {saving ? 'Saving…' : 'Save hours'}
              </Button>
            </div>
          </section>

          {/* Leave */}
          <section className="space-y-3 rounded-xl border p-4">
            <p className="text-sm font-semibold">Leave &amp; time off</p>

            {overlappingTimeOff.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-sm">
                <span>{t.start}{t.start !== t.end ? ` → ${t.end}` : ''}{t.reason ? ` · ${t.reason}` : ''}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={deletingId === t.id} onClick={() => void removeLeave(t.id)}>
                  {deletingId === t.id ? '…' : 'Remove'}
                </Button>
              </div>
            ))}

            <Input placeholder="Reason (optional)" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="text-sm" />

            <div className="grid grid-cols-1 gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void markLeaveForRange(dateStr, dateStr)}>
                Mark on leave today
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void markLeaveForRange(weekStartStr, weekEndStr)}>
                Mark leave this whole week
              </Button>
            </div>
          </section>

          {formError && <SaveErrorFeedback message={formError} className="text-xs" />}
          {saveSuccess && <SaveSuccessFeedback message={saveSuccess} className="text-xs" />}
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Team panel (merged from staff page) ─────────────────────────────────────

function TeamPanel({
  token,
  staff,
  loading,
  onRefresh,
  showToast,
}: {
  token: string;
  staff: StaffMember[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/staff', { method: 'POST', body: JSON.stringify({ name: name.trim(), isBookable: true }) }, token);
      setName('');
      showToast(`${name.trim()} added`, 'success');
      onRefresh();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Add failed', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function toggleBookable(member: StaffMember) {
    setBusyId(member.id);
    try {
      await apiFetch(
        `/staff/${member.id}`,
        { method: 'PATCH', body: JSON.stringify({ isBookable: !member.isBookable }) },
        token,
      );
      showToast(member.isBookable ? 'Hidden from new bookings' : 'Now bookable', 'success');
      onRefresh();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(member: StaffMember) {
    setBusyId(member.id);
    try {
      await apiFetch(`/staff/${member.id}`, { method: 'PATCH', body: JSON.stringify({ active: !member.active }) }, token);
      onRefresh();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add team member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void addStaff(e)} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="flex-1" />
            <Button type="submit" disabled={adding || !name.trim()}>{adding ? 'Adding…' : 'Add'}</Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse px-1">Loading team…</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">No staff yet — add someone above.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {staff.map((m) => (
            <div key={m.id} className={cn('rounded-2xl border p-4 space-y-3', !m.active && 'opacity-60')}>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm shrink-0">
                  {(m.displayName ?? m.name).charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{m.displayName ?? m.name}</p>
                    {!m.active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                    {!m.isBookable && m.active && <Badge variant="outline" className="text-[10px]">Not bookable</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.workingHours.length} days scheduled
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busyId === m.id || !m.active} onClick={() => void toggleBookable(m)}>
                  {m.isBookable ? 'Hide bookings' : 'Allow bookings'}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busyId === m.id} onClick={() => void toggleActive(m)}>
                  {m.active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
