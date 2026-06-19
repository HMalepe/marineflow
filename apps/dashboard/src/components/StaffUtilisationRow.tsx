'use client';

import { Badge } from '@/components/ui/badge';
import { StaffAvatar } from '@/components/staff-avatar';
import { cn } from '@/lib/utils';

export interface StaffUtilisationMember {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface StaffUtilisationData {
  staffId: string;
  bookedSlots: number;
  totalSlots: number;
  isIdle: boolean;
  isWorkingToday: boolean;
}

interface StaffUtilisationRowProps {
  staff: StaffUtilisationMember[];
  utilisation: StaffUtilisationData[];
  dateLabel?: string;
}

export function StaffUtilisationRow({ staff, utilisation, dateLabel = 'Today' }: StaffUtilisationRowProps) {
  const byId = new Map(utilisation.map((u) => [u.staffId, u]));

  if (staff.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{dateLabel}</h2>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Booked slots vs capacity
        </span>
      </div>

      <div className="space-y-2.5">
        {staff.map((s) => {
          const u = byId.get(s.id);
          const booked = u?.bookedSlots ?? 0;
          const total = u?.totalSlots ?? 0;
          const pct = total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
          const notWorking = !u?.isWorkingToday;

          return (
            <div key={s.id} className="flex items-center gap-3 min-w-0">
              <StaffAvatar
                name={s.name}
                displayName={s.displayName}
                avatarUrl={s.avatarUrl}
                size="xs"
                className="shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium truncate">{s.displayName ?? s.name}</span>
                  {u?.isIdle && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 text-muted-foreground">
                      Idle
                    </Badge>
                  )}
                  {notWorking && (
                    <span className="text-[10px] text-muted-foreground">Off today</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        notWorking ? 'bg-muted-foreground/20 w-0' : 'bg-blue-500',
                      )}
                      style={{ width: notWorking ? '0%' : `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 w-14 text-right">
                    {notWorking ? '—' : `${booked}/${total}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
