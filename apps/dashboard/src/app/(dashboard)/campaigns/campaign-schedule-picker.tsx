'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  value: string;
  onChange: (value: string) => void;
  minIso?: string;
}

function splitLocal(value: string): { date: string; time: string } {
  if (!value || !value.includes('T')) return { date: '', time: '' };
  const [date, time] = value.split('T');
  return { date: date ?? '', time: (time ?? '').slice(0, 5) };
}

function formatConfirmed(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CampaignSchedulePicker({ value, onChange, minIso }: Props) {
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { date, time } = splitLocal(value);

  const minDate = minIso?.split('T')[0] ?? '';
  const minTime = minIso && value.startsWith(minIso.split('T')[0] ?? '')
    ? (minIso.split('T')[1] ?? '').slice(0, 5)
    : undefined;

  useEffect(() => {
    const parts = splitLocal(value);
    setConfirmed(Boolean(parts.date && parts.time));
  }, [value]);

  function commit(nextDate: string, nextTime: string, dismiss = false) {
    if (!nextDate || !nextTime) {
      onChange(nextDate ? `${nextDate}T${nextTime || '09:00'}` : '');
      setConfirmed(false);
      return;
    }
    onChange(`${nextDate}T${nextTime}`);
    if (dismiss) {
      setConfirmed(true);
      dateRef.current?.blur();
      timeRef.current?.blur();
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="schedule-date">Send at</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          ref={dateRef}
          id="schedule-date"
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => {
            const nextDate = e.target.value;
            commit(nextDate, time || '09:00');
            if (nextDate && !time) {
              requestAnimationFrame(() => timeRef.current?.focus());
            } else if (nextDate && time) {
              commit(nextDate, time, true);
            }
          }}
        />
        <Input
          ref={timeRef}
          type="time"
          value={time}
          min={minTime}
          onChange={(e) => {
            const nextTime = e.target.value;
            if (date && nextTime) {
              commit(date, nextTime, true);
            } else {
              commit(date, nextTime);
            }
          }}
        />
      </div>
      {confirmed && value && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 shrink-0" />
          Confirmed: {formatConfirmed(value)}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Pick a date, then a time — the picker closes automatically once both are set.
        We check every 5 minutes, so delivery may begin up to 5 minutes after your chosen time.
      </p>
    </div>
  );
}
