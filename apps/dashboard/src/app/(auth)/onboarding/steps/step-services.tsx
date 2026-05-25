'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardData, ServiceEntry } from '../page';

interface Props {
  data: WizardData;
  updateData: (d: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const EMPTY_SERVICE: ServiceEntry = { name: '', durationMin: 60, priceCents: 0, category: '' };

export function StepServices({ data, updateData, onNext, onBack }: Props) {
  const [current, setCurrent] = useState<ServiceEntry>(EMPTY_SERVICE);

  function addService() {
    if (!current.name.trim()) return;
    updateData({ services: [...data.services, { ...current, name: current.name.trim() }] });
    setCurrent(EMPTY_SERVICE);
  }

  function removeService(idx: number) {
    updateData({ services: data.services.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your Services</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add the services you offer. Clients will choose from these when booking.
        </p>
      </div>

      {data.services.length > 0 && (
        <div className="space-y-2">
          {data.services.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.durationMin}min · R{(s.priceCents / 100).toFixed(0)}
                  {s.category && ` · ${s.category}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeService(i)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md p-4 space-y-3">
        <p className="text-sm font-medium">Add a service</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input
              placeholder="e.g. Blowdry"
              value={current.name}
              onChange={(e) => setCurrent({ ...current, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Input
              placeholder="e.g. Hair"
              value={current.category}
              onChange={(e) => setCurrent({ ...current, category: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Duration (min)</Label>
            <Input
              type="number"
              min={5}
              step={5}
              value={current.durationMin}
              onChange={(e) => setCurrent({ ...current, durationMin: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Price (ZAR)</Label>
            <Input
              type="number"
              min={0}
              step={10}
              value={current.priceCents / 100}
              onChange={(e) => setCurrent({ ...current, priceCents: Number(e.target.value) * 100 })}
            />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={addService} disabled={!current.name.trim()}>
          + Add Service
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>
          {data.services.length > 0 ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
