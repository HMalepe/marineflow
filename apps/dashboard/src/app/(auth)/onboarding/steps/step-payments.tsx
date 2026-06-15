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

const PROVIDERS = [
  { id: 'stripe', label: 'Stripe', description: 'International cards' },
  { id: 'ozow', label: 'Ozow', description: 'SA instant EFT' },
  { id: 'payfast', label: 'PayFast', description: 'SA cards & EFT' },
  { id: 'none', label: 'Skip', description: 'Set up later' },
];

export function StepPayments({ data, updateData, onNext, onBack }: Props) {
  const provider = data.paymentProvider ?? 'none';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Payment Provider</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Accept full online payment for bookings. You can configure providers later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => updateData({ paymentProvider: p.id })}
            className={`p-4 rounded-lg border text-left transition-colors ${
              provider === p.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">{p.description}</p>
          </button>
        ))}
      </div>

      {provider === 'stripe' && (
        <div className="space-y-2">
          <Label className="text-xs">Stripe Secret Key</Label>
          <Input
            type="password"
            placeholder="sk_live_..."
            value={data.stripeKey ?? ''}
            onChange={(e) => updateData({ stripeKey: e.target.value })}
          />
        </div>
      )}

      {provider === 'ozow' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Site Code</Label>
            <Input
              placeholder="Your Ozow site code"
              value={data.ozowSiteCode ?? ''}
              onChange={(e) => updateData({ ozowSiteCode: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Private Key</Label>
            <Input
              type="password"
              placeholder="Private key"
              value={data.ozowPrivateKey ?? ''}
              onChange={(e) => updateData({ ozowPrivateKey: e.target.value })}
            />
          </div>
        </div>
      )}

      {provider === 'payfast' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Merchant ID</Label>
            <Input
              placeholder="Merchant ID"
              value={data.payfastMerchantId ?? ''}
              onChange={(e) => updateData({ payfastMerchantId: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Merchant Key</Label>
            <Input
              type="password"
              placeholder="Merchant key"
              value={data.payfastMerchantKey ?? ''}
              onChange={(e) => updateData({ payfastMerchantKey: e.target.value })}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
