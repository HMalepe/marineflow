'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PLATFORM_BOT_NAME } from '@/lib/bot-branding';
import type { WizardData } from '../page';

interface Props {
  data: WizardData;
  updateData: (d: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBot({ data, updateData, onNext, onBack }: Props) {
  const formality = data.toneFormality ?? 50;
  const warmth = data.toneWarmth ?? 70;
  const playfulness = data.tonePlayfulness ?? 40;
  const businessName = data.businessName.trim() || 'your business';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Bot Personality</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tune how {PLATFORM_BOT_NAME}, your MarineFlow booking assistant, sounds when talking to customers.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">Assistant name</p>
          <p className="text-muted-foreground mt-1">
            Customers meet <span className="font-medium text-foreground">{PLATFORM_BOT_NAME}</span> — MarineFlow&apos;s
            branded assistant. Your business name ({businessName}) appears in welcome messages and menus.
          </p>
        </div>

        <div className="space-y-4">
          <ToneSlider
            label="Formality"
            low="Casual"
            high="Professional"
            value={formality}
            onChange={(v) => updateData({ toneFormality: v })}
          />
          <ToneSlider
            label="Warmth"
            low="Neutral"
            high="Warm & Friendly"
            value={warmth}
            onChange={(v) => updateData({ toneWarmth: v })}
          />
          <ToneSlider
            label="Playfulness"
            low="Serious"
            high="Fun & Playful"
            value={playfulness}
            onChange={(v) => updateData({ tonePlayfulness: v })}
          />
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-xs font-medium">Preview greeting:</p>
          <p className="text-sm italic text-muted-foreground">
            &quot;{getPreviewGreeting(businessName, formality, warmth)}&quot;
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

function ToneSlider({
  label, low, high, value, onChange,
}: {
  label: string; low: string; high: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function getPreviewGreeting(businessName: string, formality: number, warmth: number): string {
  const salon = businessName || 'your business';
  if (formality > 70 && warmth < 40) {
    return `Good day. I'm ${PLATFORM_BOT_NAME}, your appointment coordinator at ${salon}. How may I assist you?`;
  }
  if (warmth > 70) {
    return `Hey there! 👋 I'm ${PLATFORM_BOT_NAME}, your friendly booking buddy at ${salon}! How can I help you today?`;
  }
  return `Hi! I'm ${PLATFORM_BOT_NAME}, your booking assistant at ${salon}. Reply with a number to get started!`;
}
