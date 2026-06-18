import { cn } from '@/lib/utils';

export type OnboardingStatus = {
  whatsappConfigured: boolean;
  stripeConnected: boolean;
  firstBookingMade: boolean;
  staffAdded: boolean;
};

const STEPS: { key: keyof OnboardingStatus; label: string; short: string }[] = [
  { key: 'whatsappConfigured', label: 'WhatsApp connected', short: 'WA' },
  { key: 'stripeConnected', label: 'Billing active', short: 'Bill' },
  { key: 'firstBookingMade', label: 'First booking', short: 'Book' },
  { key: 'staffAdded', label: 'Staff added', short: 'Staff' },
];

type Props = {
  status: OnboardingStatus;
  className?: string;
};

export function OnboardingPips({ status, className }: Props) {
  const completed = STEPS.filter((s) => status[s.key]).length;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1" title={`${completed}/4 onboarding steps`}>
        {STEPS.map((step) => {
          const done = status[step.key];
          return (
            <span
              key={step.key}
              title={`${step.label}${done ? ' — done' : ' — pending'}`}
              className={cn(
                'size-2.5 rounded-full border transition-colors',
                done
                  ? 'bg-green-500 border-green-600 dark:bg-green-400 dark:border-green-500'
                  : 'bg-muted border-border',
              )}
            />
          );
        })}
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{completed}/4</span>
    </div>
  );
}

export function isOnboardingComplete(status: OnboardingStatus): boolean {
  return STEPS.every((s) => status[s.key]);
}
