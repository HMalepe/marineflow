interface Step {
  id: number;
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: number;
}

export function WizardStepper({ steps, currentStep }: Props) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {steps.map((s) => (
          <div
            key={s.id}
            className={`flex-1 h-2 mx-0.5 rounded-full transition-colors ${
              s.id <= currentStep ? 'bg-primary' : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{steps[0]?.label}</span>
        <span>{steps[steps.length - 1]?.label}</span>
      </div>
    </div>
  );
}
