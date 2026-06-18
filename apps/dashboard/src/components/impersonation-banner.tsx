'use client';

import { useTransition } from 'react';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { exitImpersonation } from '@/app/(dashboard)/admin/actions';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner({ businessName }: { businessName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm flex items-center gap-2 min-w-0">
          <LayoutDashboard className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>
            Viewing <strong className="font-semibold">{businessName}</strong> as owner — changes apply to their live bot.
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          className="shrink-0 bg-background/80"
          onClick={() => startTransition(() => exitImpersonation())}
        >
          <ArrowLeft className="size-3.5" />
          {pending ? 'Returning…' : 'Back to platform'}
        </Button>
      </div>
    </div>
  );
}
