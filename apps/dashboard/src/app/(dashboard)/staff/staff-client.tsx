'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkingHour {
  id: string;
  weekday: number; // 0=Sun … 6=Sat
  startTime: string; // HH:MM
  endTime: string;
}

export interface TimeOff {
  id: string;
  start: string;
  end: string;
  reason: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  displayName: string | null;
  bio: string | null;
  role?: string;
  email?: string;
  specialties: string[];
  avatarUrl: string | null;
  active: boolean;
  isBookable: boolean;
  sortOrder: number;
  workingHours: WorkingHour[];
  timeOff: TimeOff[];
  _count?: { appointments: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_AVATAR_BYTES = 450_000;

const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { weekday: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
  { weekday: 1, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 2, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 3, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 4, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 5, enabled: true,  startTime: '09:00', endTime: '17:00' },
  { weekday: 6, enabled: false, startTime: '09:00', endTime: '17:00' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ScheduleDay {
  weekday: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function workingHoursToSchedule(hours: WorkingHour[]): ScheduleDay[] {
  return DEFAULT_SCHEDULE.map((d) => {
    const match = hours.find((h) => h.weekday === d.weekday);
    return match
      ? { weekday: d.weekday, enabled: true, startTime: match.startTime, endTime: match.endTime }
      : { ...d, enabled: false };
  });
}

function scheduleToPayload(schedule: ScheduleDay[]) {
  return schedule
    .filter((d) => d.enabled)
    .map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
}

function isOnTimeOff(member: StaffMember): boolean {
  const now = new Date();
  return member.timeOff.some((t) => new Date(t.start) <= now && new Date(t.end) >= now);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Local YYYY-MM-DD without timezone shift
function localDateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// Send date boundaries in UTC so server/client always agree on the day
function dateToUtcStart(ymd: string) { return ymd + 'T00:00:00.000Z'; }
function dateToUtcEnd(ymd: string)   { return ymd + 'T23:59:59.999Z'; }

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'bg-primary' : 'bg-muted-foreground/25',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-4 max-w-sm',
        type === 'success'
          ? 'bg-card border-green-600/30 text-foreground'
          : 'bg-destructive/10 border-destructive/40 text-destructive',
      )}
    >
      {type === 'success' ? (
        <Badge className="bg-green-600/15 text-green-700 dark:text-green-400 border-0 shrink-0">Saved</Badge>
      ) : (
        <Badge variant="destructive" className="shrink-0">Error</Badge>
      )}
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground text-xs ml-1" aria-label="Dismiss">✕</button>
    </div>
  );
}

// ─── Avatar display ───────────────────────────────────────────────────────────

function Avatar({ member, size = 'md' }: { member: StaffMember; size?: 'sm' | 'md' | 'lg' }) {
  const label = (member.displayName || member.name)
    .split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
  const sizeClass = size === 'lg' ? 'size-16' : size === 'sm' ? 'size-9' : 'size-12';
  const textClass = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-xs' : 'text-base';
  return (
    <div className={cn('relative shrink-0', sizeClass)}>
      <div className={cn('rounded-2xl overflow-hidden bg-muted border-2 border-background shadow-sm flex items-center justify-center', sizeClass)}>
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatarUrl} alt={member.name} className="size-full object-cover" />
        ) : (
          <span className={cn('font-bold text-muted-foreground select-none', textClass)}>{label}</span>
        )}
      </div>
      {(member._count?.appointments ?? 0) > 0 && (
        <span
          title={`${member._count!.appointments} confirmed bookings via WhatsApp`}
          className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow border-2 border-background tabular-nums"
        >
          {member._count!.appointments > 999 ? '999+' : member._count!.appointments}
        </span>
      )}
    </div>
  );
}

// ─── Avatar uploader ──────────────────────────────────────────────────────────

function AvatarUploader({
  current,
  name,
  onChange,
}: {
  current: string | null;
  name: string;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [error, setError] = useState<string | null>(null);

  // Sync when a different staff member is loaded into the form
  useEffect(() => {
    setPreview(current);
    setError(null);
  }, [current]);

  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > MAX_AVATAR_BYTES) { setError('Image must be under 450 KB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setPreview(url);
      onChange(url);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative size-16 rounded-2xl border-2 border-dashed overflow-hidden shrink-0 transition-colors',
          'hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          preview ? 'border-transparent' : 'border-muted-foreground/30 bg-muted/50',
        )}
        aria-label="Upload photo"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={name} className="size-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-muted-foreground">{initials || '?'}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
          <svg className="size-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </span>
      </button>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP · max 450 KB</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            {preview ? 'Change' : 'Upload photo'}
          </Button>
          {preview && (
            <Button
              type="button" size="sm" variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => { setPreview(null); onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            >
              Remove
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Schedule editor ──────────────────────────────────────────────────────────

function ScheduleEditor({ schedule, onChange }: { schedule: ScheduleDay[]; onChange: (s: ScheduleDay[]) => void }) {
  function toggle(weekday: number) {
    onChange(schedule.map((d) => d.weekday === weekday ? { ...d, enabled: !d.enabled } : d));
  }
  function setTime(weekday: number, field: 'startTime' | 'endTime', value: string) {
    onChange(schedule.map((d) => d.weekday === weekday ? { ...d, [field]: value } : d));
  }

  return (
    <div className="space-y-1.5">
      {schedule.map((day) => (
        <div
          key={day.weekday}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors',
            day.enabled ? 'bg-muted/30 border-border' : 'bg-transparent border-border/50 opacity-60',
          )}
        >
          <Toggle on={day.enabled} onToggle={() => toggle(day.weekday)} />
          <span className={cn('w-9 text-xs font-semibold shrink-0', day.enabled ? 'text-foreground' : 'text-muted-foreground')}>
            {DAYS[day.weekday]}
          </span>
          {day.enabled ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="time"
                value={day.startTime}
                onChange={(e) => setTime(day.weekday, 'startTime', e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground shrink-0">–</span>
              <input
                type="time"
                value={day.endTime}
                onChange={(e) => setTime(day.weekday, 'endTime', e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground flex-1">Day off</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Staff card ───────────────────────────────────────────────────────────────

function StaffCard({
  member,
  onEdit,
  onSchedule,
  onTimeOff,
  onToggleActive,
  busy,
}: {
  member: StaffMember;
  onEdit: (m: StaffMember) => void;
  onSchedule: (m: StaffMember) => void;
  onTimeOff: (m: StaffMember) => void;
  onToggleActive: (m: StaffMember) => void;
  busy: boolean;
}) {
  const onLeave = isOnTimeOff(member);
  const displayName = member.displayName || member.name;
  const hasSchedule = member.workingHours.length > 0;

  return (
    <div
      className={cn(
        'group rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md',
        !member.active && 'opacity-50 grayscale',
        member.active && onLeave && 'opacity-60 grayscale',
      )}
    >
      <div className="p-4 flex gap-4">
        <Avatar member={member} size="lg" />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Name + status */}
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
              {member.displayName && member.displayName !== member.name && (
                <p className="text-[11px] text-muted-foreground leading-tight">{member.name}</p>
              )}
              {member.bio && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{member.bio}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-1 shrink-0">
              {!member.active && (
                <Badge variant="secondary" className="text-[10px] py-0">Inactive</Badge>
              )}
              {member.active && onLeave && (
                <Badge className="text-[10px] py-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">On leave</Badge>
              )}
              {member.active && !onLeave && !member.isBookable && (
                <Badge variant="outline" className="text-[10px] py-0">Not bookable</Badge>
              )}
              {member.active && !onLeave && member.isBookable && (
                <Badge className="text-[10px] py-0 bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30">Available</Badge>
              )}
            </div>
          </div>

          {/* Specialties */}
          {member.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {member.specialties.map((s) => (
                <span key={s} className="text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{s}</span>
              ))}
            </div>
          )}

          {/* Weekly schedule strip */}
          {hasSchedule ? (
            <div className="flex gap-0.5">
              {DAYS.map((d, i) => {
                const wh = member.workingHours.find((h) => h.weekday === i);
                return (
                  <span
                    key={d}
                    title={wh ? `${d}: ${wh.startTime} – ${wh.endTime}` : `${d}: day off`}
                    className={cn(
                      'text-[10px] font-semibold flex-1 text-center rounded-md py-0.5',
                      wh ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground/30',
                    )}
                  >
                    {d[0]}
                  </span>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSchedule(member)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
            >
              <span className="text-base leading-none">＋</span> Set weekly schedule
            </button>
          )}

          {/* Action row */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onEdit(member)}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onSchedule(member)}>
              Schedule
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onTimeOff(member)}>
              Time off
            </Button>
            <Button
              type="button" size="sm" variant="ghost" disabled={busy}
              className={cn(
                'transition-opacity',
                'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                member.active ? 'text-muted-foreground hover:text-destructive' : 'text-primary hover:text-primary',
              )}
              onClick={() => onToggleActive(member)}
            >
              {member.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialStaff: StaffMember[];
  token: string;
}

type SheetMode = 'edit' | 'schedule' | 'timeoff' | null;

export function StaffClient({ initialStaff, token }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [selected, setSelected] = useState<StaffMember | null>(null);

  const [editForm, setEditForm] = useState({
    name: '', displayName: '', bio: '', specialties: '', isBookable: true, avatarUrl: null as string | null,
  });

  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [loadingTimeOff, setLoadingTimeOff] = useState(false);
  const [newTimeOff, setNewTimeOff] = useState({
    start: localDateStr(new Date()),
    end: localDateStr(new Date(Date.now() + 86400000)),
    reason: '',
  });
  const [addingTimeOff, setAddingTimeOff] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ staff: StaffMember[] }>('/staff', {}, token);
      setStaff(data.staff ?? []);
    } catch {
      showToast('Failed to refresh staff list', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  function openEdit(member: StaffMember) {
    setSelected(member);
    setDeleteConfirm(false);
    setEditForm({
      name: member.name,
      displayName: member.displayName ?? '',
      bio: member.bio ?? '',
      specialties: member.specialties.join(', '),
      isBookable: member.isBookable,
      avatarUrl: member.avatarUrl,
    });
    setSheetMode('edit');
  }

  function openAddNew() {
    setSelected(null);
    setDeleteConfirm(false);
    setEditForm({ name: '', displayName: '', bio: '', specialties: '', isBookable: true, avatarUrl: null });
    setSheetMode('edit');
  }

  function openSchedule(member: StaffMember) {
    setSelected(member);
    setSchedule(workingHoursToSchedule(member.workingHours));
    setSheetMode('schedule');
  }

  async function openTimeOff(member: StaffMember) {
    setSelected(member);
    setSheetMode('timeoff');
    setLoadingTimeOff(true);
    try {
      const data = await apiFetch<{ timeOff: TimeOff[] }>(`/staff/${member.id}/time-off`, {}, token);
      setTimeOffs(data.timeOff ?? []);
    } catch {
      setTimeOffs(member.timeOff ?? []);
    } finally {
      setLoadingTimeOff(false);
    }
  }

  function closeSheet() {
    setSheetMode(null);
    setSelected(null);
    setDeleteConfirm(false);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim()) { showToast('Name is required', 'error'); return; }
    setBusyId(selected?.id ?? '__new__');
    try {
      const payload = {
        name: editForm.name.trim(),
        displayName: editForm.displayName.trim() || null,
        bio: editForm.bio.trim() || null,
        specialties: editForm.specialties.split(',').map((s) => s.trim()).filter(Boolean),
        isBookable: editForm.isBookable,
        avatarUrl: editForm.avatarUrl,
      };
      if (selected) {
        await apiFetch(`/staff/${selected.id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);
        showToast('Staff member updated', 'success');
      } else {
        await apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) }, token);
        showToast('Staff member added', 'success');
      }
      closeSheet();
      await reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteStaff() {
    if (!selected) return;
    setBusyId(selected.id);
    try {
      await apiFetch(`/staff/${selected.id}`, { method: 'DELETE' }, token);
      showToast('Staff member removed', 'success');
      closeSheet();
      await reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveSchedule() {
    if (!selected) return;
    const invalid = schedule.find((d) => d.enabled && d.startTime >= d.endTime);
    if (invalid) {
      showToast(`End time must be after start time (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][invalid.weekday]})`, 'error');
      return;
    }
    setSavingSchedule(true);
    try {
      const hours = scheduleToPayload(schedule);
      await apiFetch(
        `/staff/${selected.id}/working-hours`,
        { method: 'PUT', body: JSON.stringify({ hours }) },
        token,
      );
      showToast('Schedule saved', 'success');
      closeSheet();
      await reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleAddTimeOff(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAddingTimeOff(true);
    try {
      const payload = {
        // Use UTC midnight / end-of-day so date boundaries never drift with timezone
        start: dateToUtcStart(newTimeOff.start),
        end: dateToUtcEnd(newTimeOff.end),
        reason: newTimeOff.reason.trim() || null,
      };
      const data = await apiFetch<{ timeOff: TimeOff }>(
        `/staff/${selected.id}/time-off`,
        { method: 'POST', body: JSON.stringify(payload) },
        token,
      );
      setTimeOffs((prev) =>
        [...prev, data.timeOff].sort((a, b) => a.start.localeCompare(b.start)),
      );
      setNewTimeOff({
        start: localDateStr(new Date()),
        end: localDateStr(new Date(Date.now() + 86400000)),
        reason: '',
      });
      showToast('Time off added', 'success');
      await reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to add time off', 'error');
    } finally {
      setAddingTimeOff(false);
    }
  }

  async function handleDeleteTimeOff(timeOffId: string) {
    if (!selected) return;
    try {
      await apiFetch(`/staff/${selected.id}/time-off/${timeOffId}`, { method: 'DELETE' }, token);
      setTimeOffs((prev) => prev.filter((t) => t.id !== timeOffId));
      showToast('Time off removed', 'success');
      await reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to remove', 'error');
    }
  }

  async function handleToggleActive(member: StaffMember) {
    setBusyId(member.id);
    try {
      await apiFetch(
        `/staff/${member.id}`,
        { method: 'PATCH', body: JSON.stringify({ active: !member.active }) },
        token,
      );
      showToast(member.active ? 'Staff member deactivated' : 'Staff member reactivated', 'success');
      await reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const active = staff.filter((s) => s.active);
  const inactive = staff.filter((s) => !s.active);
  const totalBookings = staff.reduce((n, s) => n + (s._count?.appointments ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {active.length} active member{active.length !== 1 ? 's' : ''}
            {totalBookings > 0 && ` · ${totalBookings.toLocaleString()} bookings via WhatsApp`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button onClick={openAddNew}>Add staff member</Button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex size-4 rounded-full bg-primary items-center justify-center text-[9px] text-primary-foreground font-bold">9</span>
          WhatsApp bookings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-green-500 inline-block" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500 inline-block" />
          On leave — card greyed out
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/30 inline-block" />
          Inactive — greyed out
        </span>
      </div>

      {/* ── Active staff ── */}
      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Active · {active.length}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((m) => (
              <StaffCard
                key={m.id}
                member={m}
                onEdit={openEdit}
                onSchedule={openSchedule}
                onTimeOff={(mem) => void openTimeOff(mem)}
                onToggleActive={(mem) => void handleToggleActive(mem)}
                busy={busyId === m.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Inactive staff ── */}
      {inactive.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Inactive · {inactive.length}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {inactive.map((m) => (
              <StaffCard
                key={m.id}
                member={m}
                onEdit={openEdit}
                onSchedule={openSchedule}
                onTimeOff={(mem) => void openTimeOff(mem)}
                onToggleActive={(mem) => void handleToggleActive(mem)}
                busy={busyId === m.id}
              />
            ))}
          </div>
        </section>
      )}

      {staff.length === 0 && !loading && (
        <div className="text-center py-20 rounded-2xl border-2 border-dashed border-border">
          <p className="text-2xl mb-2">👩‍💼</p>
          <p className="font-semibold text-sm">No staff members yet</p>
          <p className="text-muted-foreground text-xs mt-1 mb-4">
            Add your stylists, therapists, and team members here.
          </p>
          <Button onClick={openAddNew}>Add first staff member</Button>
        </div>
      )}

      {/* ══ Edit / Add Sheet ══ */}
      <Sheet open={sheetMode === 'edit'} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected ? 'Edit staff member' : 'Add staff member'}</SheetTitle>
            <SheetDescription>
              {selected
                ? 'Update profile details and photo.'
                : 'Add a new stylist, therapist, or team member.'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void handleSaveEdit(e)} className="flex flex-col gap-5 px-4 pb-4">
            <AvatarUploader
              current={editForm.avatarUrl}
              name={editForm.displayName || editForm.name || 'Staff'}
              onChange={(url) => setEditForm((f) => ({ ...f, avatarUrl: url }))}
            />

            <div className="space-y-2">
              <Label htmlFor="staff-name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="staff-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Zanele Dlamini"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-display">
                Display name <span className="text-muted-foreground text-xs font-normal">(nickname shown to customers)</span>
              </Label>
              <Input
                id="staff-display"
                value={editForm.displayName}
                onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="e.g. Zee"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-bio">Bio / title</Label>
              <Input
                id="staff-bio"
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="e.g. Senior Stylist · 8 years experience"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-specialties">Specialties</Label>
              <Input
                id="staff-specialties"
                value={editForm.specialties}
                onChange={(e) => setEditForm((f) => ({ ...f, specialties: e.target.value }))}
                placeholder="Braids, Relaxers, Natural Hair"
              />
              <p className="text-xs text-muted-foreground">Comma-separated — shown as tags on the card.</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 gap-4">
              <div>
                <p className="text-sm font-medium">Bookable via WhatsApp</p>
                <p className="text-xs text-muted-foreground">Customers can request this team member when booking.</p>
              </div>
              <Toggle
                on={editForm.isBookable}
                onToggle={() => setEditForm((f) => ({ ...f, isBookable: !f.isBookable }))}
              />
            </div>

            {/* Delete zone — only for existing staff */}
            {selected && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="text-xs font-medium text-destructive">Danger zone</p>
                {deleteConfirm ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      This permanently removes {selected.displayName || selected.name} and all their schedule data. This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button" size="sm" variant="destructive"
                        disabled={busyId !== null}
                        onClick={() => void handleDeleteStaff()}
                      >
                        {busyId !== null ? 'Deleting…' : 'Yes, delete'}
                      </Button>
                      <Button
                        type="button" size="sm" variant="outline"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button" size="sm" variant="outline"
                    className="text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    Remove staff member…
                  </Button>
                )}
              </div>
            )}

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
              <Button type="submit" disabled={busyId !== null}>
                {busyId !== null ? 'Saving…' : selected ? 'Save changes' : 'Add staff member'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* ══ Schedule Sheet ══ */}
      <Sheet open={sheetMode === 'schedule'} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Weekly schedule</SheetTitle>
            <SheetDescription>
              Set which days and hours {selected?.displayName || selected?.name} is available for bookings.
              The bot will only offer slots during these hours.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-4">
            {selected && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
                <Avatar member={selected} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{selected.displayName || selected.name}</p>
                  {selected.bio && <p className="text-xs text-muted-foreground">{selected.bio}</p>}
                </div>
              </div>
            )}

            <ScheduleEditor schedule={schedule} onChange={setSchedule} />

            <p className="text-xs text-muted-foreground leading-relaxed">
              Days toggled off will show as unavailable in the WhatsApp booking flow. Use the <strong>Time off</strong> sheet for temporary absence like sick days or leave.
            </p>

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
              <Button type="button" disabled={savingSchedule} onClick={() => void handleSaveSchedule()}>
                {savingSchedule ? 'Saving…' : 'Save schedule'}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ══ Time Off Sheet ══ */}
      <Sheet open={sheetMode === 'timeoff'} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Time off &amp; leave</SheetTitle>
            <SheetDescription>
              Schedule leave, sick days, or holidays for{' '}
              <strong>{selected?.displayName || selected?.name}</strong>.
              The card greys out and the slot becomes unavailable to customers on these dates.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-4">
            {selected && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
                <Avatar member={selected} size="sm" />
                <p className="text-sm font-semibold">{selected.displayName || selected.name}</p>
              </div>
            )}

            {/* Add form */}
            <form onSubmit={(e) => void handleAddTimeOff(e)} className="rounded-xl border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Add time off</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="to-start" className="text-xs">From</Label>
                  <input
                    id="to-start"
                    type="date"
                    value={newTimeOff.start}
                    onChange={(e) => setNewTimeOff((s) => ({ ...s, start: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to-end" className="text-xs">To</Label>
                  <input
                    id="to-end"
                    type="date"
                    value={newTimeOff.end}
                    min={newTimeOff.start}
                    onChange={(e) => setNewTimeOff((s) => ({ ...s, end: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-reason" className="text-xs">Reason (optional)</Label>
                <Input
                  id="to-reason"
                  value={newTimeOff.reason}
                  onChange={(e) => setNewTimeOff((s) => ({ ...s, reason: e.target.value }))}
                  placeholder="e.g. Annual leave, Sick day, Personal"
                />
              </div>
              <Button type="submit" size="sm" disabled={addingTimeOff} className="w-full">
                {addingTimeOff ? 'Adding…' : 'Add time off'}
              </Button>
            </form>

            {/* Existing list */}
            <div>
              <p className="text-sm font-semibold mb-2">Upcoming &amp; current</p>
              {loadingTimeOff && (
                <p className="text-xs text-muted-foreground py-3">Loading…</p>
              )}
              {!loadingTimeOff && timeOffs.length === 0 && (
                <p className="text-xs text-muted-foreground py-3">No time off scheduled.</p>
              )}
              <div className="space-y-2">
                {timeOffs.map((t) => {
                  const now = new Date();
                  const isNow = new Date(t.start) <= now && new Date(t.end) >= now;
                  const isPast = new Date(t.end) < now;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        'flex items-start justify-between gap-3 rounded-xl border p-3',
                        isNow && 'border-amber-500/40 bg-amber-500/5',
                        isPast && 'opacity-50',
                      )}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-medium leading-tight">
                          {formatDate(t.start)} – {formatDate(t.end)}
                        </p>
                        {t.reason && <p className="text-xs text-muted-foreground">{t.reason}</p>}
                        <div className="flex gap-1 pt-0.5">
                          {isNow && (
                            <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">Active now</Badge>
                          )}
                          {isPast && (
                            <Badge variant="outline" className="text-[10px]">Past</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button" size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => void handleDeleteTimeOff(t.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={closeSheet}>Done</Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
