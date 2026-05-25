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

export function StepWhatsApp({ data, updateData, onNext, onBack }: Props) {
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    // Simulated verification — in production this would call the Meta API
    await new Promise((r) => setTimeout(r, 1500));
    updateData({ whatsappVerified: true });
    setVerifying(false);
  }

  const canProceed = data.whatsappNumber.length >= 10;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">WhatsApp Business Number</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This is the number your clients will message to book appointments.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatsappNumber">Phone Number (E.164 format)</Label>
          <Input
            id="whatsappNumber"
            placeholder="+27 81 234 5678"
            value={data.whatsappNumber}
            onChange={(e) => updateData({ whatsappNumber: e.target.value, whatsappVerified: false })}
          />
          <p className="text-xs text-muted-foreground">
            Include country code. This must be a WhatsApp Business API registered number.
          </p>
        </div>

        {canProceed && !data.whatsappVerified && (
          <Button
            variant="outline"
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? 'Verifying...' : 'Verify Number'}
          </Button>
        )}

        {data.whatsappVerified && (
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Number verified
          </div>
        )}

        <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Need help?</p>
          <p>You can set up WhatsApp Business API through Meta Business Manager or use our Twilio sandbox for testing.</p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!canProceed}>
          {data.whatsappVerified ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
