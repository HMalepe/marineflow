'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
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

function formatE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+') && digits.startsWith('0')) {
    return '+27' + digits.slice(1);
  }
  return digits.startsWith('+') ? digits : '+' + digits;
}

export function StepWhatsApp({ data, updateData, onNext, onBack }: Props) {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const formatted = formatE164(data.whatsappNumber);
  const canVerify = /^\+\d{10,15}$/.test(formatted);

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      // Simulated — production calls Meta API to check number registration
      await new Promise((r) => setTimeout(r, 1800));
      if (!canVerify) throw new Error('Number format invalid');
      updateData({ whatsappNumber: formatted, whatsappVerified: true });
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : 'Could not verify number');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">WhatsApp Business Number</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Clients will message this number to book. It must be registered on the WhatsApp Business API.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatsappNumber">Phone Number</Label>
          <Input
            id="whatsappNumber"
            placeholder="+27 81 234 5678"
            value={data.whatsappNumber}
            onChange={(e) => updateData({ whatsappNumber: e.target.value, whatsappVerified: false })}
            className={data.whatsappVerified ? 'border-green-500 focus-visible:ring-green-500' : ''}
          />
          <p className="text-xs text-muted-foreground">
            Include country code — we'll format it automatically (e.g. 081 → +2781).
          </p>
        </div>

        {/* Verify button */}
        {!data.whatsappVerified && canVerify && (
          <Button variant="outline" onClick={handleVerify} disabled={verifying} className="gap-2">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {verifying ? 'Checking number…' : 'Verify Number'}
          </Button>
        )}

        {/* Error state */}
        {verifyError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Verification failed</p>
              <p className="text-xs mt-0.5 text-destructive/80">{verifyError}</p>
            </div>
          </div>
        )}

        {/* Success state */}
        {data.whatsappVerified && (
          <div className="flex items-center gap-2.5 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2.5 text-sm text-green-700 dark:text-green-400 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {formatted} is verified and ready to use
          </div>
        )}

        {/* Help box */}
        <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Need a WhatsApp Business API number?</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Register via <span className="font-medium text-foreground">Meta Business Manager</span> (free)</li>
            <li>Or use <span className="font-medium text-foreground">Twilio sandbox</span> for testing first</li>
          </ul>
          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
          >
            Meta setup guide <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!canVerify && !data.whatsappVerified}>
          {data.whatsappVerified ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
