'use client';

import { useState } from 'react';
import { WizardStepper } from './wizard-stepper';
import { StepBusinessInfo } from './steps/step-business-info';
import { StepBranding } from './steps/step-branding';
import { StepWhatsApp } from './steps/step-whatsapp';
import { StepServices } from './steps/step-services';
import { StepStaff } from './steps/step-staff';

export interface WizardData {
  businessName: string;
  businessType: string;
  tradingName: string;
  brandColor: string;
  logoUrl: string;
  whatsappNumber: string;
  whatsappVerified: boolean;
  services: ServiceEntry[];
  staff: StaffEntry[];
}

export interface ServiceEntry {
  name: string;
  durationMin: number;
  priceCents: number;
  category: string;
}

export interface StaffEntry {
  name: string;
  email: string;
  role: string;
  specialties: string[];
}

const INITIAL_DATA: WizardData = {
  businessName: '',
  businessType: 'salon',
  tradingName: '',
  brandColor: '#0f172a',
  logoUrl: '',
  whatsappNumber: '',
  whatsappVerified: false,
  services: [],
  staff: [],
};

const STEPS = [
  { id: 1, label: 'Business Info' },
  { id: 2, label: 'Branding' },
  { id: 3, label: 'WhatsApp' },
  { id: 4, label: 'Services' },
  { id: 5, label: 'Staff' },
  { id: 6, label: 'Hours' },
  { id: 7, label: 'Payments' },
  { id: 8, label: 'FAQs' },
  { id: 9, label: 'Bot Setup' },
  { id: 10, label: 'Go Live' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);

  function updateData(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set up MarineFlow</h1>
          <p className="text-muted-foreground mt-1">
            Step {step} of {STEPS.length}: {STEPS[step - 1]?.label}
          </p>
        </div>

        <WizardStepper steps={STEPS} currentStep={step} />

        <div className="bg-card rounded-lg border p-6">
          {step === 1 && (
            <StepBusinessInfo data={data} updateData={updateData} onNext={next} />
          )}
          {step === 2 && (
            <StepBranding data={data} updateData={updateData} onNext={next} onBack={back} />
          )}
          {step === 3 && (
            <StepWhatsApp data={data} updateData={updateData} onNext={next} onBack={back} />
          )}
          {step === 4 && (
            <StepServices data={data} updateData={updateData} onNext={next} onBack={back} />
          )}
          {step === 5 && (
            <StepStaff data={data} updateData={updateData} onNext={next} onBack={back} />
          )}
          {step > 5 && (
            <div className="text-center py-8 text-muted-foreground">
              Steps 6–10 coming in Week 12.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
