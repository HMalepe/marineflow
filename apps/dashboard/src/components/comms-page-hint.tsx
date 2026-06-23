import Link from 'next/link';
import {
  CONVERSATIONS_LABEL,
  CONVERSATIONS_TAGLINE,
  TICKETS_LABEL,
  TICKETS_TAGLINE,
} from '@/lib/dashboard-nav';
import { PremiumDisclosure } from '@/components/premium-disclosure';

type Props = { active: 'conversations' | 'tickets' };

export function CommsPageHint({ active }: Props) {
  if (active === 'conversations') {
    return (
      <PremiumDisclosure label="Conversations vs tickets">
        {CONVERSATIONS_TAGLINE} For complaints and report-a-problem issues, open{' '}
        <Link href="/tickets" className="text-primary underline-offset-4 hover:underline">
          {TICKETS_LABEL}
        </Link>
        .
      </PremiumDisclosure>
    );
  }

  return (
    <PremiumDisclosure label="Tickets vs conversations">
      {TICKETS_TAGLINE} For live chat, use{' '}
      <Link href="/conversations" className="text-primary underline-offset-4 hover:underline">
        {CONVERSATIONS_LABEL}
      </Link>
      .
    </PremiumDisclosure>
  );
}
