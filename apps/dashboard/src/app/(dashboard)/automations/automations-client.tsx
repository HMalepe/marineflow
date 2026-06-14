'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarX,
  Crown,
  Gift,
  Heart,
  Megaphone,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SectionSaveFeedback } from '@/components/save-feedback';
import { useMultiSectionSaveFeedback } from '@/lib/use-save-feedback';
import { apiFetch, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface SalonAutomations {
  reminders: { enabled: boolean; hoursBefore: number[] };
  cancellation: {
    allowSelfServiceReschedule: boolean;
    rescheduleHoursBefore: number;
    cancelHoursBefore: number;
    forfeitDepositOnLateCancel: boolean;
  };
  waitlist: { enabled: boolean; autoFillOnCancel: boolean };
  googleReview: { enabled: boolean; hoursAfterVisit: number; incentiveEnabled: boolean; incentiveCents: number };
  welcomeJourney: { enabled: boolean; introMessage: string; showPopularServices: boolean };
  referral: { enabled: boolean; rewardCents: number; promptAfterVisits: number[] };
  membership: { enabled: boolean };
  seasonalCampaigns: { enabled: boolean; maxScheduled: number };
  reactivation: { enabled: boolean; inactiveDays: number[]; dailyLimit: number; cooldownDays: number };
  upselling: { enabled: boolean };
  stylistPerformance: { enabled: boolean; incentiveEnabled: boolean; incentivePercentPerCut: number };
}

const DEFAULTS: SalonAutomations = {
  reminders: { enabled: true, hoursBefore: [24, 2] },
  cancellation: {
    allowSelfServiceReschedule: true,
    rescheduleHoursBefore: 12,
    cancelHoursBefore: 24,
    forfeitDepositOnLateCancel: true,
  },
  waitlist: { enabled: true, autoFillOnCancel: true },
  googleReview: { enabled: true, hoursAfterVisit: 24, incentiveEnabled: true, incentiveCents: 5000 },
  welcomeJourney: {
    enabled: true,
    introMessage:
      'Welcome! We are so glad you found us. Our team is ready to make you look and feel amazing.',
    showPopularServices: true,
  },
  referral: { enabled: true, rewardCents: 5000, promptAfterVisits: [1, 5] },
  membership: { enabled: false },
  seasonalCampaigns: { enabled: true, maxScheduled: 50 },
  reactivation: { enabled: true, inactiveDays: [21, 45, 90, 180], dailyLimit: 50, cooldownDays: 30 },
  upselling: { enabled: true },
  stylistPerformance: { enabled: true, incentiveEnabled: false, incentivePercentPerCut: 10 },
};

interface Props {
  token: string;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card/50 p-4 transition-colors hover:border-primary/30">
      <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
        <Icon className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          <span className="font-medium text-sm">{label}</span>
        </label>
        <p className="text-xs text-muted-foreground leading-relaxed pl-7">{description}</p>
      </div>
    </div>
  );
}

export function AutomationsClient({ token }: Props) {
  const [saved, setSaved] = useState<SalonAutomations>(DEFAULTS);
  const [draft, setDraft] = useState<SalonAutomations>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { getSection, reportSuccess, reportError } = useMultiSectionSaveFeedback();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ automations: SalonAutomations }>('/settings/automations', {}, token);
      setSaved(data.automations);
      setDraft(data.automations);
    } catch (e) {
      reportError('automations', e instanceof ApiError ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, reportError]);

  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  async function handleSave() {
    setSaving(true);
    try {
      const data = await apiFetch<{ salon: { automations: SalonAutomations } }>(
        '/settings',
        { method: 'PATCH', body: JSON.stringify({ automations: draft }) },
        token,
      );
      setSaved(data.salon.automations);
      setDraft(data.salon.automations);
      reportSuccess('automations', 'Power features saved');
    } catch (e) {
      reportError('automations', e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof SalonAutomations>(key: K, value: Partial<SalonAutomations[K]>) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...value } }));
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="size-7 text-amber-500" />
            Power Features
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Premium automations that reduce no-shows, recover revenue, and grow your salon — toggle each feature and save.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-start sm:items-end">
          <Button onClick={() => void handleSave()} disabled={saving || !dirty} size="sm">
            {saving ? 'Saving…' : 'Save all changes'}
          </Button>
          {dirty && (
            <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
          )}
          <SectionSaveFeedback feedback={getSection('automations')} />
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4" /> Appointment reminders
          </CardTitle>
          <CardDescription>Automatic WhatsApp reminders 24 hours and 2 hours before — proven to cut no-shows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            icon={Bell}
            checked={draft.reminders.enabled}
            onChange={(v) => patch('reminders', { enabled: v })}
            label="Send appointment reminders"
            description="Customers receive timed reminders with cancel/reschedule options."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarX className="size-4" /> Cancellation &amp; reschedule rules
          </CardTitle>
          <CardDescription>Self-service with clear deadlines. Use the emergency waive button on appointments when life happens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            icon={CalendarX}
            checked={draft.cancellation.allowSelfServiceReschedule}
            onChange={(v) => patch('cancellation', { allowSelfServiceReschedule: v })}
            label="Allow self-service rescheduling"
            description="Customers can reschedule via WhatsApp within your policy window."
          />
          <div className="grid sm:grid-cols-2 gap-4 pl-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rescheduling deadline</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  className="w-24"
                  value={draft.cancellation.rescheduleHoursBefore}
                  onChange={(e) => patch('cancellation', { rescheduleHoursBefore: parseInt(e.target.value, 10) || 12 })}
                />
                <span className="text-sm text-muted-foreground">hours before appointment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                e.g. {draft.cancellation.rescheduleHoursBefore}h = customers can reschedule up to {draft.cancellation.rescheduleHoursBefore >= 24 ? `${Math.round(draft.cancellation.rescheduleHoursBefore / 24)} day${draft.cancellation.rescheduleHoursBefore >= 48 ? 's' : ''}` : `${draft.cancellation.rescheduleHoursBefore} hours`} before
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cancellation deadline</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  className="w-24"
                  value={draft.cancellation.cancelHoursBefore}
                  onChange={(e) => patch('cancellation', { cancelHoursBefore: parseInt(e.target.value, 10) || 24 })}
                />
                <span className="text-sm text-muted-foreground">hours before appointment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                After this window closes, cancellations are considered &quot;late&quot;
              </p>
            </div>
          </div>
          <Toggle
            icon={CalendarX}
            checked={draft.cancellation.forfeitDepositOnLateCancel}
            onChange={(v) => patch('cancellation', { forfeitDepositOnLateCancel: v })}
            label={`Forfeit deposit on late cancellation (< ${draft.cancellation.cancelHoursBefore}h notice)`}
            description="If a customer cancels after the deadline above, their deposit is kept. Use the 'Waive penalty' button on the appointment if you want to make an exception."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> Waitlist — fill empty slots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            icon={Users}
            checked={draft.waitlist.enabled && draft.waitlist.autoFillOnCancel}
            onChange={(v) => patch('waitlist', { enabled: v, autoFillOnCancel: v })}
            label="Auto-fill cancelled appointments"
            description="When a slot opens, the next waitlisted customer gets: Reply YES to claim."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="size-4" /> Google review requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            icon={Star}
            checked={draft.googleReview.enabled}
            onChange={(v) => patch('googleReview', { enabled: v })}
            label="Request review after appointment"
            description="Sends your Google review link + optional R50 claim link after each visit (configure in Settings)."
          />
          <Toggle
            icon={Star}
            checked={draft.googleReview.incentiveEnabled}
            onChange={(v) => patch('googleReview', { incentiveEnabled: v })}
            label="Review incentive (R50 off)"
            description="Customers receive a special claim link for any review — good or bad."
          />
          {draft.googleReview.incentiveEnabled && (
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs">Incentive amount (R)</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={draft.googleReview.incentiveCents / 100}
                onChange={(e) =>
                  patch('googleReview', {
                    incentiveCents: Math.max(1, parseInt(e.target.value, 10) || 50) * 100,
                  })
                }
              />
            </div>
          )}
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Hours after visit</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={draft.googleReview.hoursAfterVisit}
              onChange={(e) => patch('googleReview', { hoursAfterVisit: parseInt(e.target.value, 10) || 24 })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="size-4" /> New customer welcome journey
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            icon={Heart}
            checked={draft.welcomeJourney.enabled}
            onChange={(v) => patch('welcomeJourney', { enabled: v })}
            label="Welcome first-time customers"
            description="Salon intro, popular services, and subtle POPIA/marketing consent context."
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Introduction message</Label>
            <textarea
              className={cn(
                'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              )}
              value={draft.welcomeJourney.introMessage}
              onChange={(e) => patch('welcomeJourney', { introMessage: e.target.value })}
            />
          </div>
          <Toggle
            icon={Sparkles}
            checked={draft.welcomeJourney.showPopularServices}
            onChange={(v) => patch('welcomeJourney', { showPopularServices: v })}
            label="Show popular services"
            description="Lists top services with prices in the welcome message."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="size-4" /> Referral programme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            icon={Gift}
            checked={draft.referral.enabled}
            onChange={(v) => patch('referral', { enabled: v })}
            label="Customer referrals"
            description="Prompts after 1st visit and every 5th thereafter. Friend must be new; both get R50 off."
          />
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Reward amount (cents, e.g. 5000 = R50)</Label>
            <Input
              type="number"
              min={0}
              value={draft.referral.rewardCents}
              onChange={(e) => patch('referral', { rewardCents: parseInt(e.target.value, 10) || 5000 })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="size-4" /> VIP membership club
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            icon={Crown}
            checked={draft.membership.enabled}
            onChange={(v) => patch('membership', { enabled: v })}
            label="Membership subscriptions"
            description="Offer monthly plans (e.g. 4 cuts/month). Configure plans via API; bot menu item 10."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="size-4" /> Seasonal campaigns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            icon={Megaphone}
            checked={draft.seasonalCampaigns.enabled}
            onChange={(v) => patch('seasonalCampaigns', { enabled: v })}
            label="Manual &amp; scheduled promotions"
            description="Use Newsletter with seasonal templates — Winter, Mother's Day, SA holidays, and more."
          />
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Max scheduled campaigns</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={draft.seasonalCampaigns.maxScheduled}
              onChange={(e) => patch('seasonalCampaigns', { maxScheduled: parseInt(e.target.value, 10) || 50 })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="size-4" /> Reactivate lost customers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            icon={RefreshCw}
            checked={draft.reactivation.enabled}
            onChange={(v) => patch('reactivation', { enabled: v })}
            label="Customer reactivation campaigns"
            description="Configurable win-back at 21, 45, 90, and 180 days inactive."
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Inactive day tiers (comma-separated)</Label>
            <Input
              value={draft.reactivation.inactiveDays.join(', ')}
              onChange={(e) => {
                const days = e.target.value
                  .split(',')
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => Number.isFinite(n));
                if (days.length) patch('reactivation', { inactiveDays: days });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4" /> Smart upselling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            icon={TrendingUp}
            checked={draft.upselling.enabled}
            onChange={(v) => patch('upselling', { enabled: v })}
            label="Recommend add-ons at booking"
            description="Configure add-ons under Services — deep conditioning, hot towel, waxing, retail, etc."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="size-4 text-amber-500" /> Stylist performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            icon={Star}
            checked={draft.stylistPerformance.enabled}
            onChange={(v) => patch('stylistPerformance', { enabled: v })}
            label="Track stylist performance"
            description="Leaderboard with bookings, revenue, ratings, rebooking rate — see Team Performance page."
          />
          <Toggle
            icon={TrendingUp}
            checked={draft.stylistPerformance.incentiveEnabled}
            onChange={(v) => patch('stylistPerformance', { incentiveEnabled: v })}
            label="Calculate haircut incentives"
            description="Adjustable % of service revenue per stylist on the leaderboard."
          />
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Incentive % per haircut</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.stylistPerformance.incentivePercentPerCut}
              onChange={(e) =>
                patch('stylistPerformance', {
                  incentivePercentPerCut: parseInt(e.target.value, 10) || 0,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3 pb-8">
        <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save power features'}
        </Button>
        <SectionSaveFeedback feedback={getSection('automations')} />
      </div>
    </div>
  );
}
