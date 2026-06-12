'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StaffMember, WorkingHour, TimeOff } from './staff-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleDay {
  weekday: number; // 0=Sun … 6=Sat
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface AppointmentBrief {
  id: string;
  start: string;
  status: string;
  service: { name: string } | null;
  customer: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  staff: { id: string } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// JS weekday → column index (Mon=0 … Sun=6)
const DOW_TO_COL: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { weekday: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
  { weekday: 1, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 2, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 3, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 4, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 5, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 6, enabled: false, startTime: '09:00', endTime: '17:00' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEnd(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }

function buildCalendarWeeks(month: Date): (Date | null)[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last  = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const pad   = DOW_TO_COL[first.getDay()]; // Mon-based padding

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = new Array<null>(pad).fill(null);

  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(month.getFullYear(), month.getMonth(), d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function workingHoursToSchedule(wh: WorkingHour[]): ScheduleDay[] {
  return DEFAULT_SCHEDULE.map((d) => {
    const m = wh.find((h) => h.weekday === d.weekday);
    return m ? { weekday: d.weekday, enabled: true, startTime: m.startTime, endTime: m.endTime } : { ...d, enabled: false };
  });
}

function scheduleToPayload(schedule: ScheduleDay[]) {
  return schedule.filter((d) => d.enabled).map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
}

function customerName(c: AppointmentBrief['customer']): string {
  if (!c) return 'Customer';
  if (c.displayName) return c.displayName;
  const first = c.firstName?.trim();
  const last  = c.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  return first ?? last ?? 'Customer';
}

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12  = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onToggle, size = 'md' }: { on: boolean; onToggle: () => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
  const dot = size === 'sm' ? 'size-3 top-0.5' : 'size-4 top-0.5';
  const offset = size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]';
  return (
    <button
      type="button" role="switch" aria-checked={on} onClick={onToggle}
      className={cn('relative inline-flex shrink-0 rounded-full transition-colors focus-visible:outline-none', w, on ? 'bg-primary' : 'bg-muted-foreground/30')}
    >
      <span className={cn('absolute rounded-full bg-white shadow transition-transform', dot, on ? offset : 'translate-x-0.5')} />
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  member: StaffMember;
  token: string;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string, prevSchedule: ScheduleDay[]) => void;
  onError: (message: string) => void;
}

export function StaffCalendarSheet({ member, token, open, onClose, onSaved, onError }: Props) {
  const todayYmd = toYMD(new Date());

  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [schedule, setSchedule]           = useState<ScheduleDay[]>(() => workingHoursToSchedule(member.workingHours));
  const [localTimeOffs, setLocalTimeOffs] = useState<TimeOff[]>([]);
  const [newOffDates, setNewOffDates]     = useState<Set<string>>(new Set()); // YYYY-MM-DD pending additions
  const [removedIds, setRemovedIds]       = useState<Set<string>>(new Set()); // time-off IDs pending removal
  const [appointments, setAppointments]   = useState<AppointmentBrief[]>([]);
  const [loadingAppts, setLoadingAppts]   = useState(false);
  const [hoveredYmd, setHoveredYmd]       = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);

  // reset state when member changes or sheet opens
  useEffect(() => {
    if (!open) return;
    setSchedule(workingHoursToSchedule(member.workingHours));
    setNewOffDates(new Set());
    setRemovedIds(new Set());
  }, [open, member]);

  // fetch time offs once on open
  useEffect(() => {
    if (!open) return;
    apiFetch<{ timeOff: TimeOff[] }>(`/staff/${member.id}/time-off`, {}, token)
      .then((d) => setLocalTimeOffs(d.timeOff ?? []))
      .catch(() => setLocalTimeOffs([]));
  }, [open, member.id, token]);

  // fetch appointments for current month
  useEffect(() => {
    if (!open) return;
    setLoadingAppts(true);
    const from = monthStart(month).toISOString();
    const to   = monthEnd(month).toISOString();
    apiFetch<{ appointments: AppointmentBrief[] }>(`/appointments?from=${from}&to=${to}`, {}, token)
      .then((d) => setAppointments(d.appointments ?? []))
      .catch(() => setAppointments([]))
      .finally(() => setLoadingAppts(false));
  }, [open, month, token]);

  const prevMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  // ── Day info ────────────────────────────────────────────────────────────────

  function getDayInfo(date: Date) {
    const ymd     = toYMD(date);
    const weekday = date.getDay();
    const sch     = schedule.find((s) => s.weekday === weekday);
    const isWorking = sch?.enabled ?? false;

    const existingTimeOff = localTimeOffs.find((t) => {
      if (removedIds.has(t.id)) return false;
      const s = new Date(t.start); s.setHours(0, 0, 0, 0);
      const e = new Date(t.end);   e.setHours(23, 59, 59, 999);
      return date >= s && date <= e;
    });
    const isNewOff   = newOffDates.has(ymd);
    const isTimeOff  = isNewOff || !!existingTimeOff;
    const timeOffId  = existingTimeOff?.id ?? null;

    const dayAppts = appointments.filter((a) => {
      if (a.staff?.id !== member.id) return false;
      if (a.status === 'CANCELLED') return false;
      return isSameDay(new Date(a.start), date);
    });

    return { isWorking, isTimeOff, timeOffId, shift: sch, appointments: dayAppts };
  }

  // ── Click handler ───────────────────────────────────────────────────────────

  function handleDayClick(date: Date) {
    const ymd  = toYMD(date);
    const info = getDayInfo(date);

    if (info.isTimeOff) {
      // remove
      if (info.timeOffId) setRemovedIds((s) => new Set([...s, info.timeOffId!]));
      setNewOffDates((s) => { const n = new Set(s); n.delete(ymd); return n; });
    } else {
      // add
      setNewOffDates((s) => new Set([...s, ymd]));
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const prevSchedule = useRef<ScheduleDay[]>(schedule);

  async function handleSave() {
    const invalid = schedule.find((d) => d.enabled && d.startTime >= d.endTime);
    if (invalid) {
      onError(`End time must be after start time (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][invalid.weekday]})`);
      return;
    }

    prevSchedule.current = workingHoursToSchedule(member.workingHours);
    setSaving(true);
    try {
      await apiFetch(
        `/staff/${member.id}/working-hours`,
        { method: 'PUT', body: JSON.stringify({ hours: scheduleToPayload(schedule) }) },
        token,
      );
      for (const id of removedIds) {
        await apiFetch(`/staff/${member.id}/time-off/${id}`, { method: 'DELETE' }, token).catch(() => null);
      }
      for (const ymd of newOffDates) {
        await apiFetch(
          `/staff/${member.id}/time-off`,
          { method: 'POST', body: JSON.stringify({ start: `${ymd}T00:00:00.000Z`, end: `${ymd}T23:59:59.999Z`, reason: null }) },
          token,
        ).catch(() => null);
      }
      onClose();
      onSaved('Schedule saved', prevSchedule.current);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null;

  const weeks     = buildCalendarWeeks(month);
  const today     = new Date();
  const hoveredInfo = hoveredYmd
    ? getDayInfo(new Date(hoveredYmd + 'T12:00:00'))
    : null;

  const monthLabel = month.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

  const pendingCount = newOffDates.size + removedIds.size;
  const hasChanges = pendingCount > 0 || JSON.stringify(scheduleToPayload(schedule)) !== JSON.stringify(scheduleToPayload(workingHoursToSchedule(member.workingHours)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-card rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
              {(member.displayName || member.name)[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm">{member.displayName || member.name}</p>
              <p className="text-xs text-muted-foreground">Schedule &amp; time off</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <button type="button" onClick={prevMonth} className="size-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-semibold text-sm">{monthLabel}</p>
            <div className="flex items-center gap-2">
              {loadingAppts && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              <button type="button" onClick={nextMonth} className="size-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2 text-[11px] text-muted-foreground border-b bg-muted/20">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-card border" />Working</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted/50" />Day off</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-200 dark:bg-amber-800/50" />Time off</span>
            <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-full bg-primary" /><span className="text-primary-foreground text-[8px] font-bold" /></span>
            <span className="ml-auto italic">Click a date to mark / unmark time off</span>
          </div>

          {/* Calendar grid */}
          <div className="px-4 py-3">
            {/* Column headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Week rows */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                {week.map((date, di) => {
                  if (!date) return <div key={di} />;
                  const ymd  = toYMD(date);
                  const info = getDayInfo(date);
                  const isToday  = isSameDay(date, today);
                  const isPast   = date < new Date(new Date().setHours(0, 0, 0, 0));
                  const isHovered = hoveredYmd === ymd;

                  return (
                    <button
                      key={di}
                      type="button"
                      className={cn(
                        'relative min-h-[68px] rounded-xl p-1.5 text-left transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        info.isTimeOff
                          ? 'bg-amber-50 dark:bg-amber-900/25 border-amber-300/60 dark:border-amber-700/50'
                          : info.isWorking
                            ? 'bg-card border-border/50 hover:bg-muted/40'
                            : 'bg-muted/25 border-border/25 hover:bg-muted/40',
                        isToday && 'ring-2 ring-primary ring-offset-1',
                        isPast && 'opacity-60',
                        isHovered && 'shadow-md scale-[1.03] z-10',
                      )}
                      onClick={() => handleDayClick(date)}
                      onMouseEnter={() => setHoveredYmd(ymd)}
                      onMouseLeave={() => setHoveredYmd(null)}
                    >
                      {/* Date number */}
                      <span className={cn('block text-xs font-bold leading-none', isToday && 'text-primary text-sm')}>
                        {date.getDate()}
                      </span>

                      {/* Shift time */}
                      {info.isWorking && !info.isTimeOff && info.shift && (
                        <span className="block text-[9px] text-muted-foreground mt-0.5 leading-none">
                          {fmt12(info.shift.startTime)}–{fmt12(info.shift.endTime)}
                        </span>
                      )}

                      {/* Time off label */}
                      {info.isTimeOff && (
                        <span className="block text-[9px] text-amber-600 dark:text-amber-400 mt-0.5 leading-none font-medium">
                          Time off
                        </span>
                      )}

                      {/* Day off label */}
                      {!info.isWorking && !info.isTimeOff && (
                        <span className="block text-[9px] text-muted-foreground/50 mt-0.5 leading-none">—</span>
                      )}

                      {/* Booking count badge */}
                      {info.appointments.length > 0 && (
                        <span className="absolute bottom-1.5 right-1.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-sm">
                          {info.appointments.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Hover detail panel */}
          {hoveredYmd && hoveredInfo && (
            <div className="mx-4 mb-3 rounded-xl border bg-muted/30 px-4 py-3 transition-all">
              <p className="text-xs font-semibold mb-2">
                {new Date(hoveredYmd + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
                {hoveredInfo.isTimeOff && <span className="ml-2 text-amber-600 font-normal">· Time off</span>}
                {!hoveredInfo.isWorking && !hoveredInfo.isTimeOff && <span className="ml-2 text-muted-foreground font-normal">· Day off</span>}
              </p>
              {hoveredInfo.isWorking && !hoveredInfo.isTimeOff && hoveredInfo.shift && (
                <p className="text-xs text-muted-foreground mb-2">
                  Shift: <strong>{hoveredInfo.shift.startTime} – {hoveredInfo.shift.endTime}</strong>
                </p>
              )}
              {hoveredInfo.appointments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No bookings this day</p>
              ) : (
                <div className="space-y-1.5">
                  {hoveredInfo.appointments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span className="shrink-0 text-muted-foreground font-mono">
                        {new Date(a.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-medium truncate">{customerName(a.customer)}</span>
                      <span className="text-muted-foreground truncate">· {a.service?.name ?? 'Service'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Weekly recurring schedule editor */}
          <div className="px-4 pb-4">
            <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">
                  Recurring weekly schedule
                </p>
                <Info className="size-3.5 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                These repeat every week. Toggle individual dates above to add one-off time off.
              </p>
              <div className="space-y-1.5">
                {schedule.map((day) => {
                  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  return (
                    <div
                      key={day.weekday}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 border transition-colors',
                        day.enabled ? 'bg-card border-border' : 'bg-transparent border-border/40 opacity-60',
                      )}
                    >
                      <Toggle
                        size="sm"
                        on={day.enabled}
                        onToggle={() => setSchedule((s) => s.map((d) => d.weekday === day.weekday ? { ...d, enabled: !d.enabled } : d))}
                      />
                      <span className="w-8 text-xs font-semibold shrink-0">{labels[day.weekday]}</span>
                      {day.enabled ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => setSchedule((s) => s.map((d) => d.weekday === day.weekday ? { ...d, startTime: e.target.value } : d))}
                            className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">–</span>
                          <input
                            type="time"
                            value={day.endTime}
                            onChange={(e) => setSchedule((s) => s.map((d) => d.weekday === day.weekday ? { ...d, endTime: e.target.value } : d))}
                            className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex-1">Day off</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="text-xs text-muted-foreground">
            {pendingCount > 0 && (
              <span className="text-amber-600 font-medium">
                {pendingCount} time-off change{pendingCount === 1 ? '' : 's'} pending
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !hasChanges}
              className="min-w-[120px]"
            >
              {saving ? (
                <><Loader2 className="size-3.5 animate-spin mr-1.5" />Saving…</>
              ) : 'Save schedule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
