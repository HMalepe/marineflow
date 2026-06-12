import { getApiBaseUrl } from '@/lib/api-config';

interface ReviewClaimInfo {
  status: 'pending' | 'claimed' | 'expired' | 'invalid';
  salonName?: string;
  rewardLabel?: string;
  token?: string;
  whatsAppDeepLink?: string | null;
}

async function fetchClaimInfo(token: string): Promise<ReviewClaimInfo> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/public/review-reward/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'invalid' };
    return (await res.json()) as ReviewClaimInfo;
  } catch {
    return { status: 'invalid' };
  }
}

export default async function ReviewRewardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await fetchClaimInfo(token);

  if (info.status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Link not found</h1>
          <p className="text-muted-foreground text-sm">
            This review reward link is invalid or has already been removed.
          </p>
        </div>
      </div>
    );
  }

  const salonName = info.salonName ?? 'the salon';
  const reward = info.rewardLabel ?? 'R50';

  if (info.status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Reward expired</h1>
          <p className="text-muted-foreground text-sm">
            Your {reward} review reward from {salonName} has expired. Contact the salon if you need help.
          </p>
        </div>
      </div>
    );
  }

  if (info.status === 'claimed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="size-20 rounded-full bg-green-600/15 flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Already claimed!</h1>
            <p className="text-muted-foreground">
              Your {reward} reward from {salonName} is saved — it will come off your next booking automatically on WhatsApp.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">{salonName}</p>
          <h1 className="text-2xl font-bold tracking-tight">Claim your {reward} review reward</h1>
          <p className="text-muted-foreground text-sm">
            Thanks for leaving a review! Tap below to claim your discount on WhatsApp — it will automatically apply to your next booking.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground space-y-2">
          <p>1. Leave your honest Google review (if you haven&apos;t already)</p>
          <p>2. Tap &quot;Claim on WhatsApp&quot; below</p>
          <p>3. Send the pre-filled message to activate your {reward} off</p>
        </div>

        {info.whatsAppDeepLink ? (
          <a
            href={info.whatsAppDeepLink}
            className="flex w-full items-center justify-center rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1da851] transition-colors"
          >
            Claim on WhatsApp
          </a>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-4 text-sm text-center">
            Open WhatsApp and reply <strong>REVIEWED {info.token}</strong> to {salonName}&apos;s booking number.
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Reward code: {info.token}
        </p>
      </div>
    </div>
  );
}
