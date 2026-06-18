'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PLATFORM_BOT_NAME } from '@/lib/bot-branding';
import type { WizardData } from '../page';

interface Props {
  data: WizardData;
  onBack: () => void;
}

export function StepGoLive({ data, onBack }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const checks = [
    { label: 'Business info', ok: !!data.businessName },
    { label: 'Brand color set', ok: !!data.brandColor },
    { label: 'WhatsApp number', ok: data.whatsappNumber.length >= 10 },
    { label: 'At least 1 service', ok: data.services.length > 0 },
    { label: 'At least 1 staff member', ok: data.staff.length > 0 },
  ];

  const allGood = checks.every((c) => c.ok);

  async function handleGoLive() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setDone(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold">You&apos;re live!</h2>
        <p className="text-muted-foreground">
          Your bot is ready to receive bookings. Send a WhatsApp message to your number to test it.
        </p>
        <a href="/">
          <Button className="mt-4">Go to Dashboard</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Ready to Go Live</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your setup before activating your booking bot.
        </p>
      </div>

      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3 py-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
              c.ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {c.ok ? '✓' : '✗'}
            </div>
            <span className="text-sm">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm font-medium mb-2">Summary</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Business: <span className="text-foreground">{data.businessName || '—'}</span></div>
          <div>Assistant: <span className="text-foreground">{PLATFORM_BOT_NAME}</span></div>
          <div>Services: <span className="text-foreground">{data.services.length}</span></div>
          <div>Staff: <span className="text-foreground">{data.staff.length}</span></div>
          <div>FAQs: <span className="text-foreground">{data.faqs?.length ?? 0}</span></div>
          <div>WhatsApp: <span className="text-foreground">{data.whatsappNumber || '—'}</span></div>
        </div>
      </div>

      {!allGood && (
        <p className="text-sm text-amber-600">
          Some items are incomplete. You can still go live and finish setup later.
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={handleGoLive} disabled={submitting}>
          {submitting ? 'Activating...' : '🚀 Go Live'}
        </Button>
      </div>
    </div>
  );
}
