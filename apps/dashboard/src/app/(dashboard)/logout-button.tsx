'use client';

import { useRouter } from 'next/navigation';
import { Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

async function performLogout(router: ReturnType<typeof useRouter>) {
  await fetch('/api/logout', { method: 'POST' });
  router.push('/login');
  router.refresh();
}

export function LogoutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={() => void performLogout(router)}
    >
      Sign out
    </Button>
  );
}

/** Universal power icon — quick sign out beside the user name. */
export function LogoutIconButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10',
        className,
      )}
      onClick={() => void performLogout(router)}
      aria-label="Sign out"
      title="Sign out"
    >
      <Power className="size-3.5" strokeWidth={2.25} aria-hidden />
    </Button>
  );
}
