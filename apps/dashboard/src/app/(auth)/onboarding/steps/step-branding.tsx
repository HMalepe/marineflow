'use client';

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

const PRESET_COLORS = [
  '#0f172a', '#1e40af', '#7c3aed', '#be185d',
  '#059669', '#d97706', '#dc2626', '#4f46e5',
];

export function StepBranding({ data, updateData, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Brand Identity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose your brand color — it&apos;ll style your booking links and bot messages.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Brand Color</Label>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateData({ brandColor: color })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    data.brandColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Input
              type="color"
              value={data.brandColor}
              onChange={(e) => updateData({ brandColor: e.target.value })}
              className="w-10 h-10 p-1 cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL (optional)</Label>
          <Input
            id="logoUrl"
            placeholder="https://your-cdn.com/logo.png"
            value={data.logoUrl}
            onChange={(e) => updateData({ logoUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            You can add this later from Settings.
          </p>
        </div>

        <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: data.brandColor }}>
          <p className="text-sm font-medium" style={{ color: data.brandColor }}>
            Preview: {data.businessName || 'Your Salon'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This is how your brand color will look.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
