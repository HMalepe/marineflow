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

export function StepBot({ data, updateData, onNext, onBack }: Props) {
  const botName = data.botName ?? 'Ava';
  const formality = data.toneFormality ?? 50;
  const warmth = data.toneWarmth ?? 70;
  const playfulness = data.tonePlayfulness ?? 40;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Bot Personality</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Give your booking assistant a name and personality that matches your brand.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="botName">Bot Name</Label>
          <Input
            id="botName"
            placeholder="e.g. Ava, Max, Luna"
            value={botName}
            onChange={(e) => updateData({ botName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            This name appears in greetings: &quot;Hi! I&apos;m {botName || '...'}, your booking assistant.&quot;
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
            &quot;{getPreviewGreeting(botName, formality, warmth)}&quot;
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

function getPreviewGreeting(name: string, formality: number, warmth: number): string {
  const n = name || 'Ava';
  if (formality > 70 && warmth < 40) {
    return `Good day. I'm ${n}, your appointment coordinator. How may I assist you?`;
  }
  if (warmth > 70) {
    return `Hey there! 👋 I'm ${n}, your friendly booking buddy! How can I help you today?`;
  }
  return `Hi! I'm ${n}, your booking assistant at ${'{salon}'}. Reply with a number to get started!`;
}
