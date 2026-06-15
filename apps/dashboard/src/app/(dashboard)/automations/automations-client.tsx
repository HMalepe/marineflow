'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Calendar,
  CalendarX,
  Crown,
  Gift,
  Heart,
  Megaphone,
  MessageSquare,
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
  booking: { slotIntervalMin: number; holdTimeoutMin: number };
  messaging: { winbackBody: string; birthdayBody: string; cancellationPolicyText: string };
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
  booking: { slotIntervalMin: 15, holdTimeoutMin: 30 },
  messaging: { winbackBody: '', birthdayBody: '', cancellationPolicyText: '' },
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
    if (draft.reminders.enabled && draft.reminders.hoursBefore.length === 0) {
      reportError('automations', 'Select at least one reminder time when reminders are enabled.');
      return;
    }
    if (draft.reminders.hoursBefore.length > 4) {
      reportError('automations', 'You can select up to 4 reminder times.');
      return;
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="size-7 text-amber-500" />
            Power Features
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Single place for reminders, win-back, reviews, booking rules, and campaign copy. Paste your{' '}
            <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
              Google review URL in Settings
            </Link>
            .
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
          {draft.reminders.enabled && (
            <div className="space-y-4 pl-1">
              <div className="space-y-3">
                <Label className="text-sm">When to send</Label>
                <div className="flex flex-wrap gap-2">
                  {[48, 24, 12, 4, 2, 1].map((h) => {
                    const active = draft.reminders.hoursBefore.includes(h);
                    const atCap = !active && draft.reminders.hoursBefore.length >= 4;
                    const label = h >= 24 ? `${h / 24}d` : `${h}h`;
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={atCap}
                        onClick={() => {
                          const prev = draft.reminders.hoursBefore;
                          const hours = active
                            ? prev.filter((x) => x !== h)
                            : [...prev, h];
                          patch('reminders', { hoursBefore: hours });
                        }}
                        className={cn(
                          'flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all',
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : atCap
                              ? 'bg-muted/40 border-border text-muted-foreground cursor-not-allowed opacity-60'
                              : 'bg-card border-border hover:border-ring text-foreground',
                        )}
                      >
                        <span className="text-base font-bold leading-none">{label}</span>
                        <span className="opacity-70">before</span>
                      </button>
                    );
                  })}
                </div>
                {draft.reminders.hoursBefore.length > 0 && (
                  <div className="relative flex items-center gap-0 mt-1 px-1">
                    <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-border -translate-y-1/2" />
                    <div className="relative z-10 flex items-center justify-between w-full">
                      {[...draft.reminders.hoursBefore].sort((a, b) => b - a).map((h) => (
                        <div key={h} className="flex flex-col items-center gap-1">
                          <div className="size-2.5 rounded-full bg-primary ring-2 ring-background" />
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {h >= 24 ? `${h / 24}d` : `${h}h`}
                          </span>
                        </div>
                      ))}
                      <div className="flex flex-col items-center gap-1">
                        <div className="size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                        <span className="text-[10px] text-muted-foreground font-medium">Appt</span>
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Select up to 4 times. At least one required.</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message preview</p>
                <div className="rounded-xl border bg-[#ece5dd] dark:bg-[#1a2128] p-4 space-y-2">
                  <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%] ml-auto shadow-sm">
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                      {`Hi there! Reminder:\nYour service with your stylist\nFri, 14 Jun · 10:00 AM (in ${
                        draft.reminders.hoursBefore.includes(24)
                          ? '1 day'
                          : draft.reminders.hoursBefore.includes(2)
                            ? '2 hours'
                            : `${[...draft.reminders.hoursBefore].sort((a, b) => a - b)[0] ?? 24} hours`
                      })\n\nReply CANCEL or RESCHEDULE to manage your booking.`}
                    </p>
                    <p className="text-[10px] text-muted-foreground text-right mt-1">10:23 AM ✓✓</p>
                  </div>
                  <p className="text-[11px] text-center text-muted-foreground/60">Sent from your WhatsApp business number</p>
                </div>
              </div>
            </div>
          )}
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
            description="Sends your Google review link + optional claim link after each visit. Add the review URL under Settings."
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
          <div className="grid sm:grid-cols-2 gap-4 pl-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Daily cap</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={draft.reactivation.dailyLimit}
                onChange={(e) =>
                  patch('reactivation', { dailyLimit: parseInt(e.target.value, 10) || 50 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cooldown (days)</Label>
              <Input
                type="number"
                min={7}
                max={90}
                value={draft.reactivation.cooldownDays}
                onChange={(e) =>
                  patch('reactivation', { cooldownDays: parseInt(e.target.value, 10) || 30 })
                }
              />
            </div>
          </div>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4" /> Booking slot interval
          </CardTitle>
          <CardDescription>How granular the WhatsApp time picker is, and when unpaid holds expire.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Slot interval</Label>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 30, 60].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => patch('booking', { slotIntervalMin: min })}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-colors',
                    draft.booking.slotIntervalMin === min
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-ring',
                  )}
                >
                  {min === 60 ? '1 hour' : `${min} min`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Hold timeout (minutes)</Label>
            <Input
              type="number"
              min={0}
              max={240}
              step={5}
              value={draft.booking.holdTimeoutMin}
              onChange={(e) =>
                patch('booking', {
                  holdTimeoutMin: Math.max(0, Math.min(240, parseInt(e.target.value, 10) || 0)),
                })
              }
            />
            <p className="text-xs text-muted-foreground">0 = no auto-release for unpaid holds.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="size-4" /> Campaign message templates
          </CardTitle>
          <CardDescription>
            Use {'{name}'} and {'{salon}'} placeholders. Leave blank for smart defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Win-back message</Label>
            <textarea
              className={cn(
                'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              )}
              value={draft.messaging.winbackBody}
              onChange={(e) => patch('messaging', { winbackBody: e.target.value })}
              maxLength={1600}
              rows={3}
              placeholder="Hey {name}! We miss you at {salon}…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Birthday message</Label>
            <textarea
              className={cn(
                'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              )}
              value={draft.messaging.birthdayBody}
              onChange={(e) => patch('messaging', { birthdayBody: e.target.value })}
              maxLength={1600}
              rows={3}
              placeholder="Happy birthday {name}! 🎂 From all of us at {salon}…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cancellation policy</Label>
            <textarea
              className={cn(
                'flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              )}
              value={draft.messaging.cancellationPolicyText}
              onChange={(e) => patch('messaging', { cancellationPolicyText: e.target.value })}
              maxLength={2000}
              rows={4}
              placeholder="Cancellations within 24 hours may incur a fee…"
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
