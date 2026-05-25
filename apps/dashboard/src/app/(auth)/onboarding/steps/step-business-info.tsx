'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardData } from '../page';

interface Props {
  data: WizardData;
  updateData: (d: Partial<WizardData>) => void;
  onNext: () => void;
}

const BUSINESS_TYPES = [
  { value: 'salon', label: 'Hair Salon' },
  { value: 'barbershop', label: 'Barbershop' },
  { value: 'spa', label: 'Spa & Wellness' },
  { value: 'nails', label: 'Nail Studio' },
  { value: 'beauty', label: 'Beauty Clinic' },
  { value: 'other', label: 'Other' },
];

export function StepBusinessInfo({ data, updateData, onNext }: Props) {
  const canProceed = data.businessName.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Tell us about your business</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This information will be shown to your clients.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            placeholder="e.g. Glow & Go Salon"
            value={data.businessName}
            onChange={(e) => updateData({ businessName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tradingName">Trading / Display Name</Label>
          <Input
            id="tradingName"
            placeholder="Short name for WhatsApp (optional)"
            value={data.tradingName}
            onChange={(e) => updateData({ tradingName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use your business name.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Business Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {BUSINESS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => updateData({ businessType: t.value })}
                className={`px-3 py-2 rounded-md border text-sm text-left transition-colors ${
                  data.businessType === t.value
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  );
}
