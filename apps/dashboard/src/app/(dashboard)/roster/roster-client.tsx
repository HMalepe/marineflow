'use client';

import { useCallback, useEffect, useState } from 'react';
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
  startTime: string; // HH:MM
  endTime: string;
}

interface TimeOffBlock {
  id: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
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

interface RosterResponse {
  staff: StaffMember[];
}

interface Props {
  token: string;
}

interface SelectedCell {
  staffId: string;
  date: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return the Monday of the week containing `d`. */
function getMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/** Add `n` days to `d` (returns a new Date). */
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Format a Date as "YYYY-MM-DD". */
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format a Date as "Mon DD MMM" (e.g. "Mon 10 Jun"). */
function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** True if `dateStr` (YYYY-MM-DD) falls within [start, end] inclusive. */
function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

/** JS weekday (0=Sun) for a given Date. */
function jsWeekday(d: Date): number {
  return d.getDay();
}

// Day-of-week labels for the 7 columns (Mon–Sun).
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// JS weekday numbers for Mon–Sun columns
const DAY_JS = [1, 2, 3, 4, 5, 6, 0];

// ─── Main component ───────────────────────────────────────────────────────────

export function RosterClient({ token }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const currentWeekStart = getMonday(today);
  const maxWeekStart = addDays(currentWeekStart, 26 * 7);

  const weekEnd = addDays(weekStart, 6);

  const canGoPrev = weekStart > currentWeekStart;
  const canGoNext = addDays(weekStart, 7) <= maxWeekStart;

  // Build the 7 dates for this week (Mon … Sun)
  const weekDates: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ── Fetch roster ─────────────────────────────────────────────────────────

  const fetchRoster = useCallback(
    async (from: Date, to: Date) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<RosterResponse>(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // ── Navigation ────────────────────────────────────────────────────────────

  function goPrev() {
    if (canGoPrev) setWeekStart((w) => addDays(w, -7));
  }
  function goNext() {
    if (canGoNext) setWeekStart((w) => addDays(w, 7));
  }
  function goToday() {
    setWeekStart(currentWeekStart);
  }

  // ── Summary: total staff working per day ──────────────────────────────────

  function countWorking(date: Date): number {
    const dateStr = toIso(date);
    const wd = jsWeekday(date);
    return staff.filter((s) => {
      const onTimeOff = s.timeOff.some((t) => inRange(dateStr, t.start, t.end));
      if (onTimeOff) return false;
      return s.workingHours.some((wh) => wh.weekday === wd);
    }).length;
  }

  // ── Sheet state ───────────────────────────────────────────────────────────

  const sheetStaff = selectedCell
    ? (staff.find((s) => s.id === selectedCell.staffId) ?? null)
    : null;
  const sheetDate = selectedCell?.date ?? null;

  function closeSheet() {
    setSelectedCell(null);
  }

  function handleCellClick(s: StaffMember, date: Date) {
    const isPast = date < today;
    if (isPast) return;
    setSelectedCell({ staffId: s.id, date });
  }

  function onRosterRefresh() {
    fetchRoster(weekStart, weekEnd);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Roster</h2>
        <p className="text-muted-foreground">Weekly staff schedule and time-off management</p>
      </div>

      {/* Navigation bar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={goPrev} disabled={!canGoPrev}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} disabled={!canGoNext}>
              Next →
            </Button>
            <span className="ml-2 text-sm font-medium">
              Week of{' '}
              {weekStart.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Empty state */}
      {!loading && staff.length === 0 && !error && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-muted-foreground">
              No staff members yet.{' '}
              <Link href="/staff" className="underline text-foreground">
                Add staff
              </Link>{' '}
              to see the roster.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Roster grid */}
      {(loading || staff.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium w-44 min-w-[11rem]">Staff</th>
                  {DAY_LABELS.map((label, i) => {
                    const date = weekDates[i];
                    const isPast = date < today;
                    const isToday = toIso(date) === toIso(today);
                    return (
                      <th
                        key={label}
                        className={cn(
                          'text-center px-2 py-2 font-medium',
                          isToday && 'bg-accent/50',
                          isPast && 'opacity-50',
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
                      const isPast = date < today;
                      const count = countWorking(date);
                      return (
                        <td
                          key={i}
                          className={cn(
                            'text-center px-2 py-1.5',
                            isPast && 'opacity-50',
                          )}
                        >
                          <span className="text-xs font-semibold text-muted-foreground">
                            {count} / {staff.length}
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
                      <tr key={member.id} className="border-b hover:bg-muted/10">
                        {/* Staff name cell */}
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                              {member.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={member.avatarUrl}
                                  alt={member.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (member.displayName ?? member.name).charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-medium truncate max-w-[7rem]">
                              {member.displayName ?? member.name}
                            </span>
                          </div>
                        </td>

                        {/* Day cells */}
                        {weekDates.map((date, i) => {
                          const dateStr = toIso(date);
                          const wd = jsWeekday(date);
                          const isPast = date < today;
                          const overlappingTimeOff = member.timeOff.filter((t) =>
                            inRange(dateStr, t.start, t.end),
                          );
                          const workingHour = member.workingHours.find(
                            (wh) => wh.weekday === wd,
                          );
                          const onTimeOff = overlappingTimeOff.length > 0;

                          return (
                            <td
                              key={i}
                              className={cn(
                                'px-2 py-2 text-center',
                                isPast ? 'opacity-50' : 'cursor-pointer hover:bg-accent/20',
                              )}
                              onClick={() => handleCellClick(member, date)}
                            >
                              {onTimeOff ? (
                                <Badge
                                  variant="destructive"
                                  className="text-xs px-1.5 py-0"
                                >
                                  Off
                                </Badge>
                              ) : workingHour ? (
                                <Badge
                                  variant="default"
                                  className="text-xs px-1.5 py-0 bg-green-600 hover:bg-green-700"
                                >
                                  {workingHour.startTime}–{workingHour.endTime}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">–</span>
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
          token={token}
          staff={sheetStaff}
          date={sheetDate}
          onClose={closeSheet}
          onRefresh={onRosterRefresh}
        />
      )}
    </div>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

interface DetailSheetProps {
  token: string;
  staff: StaffMember;
  date: Date;
  onClose: () => void;
  onRefresh: () => void;
}

function DetailSheet({ token, staff, date, onClose, onRefresh }: DetailSheetProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = addDays(today, 180);

  const dateStr = toIso(date);
  const wd = jsWeekday(date);

  const recurringHour = staff.workingHours.find((wh) => wh.weekday === wd);
  const overlappingTimeOff = staff.timeOff.filter((t) => inRange(dateStr, t.start, t.end));

  const [addStart, setAddStart] = useState(dateStr);
  const [addEnd, setAddEnd] = useState(dateStr);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  async function handleAddTimeOff() {
    if (addStart > addEnd) {
      setFormError('Start date must be on or before end date.');
      return;
    }
    const diffDays =
      (new Date(addEnd).getTime() - new Date(addStart).getTime()) / 86_400_000;
    if (diffDays > 180) {
      setFormError('Range cannot exceed 180 days.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch(
        `/staff/${staff.id}/time-off`,
        {
          method: 'POST',
          body: JSON.stringify({ start: addStart, end: addEnd, reason: reason || undefined }),
        },
        token,
      );
      onRefresh();
      onClose();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to add time off');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTimeOff(timeOffId: string) {
    setDeletingId(timeOffId);
    try {
      await apiFetch(
        `/staff/${staff.id}/time-off/${timeOffId}`,
        { method: 'DELETE' },
        token,
      );
      onRefresh();
      onClose();
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
          <SheetTitle>
            {staff.displayName ?? staff.name}
          </SheetTitle>
          <SheetDescription>
            {fmtShort(date)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Recurring schedule */}
          <div>
            <h4 className="text-sm font-semibold mb-1">Recurring schedule ({DAY_NAMES[wd]})</h4>
            {recurringHour ? (
              <p className="text-sm text-muted-foreground">
                {recurringHour.startTime} – {recurringHour.endTime}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not scheduled this day</p>
            )}
          </div>

          {/* Existing time-off */}
          {overlappingTimeOff.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Time off covering this date</h4>
              <div className="space-y-2">
                {overlappingTimeOff.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <div>
                      <p>
                        {t.start} → {t.end}
                      </p>
                      {t.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t.reason}</p>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 h-7 px-2 text-xs"
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

          {/* Add time-off form */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Add time off</h4>

            <div className="space-y-1">
              <Label htmlFor="to-start">Start date</Label>
              <Input
                id="to-start"
                type="date"
                value={addStart}
                min={toIso(today)}
                max={toIso(maxDate)}
                onChange={(e) => setAddStart(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="to-end">End date</Label>
              <Input
                id="to-end"
                type="date"
                value={addEnd}
                min={addStart || toIso(today)}
                max={toIso(maxDate)}
                onChange={(e) => setAddEnd(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="to-reason">Reason (optional)</Label>
              <textarea
                id="to-reason"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[70px] resize-none"
                placeholder="e.g. Annual leave, sick day…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleAddTimeOff} disabled={submitting}>
            {submitting ? 'Saving…' : 'Add time off'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
