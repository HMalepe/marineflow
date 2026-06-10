'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

interface Props {
  token: string;
}

interface SelectedCell {
  staffId: string;
  date: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Local-timezone YYYY-MM-DD — avoids UTC midnight rollback in e.g. SAST (UTC+2). */
function toIso(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function getMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_JS     = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() value for each column

// ─── Main component ───────────────────────────────────────────────────────────

export function RosterClient({ token }: Props) {
  // Stable "today" — captured once on mount, never drifts mid-session.
  const todayRef = useRef<Date>((() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })());
  const today = todayRef.current;

  const currentWeekStart = useMemo(() => getMonday(today), [today]);
  const maxWeekStart     = useMemo(() => addDays(currentWeekStart, 26 * 7), [currentWeekStart]);

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const weekEnd  = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDates: Date[] = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const canGoPrev = weekStart.getTime() > currentWeekStart.getTime();
  const canGoNext = addDays(weekStart, 7).getTime() <= maxWeekStart.getTime();

  // ── Fetch roster ─────────────────────────────────────────────────────────

  const fetchRoster = useCallback(
    async (from: Date, to: Date) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ staff: StaffMember[] }>(
          `/roster?from=${toIso(from)}&to=${toIso(to)}`,
          {},
          token,
        );
        setStaff(data.staff ?? []);
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

  // ── Navigation ────────────────────────────────────────────────────────────

  const goPrev   = () => { if (canGoPrev) setWeekStart((w) => addDays(w, -7)); };
  const goNext   = () => { if (canGoNext) setWeekStart((w) => addDays(w, 7)); };
  const goToday  = () => setWeekStart(currentWeekStart);

  // ── Summary row ───────────────────────────────────────────────────────────

  function countWorking(date: Date): { working: number; total: number } {
    const dateStr = toIso(date);
    const wd = date.getDay();
    const bookable = staff.filter((s) => s.active && s.isBookable);
    const working = bookable.filter((s) => {
      if (s.timeOff.some((t) => inRange(dateStr, t.start, t.end))) return false;
      return s.workingHours.some((wh) => wh.weekday === wd);
    });
    return { working: working.length, total: bookable.length };
  }

  // ── Sheet helpers ─────────────────────────────────────────────────────────

  const sheetStaff = selectedCell
    ? (staff.find((s) => s.id === selectedCell.staffId) ?? null)
    : null;
  const sheetDate = selectedCell?.date ?? null;

  function handleCellClick(s: StaffMember, date: Date) {
    if (date.getTime() < today.getTime()) return; // past — not clickable
    setSelectedCell({ staffId: s.id, date });
  }

  function closeSheet() { setSelectedCell(null); }

  function onRosterRefresh() {
    // Refresh but keep the sheet open — sheetStaff auto-updates from the new staff list
    fetchRoster(weekStart, weekEnd);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Roster</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Weekly staff schedule — click any cell to manage time off. Up to 26 weeks ahead.
        </p>
      </div>

      {/* Navigation */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={goPrev} disabled={!canGoPrev}>
              ← Prev
            </Button>
            <Button
              variant={weekStart.getTime() === currentWeekStart.getTime() ? 'default' : 'outline'}
              size="sm"
              onClick={goToday}
            >
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} disabled={!canGoNext}>
              Next →
            </Button>
            <span className="ml-2 text-sm font-medium">
              Week of{' '}
              {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' '}–{' '}
              {weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {loading && (
              <span className="ml-auto text-xs text-muted-foreground animate-pulse">Loading…</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => fetchRoster(weekStart, weekEnd)}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && staff.length === 0 && !error && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-2">
            <p className="text-muted-foreground">No staff members yet.</p>
            <Button asChild size="sm">
              <Link href="/staff">Add staff</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Roster grid */}
      {(loading || staff.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                {/* Day header */}
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium w-44 min-w-[11rem]">Staff</th>
                  {DAY_LABELS.map((label, i) => {
                    const date    = weekDates[i]!;
                    const isPast  = date.getTime() < today.getTime();
                    const isToday = toIso(date) === toIso(today);
                    return (
                      <th
                        key={label}
                        className={cn(
                          'text-center px-2 py-2 font-medium',
                          isToday && 'bg-primary/8',
                          isPast && 'opacity-40',
                        )}
                      >
                        <div>{label}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      </th>
                    );
                  })}
                </tr>

                {/* Summary row */}
                {!loading && (
                  <tr className="border-b bg-muted/20">
                    <td className="px-4 py-1.5 text-xs text-muted-foreground font-medium">
                      Working
                    </td>
                    {weekDates.map((date, i) => {
                      const isPast = date.getTime() < today.getTime();
                      const { working, total } = countWorking(date);
                      const allOff = working === 0 && total > 0;
                      return (
                        <td key={i} className={cn('text-center px-2 py-1.5', isPast && 'opacity-40')}>
                          <span className={cn(
                            'text-xs font-semibold',
                            allOff ? 'text-destructive' : 'text-muted-foreground',
                          )}>
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
                  ? Array.from({ length: 4 }).map((_, ri) => (
                      <tr key={ri} className="border-b animate-pulse">
                        <td className="px-4 py-3">
                          <div className="h-4 bg-muted rounded w-28" />
                        </td>
                        {DAY_LABELS.map((l) => (
                          <td key={l} className="px-2 py-3 text-center">
                            <div className="h-5 bg-muted rounded mx-auto w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : staff.map((member) => (
                      <tr
                        key={member.id}
                        className={cn(
                          'border-b hover:bg-muted/10',
                          (!member.active || !member.isBookable) && 'opacity-50',
                        )}
                      >
                        {/* Staff name */}
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                              {member.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                (member.displayName ?? member.name).charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium truncate block max-w-[7rem]">
                                {member.displayName ?? member.name}
                              </span>
                              {(!member.active || !member.isBookable) && (
                                <span className="text-[10px] text-muted-foreground">
                                  {!member.active ? 'Inactive' : 'Not bookable'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Day cells */}
                        {weekDates.map((date, i) => {
                          const dateStr  = toIso(date);
                          const wd       = date.getDay();
                          const isPast   = date.getTime() < today.getTime();
                          const timeOffs = member.timeOff.filter((t) => inRange(dateStr, t.start, t.end));
                          const wh       = member.workingHours.find((w) => w.weekday === wd);
                          const onLeave  = timeOffs.length > 0;

                          return (
                            <td
                              key={i}
                              title={
                                isPast
                                  ? undefined
                                  : onLeave
                                    ? `${member.displayName ?? member.name} — time off${timeOffs[0]?.reason ? `: ${timeOffs[0].reason}` : ''}`
                                    : wh
                                      ? `${member.displayName ?? member.name} — ${wh.startTime}–${wh.endTime}`
                                      : `${member.displayName ?? member.name} — not scheduled`
                              }
                              className={cn(
                                'px-2 py-2 text-center transition-colors',
                                isPast
                                  ? 'opacity-40'
                                  : 'cursor-pointer hover:bg-accent/30',
                              )}
                              onClick={() => !isPast && handleCellClick(member, date)}
                            >
                              {onLeave ? (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0 font-normal">
                                  Off
                                </Badge>
                              ) : wh ? (
                                <Badge className="text-xs px-1.5 py-0 bg-green-600 hover:bg-green-600 font-normal whitespace-nowrap">
                                  {wh.startTime}–{wh.endTime}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs select-none">–</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Detail sheet */}
      {sheetStaff && sheetDate && (
        <DetailSheet
          key={`${sheetStaff.id}-${toIso(sheetDate)}`}
          token={token}
          staff={sheetStaff}
          date={sheetDate}
          today={today}
          onClose={closeSheet}
          onRefresh={onRosterRefresh}
        />
      )}
    </div>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DetailSheetProps {
  token: string;
  staff: StaffMember;
  date: Date;
  today: Date;
  onClose: () => void;
  onRefresh: () => void;
}

function DetailSheet({ token, staff, date, today, onClose, onRefresh }: DetailSheetProps) {
  const maxDate   = useMemo(() => addDays(today, 180), [today]);
  const dateStr   = toIso(date);
  const wd        = date.getDay();

  const recurringHour      = staff.workingHours.find((wh) => wh.weekday === wd);
  const overlappingTimeOff = staff.timeOff.filter((t) => inRange(dateStr, t.start, t.end));

  const [addStart, setAddStart] = useState(dateStr);
  const [addEnd, setAddEnd]     = useState(dateStr);
  const [reason, setReason]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [formError, setFormError]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  function handleStartChange(v: string) {
    setAddStart(v);
    // Auto-advance end date if it would be before the new start
    if (addEnd < v) setAddEnd(v);
    setFormError(null);
  }

  async function handleAddTimeOff() {
    setFormError(null);
    if (!addStart || !addEnd) {
      setFormError('Please select both dates.');
      return;
    }
    if (addStart > addEnd) {
      setFormError('Start date must be on or before end date.');
      return;
    }
    const diffDays = (new Date(addEnd).getTime() - new Date(addStart).getTime()) / 86_400_000;
    if (diffDays > 180) {
      setFormError('Range cannot exceed 180 days.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(
        `/staff/${staff.id}/time-off`,
        { method: 'POST', body: JSON.stringify({ start: addStart, end: addEnd, reason: reason.trim() || undefined }) },
        token,
      );
      setSuccessMsg(`Time off added: ${addStart}${addStart !== addEnd ? ` → ${addEnd}` : ''}`);
      setReason('');
      setAddStart(dateStr);
      setAddEnd(dateStr);
      // Refresh the grid data — sheet stays open, parent re-renders sheetStaff with updated timeOff
      onRefresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to add time off');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTimeOff(timeOffId: string) {
    setDeletingId(timeOffId);
    setFormError(null);
    try {
      await apiFetch(`/staff/${staff.id}/time-off/${timeOffId}`, { method: 'DELETE' }, token);
      // Refresh but keep sheet open
      onRefresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to remove time off');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{staff.displayName ?? staff.name}</SheetTitle>
          <SheetDescription>{fmtShort(date)} · {DAY_NAMES[wd]}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4 px-1">

          {/* Recurring schedule */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Recurring schedule
            </p>
            {recurringHour ? (
              <p className="text-sm">
                Works {DAY_NAMES[wd]}s · {recurringHour.startTime}–{recurringHour.endTime}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not scheduled on {DAY_NAMES[wd]}s</p>
            )}
          </div>

          {/* Existing time-off covering this date */}
          {overlappingTimeOff.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Time off covering this date
              </p>
              <div className="space-y-2">
                {overlappingTimeOff.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {t.start}{t.start !== t.end ? ` → ${t.end}` : ''}
                      </p>
                      {t.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">{t.reason}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 px-2 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={deletingId === t.id}
                      onClick={() => handleDeleteTimeOff(t.id)}
                    >
                      {deletingId === t.id ? 'Removing…' : 'Remove'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <p className="text-sm text-green-700 dark:text-green-400 bg-green-600/10 border border-green-600/20 rounded-md px-3 py-2">
              ✓ {successMsg}
            </p>
          )}

          {/* Add time-off form */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add time off
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="to-start" className="text-xs">Start date</Label>
                <Input
                  id="to-start"
                  type="date"
                  value={addStart}
                  min={toIso(today)}
                  max={toIso(maxDate)}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to-end" className="text-xs">End date</Label>
                <Input
                  id="to-end"
                  type="date"
                  value={addEnd}
                  min={addStart || toIso(today)}
                  max={toIso(maxDate)}
                  onChange={(e) => { setAddEnd(e.target.value); setFormError(null); }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="to-reason" className="text-xs">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                id="to-reason"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[64px] resize-none"
                placeholder="e.g. Annual leave, sick day, training…"
                value={reason}
                maxLength={200}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">{reason.length} / 200</p>
            </div>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button onClick={handleAddTimeOff} disabled={submitting || !addStart || !addEnd}>
            {submitting ? 'Saving…' : 'Add time off'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
