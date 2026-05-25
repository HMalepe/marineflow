'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardData } from '../page';

interface Props {
  data: WizardData;
  updateData: (d: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DayHours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

const DEFAULT_HOURS: DayHours[] = DAYS.map((day) => ({
  day,
  open: '09:00',
  close: '17:00',
  closed: day === 'Sunday',
}));

export function StepHours({ data, updateData, onNext, onBack }: Props) {
  const [hours, setHours] = useState<DayHours[]>(data.hours ?? DEFAULT_HOURS);

  function updateDay(idx: number, patch: Partial<DayHours>) {
    const updated = hours.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    setHours(updated);
    updateData({ hours: updated });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Working Hours</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set your weekly schedule. Clients can only book during these hours.
        </p>
      </div>

      <div className="space-y-2">
        {hours.map((h, i) => (
          <div key={h.day} className="flex items-center gap-3 py-2">
            <div className="w-24 text-sm font-medium">{h.day}</div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!h.closed}
                onChange={(e) => updateDay(i, { closed: !e.target.checked })}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">Open</span>
            </label>
            {!h.closed && (
              <>
                <Input
                  type="time"
                  value={h.open}
                  onChange={(e) => updateDay(i, { open: e.target.value })}
                  className="w-28 text-sm"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="time"
                  value={h.close}
                  onChange={(e) => updateDay(i, { close: e.target.value })}
                  className="w-28 text-sm"
                />
              </>
            )}
            {h.closed && <span className="text-xs text-muted-foreground">Closed</span>}
          </div>
        ))}
      </div>

      <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
        <Label className="text-xs font-medium">Tip:</Label> You can set per-staff hours later from the Staff page.
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
