'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardData, StaffEntry } from '../page';

interface Props {
  data: WizardData;
  updateData: (d: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const EMPTY_STAFF: StaffEntry = { name: '', email: '', role: 'STYLIST', specialties: [] };

const ROLES = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STYLIST', label: 'Stylist' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
];

export function StepStaff({ data, updateData, onNext, onBack }: Props) {
  const [current, setCurrent] = useState<StaffEntry>(EMPTY_STAFF);
  const [specialtyInput, setSpecialtyInput] = useState('');

  function addStaff() {
    if (!current.name.trim()) return;
    updateData({ staff: [...data.staff, { ...current, name: current.name.trim() }] });
    setCurrent(EMPTY_STAFF);
    setSpecialtyInput('');
  }

  function removeStaff(idx: number) {
    updateData({ staff: data.staff.filter((_, i) => i !== idx) });
  }

  function addSpecialty() {
    if (!specialtyInput.trim()) return;
    setCurrent({ ...current, specialties: [...current.specialties, specialtyInput.trim()] });
    setSpecialtyInput('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your Team</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add your staff members. They&apos;ll appear as booking options for clients.
        </p>
      </div>

      {data.staff.length > 0 && (
        <div className="space-y-2">
          {data.staff.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.role}{s.specialties.length > 0 && ` · ${s.specialties.join(', ')}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeStaff(i)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md p-4 space-y-3">
        <p className="text-sm font-medium">Add a team member</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input
              placeholder="e.g. Sarah"
              value={current.name}
              onChange={(e) => setCurrent({ ...current, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              placeholder="sarah@salon.com"
              value={current.email}
              onChange={(e) => setCurrent({ ...current, email: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setCurrent({ ...current, role: r.value })}
                className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
                  current.role === r.value
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Specialties</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Balayage"
              value={specialtyInput}
              onChange={(e) => setSpecialtyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
            />
            <Button variant="outline" size="sm" onClick={addSpecialty} type="button">
              Add
            </Button>
          </div>
          {current.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {current.specialties.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">{s}</span>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={addStaff} disabled={!current.name.trim()}>
          + Add Staff Member
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>
          {data.staff.length > 0 ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
