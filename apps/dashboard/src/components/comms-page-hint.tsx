import Link from 'next/link';
import {
  CONVERSATIONS_LABEL,
  CONVERSATIONS_TAGLINE,
  TICKETS_LABEL,
  TICKETS_TAGLINE,
} from '@/lib/dashboard-nav';

type Props = { active: 'conversations' | 'tickets' };

export function CommsPageHint({ active }: Props) {
  if (active === 'conversations') {
    return (
      <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
        {CONVERSATIONS_TAGLINE} For logged complaints and report-a-problem issues, see{' '}
        <Link href="/tickets" className="text-primary underline-offset-4 hover:underline">
          {TICKETS_LABEL}
        </Link>
        .
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
      {TICKETS_TAGLINE} For live back-and-forth chat, use{' '}
      <Link href="/conversations" className="text-primary underline-offset-4 hover:underline">
        {CONVERSATIONS_LABEL}
      </Link>
      .
    </p>
  );
}
