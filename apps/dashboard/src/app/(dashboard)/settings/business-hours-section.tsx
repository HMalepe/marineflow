'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionSaveFeedback } from '@/components/save-feedback';
import { CollapsibleSection } from '@/components/collapsible-section';
import { useMultiSectionSaveFeedback } from '@/lib/use-save-feedback';
import { cn } from '@/lib/utils';
import { fetchBusinessHours, saveBusinessHours, type BusinessHoursSettings } from './actions';

const TIMEZONE_OPTIONS = [
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
  { value: 'Africa/Harare', label: 'Africa/Harare (CAT)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (EET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
];

const HOLIDAY_KEYS = [
  { key: 'publicHoliday' as const, label: 'Public holidays' },
  { key: 'christmas' as const, label: 'Christmas Day (25 Dec)' },
  { key: 'newYearsEve' as const, label: "New Year's Eve (31 Dec)" },
  { key: 'newYearsDay' as const, label: "New Year's Day (1 Jan)" },
];

const DEFAULT_HOURS: BusinessHoursSettings = {
  weekdayOpen: '09:00',
  weekdayClose: '17:00',
  saturday: { closed: false, open: '09:00', close: '17:00' },
  sunday: { closed: true, open: '09:00', close: '17:00' },
  timezone: 'Africa/Johannesburg',
  holidayOverrides: {
    publicHoliday: { closed: true },
    christmas: { closed: true },
    newYearsEve: { closed: true },
    newYearsDay: { closed: true },
  },
};

interface Props {
  fallbackTimezone: string;
  onWeekdayHoursChange?: (open: string, close: string) => void;
}

export function BusinessHoursSection({ fallbackTimezone, onWeekdayHoursChange }: Props) {
  const router = useRouter();
  const { getSection, reportSuccess, reportError } = useMultiSectionSaveFeedback();
  const [saved, setSaved] = useState<BusinessHoursSettings | null>(null);
  const [form, setForm] = useState<BusinessHoursSettings>({
    ...DEFAULT_HOURS,
    timezone: fallbackTimezone,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const result = await fetchBusinessHours();
      if (cancelled) return;
      if (result.hours) {
        setSaved(result.hours);
        setForm(result.hours);
        onWeekdayHoursChange?.(result.hours.weekdayOpen, result.hours.weekdayClose);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [onWeekdayHoursChange]);

  const dirty = useMemo(() => {
    if (!saved) return false;
    return JSON.stringify(form) !== JSON.stringify(saved);
  }, [form, saved]);

  const timezoneLabel =
    TIMEZONE_OPTIONS.find((t) => t.value === form.timezone)?.label ?? form.timezone;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await saveBusinessHours(form);
    setSaving(false);
    if (result.error) {
      reportError('hours', result.error);
      return;
    }
    if (result.hours) {
      setSaved(result.hours);
      setForm(result.hours);
      onWeekdayHoursChange?.(result.hours.weekdayOpen, result.hours.weekdayClose);
    }
    reportSuccess('hours', 'Business hours saved — roster shifts updated');
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading business hours…</p>;
  }

  return (
    <section id="settings-hours" data-section-label="Business hours" className="dashboard-section-anchor">
      <CollapsibleSection
        id="settings-hours-toggle"
        title="Business hours"
        subtitle="Default business hours for WhatsApp, booking, and the staff roster. Saving updates all team shifts to match."
        manualToggle
        className="border-0 bg-transparent shadow-none"
      >
      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm">
        <span className="text-muted-foreground">Mon–Fri </span>
        <span className="font-medium">
          {form.weekdayOpen} – {form.weekdayClose}
        </span>
        <span className="text-muted-foreground"> · Sat </span>
        <span className="font-medium">
          {form.saturday.closed ? 'Closed' : `${form.saturday.open} – ${form.saturday.close}`}
        </span>
        <span className="text-muted-foreground"> · Sun </span>
        <span className="font-medium">
          {form.sunday.closed ? 'Closed' : `${form.sunday.open} – ${form.sunday.close}`}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-medium">{timezoneLabel}</span>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Monday – Friday</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weekday-open">Opens</Label>
              <Input
                id="weekday-open"
                type="time"
                value={form.weekdayOpen}
                onChange={(e) => setForm((f) => ({ ...f, weekdayOpen: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekday-close">Closes</Label>
              <Input
                id="weekday-close"
                type="time"
                value={form.weekdayClose}
                onChange={(e) => setForm((f) => ({ ...f, weekdayClose: e.target.value }))}
                required
              />
            </div>
          </div>
        </div>

        {(
          [
            ['saturday', 'Saturday'] as const,
            ['sunday', 'Sunday'] as const,
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{label}</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!form[key].closed}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      [key]: { ...f[key], closed: !e.target.checked },
                    }))
                  }
                  className="rounded"
                />
                Open
              </label>
            </div>
            {!form[key].closed && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${key}-open`}>Opens</Label>
                  <Input
                    id={`${key}-open`}
                    type="time"
                    value={form[key].open}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: { ...f[key], open: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-close`}>Closes</Label>
                  <Input
                    id={`${key}-close`}
                    type="time"
                    value={form[key].close}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: { ...f[key], close: e.target.value } }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Special dates &amp; holidays</p>
            <p className="text-xs text-muted-foreground mt-1">
              Used for after-hours messaging and future booking rules on these dates each year.
            </p>
          </div>
          <div className="space-y-3">
            {HOLIDAY_KEYS.map(({ key, label }) => {
              const override = form.holidayOverrides[key] ?? { closed: true };
              return (
                <div key={key} className="rounded-lg bg-muted/30 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">{label}</span>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!override.closed}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            holidayOverrides: {
                              ...f.holidayOverrides,
                              [key]: {
                                ...override,
                                closed: !e.target.checked,
                              },
                            },
                          }))
                        }
                        className="rounded"
                      />
                      Open with custom hours
                    </label>
                  </div>
                  {!override.closed && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        type="time"
                        value={override.open ?? '09:00'}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            holidayOverrides: {
                              ...f.holidayOverrides,
                              [key]: { ...override, open: e.target.value },
                            },
                          }))
                        }
                      />
                      <Input
                        type="time"
                        value={override.close ?? '13:00'}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            holidayOverrides: {
                              ...f.holidayOverrides,
                              [key]: { ...override, close: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 max-w-md">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="business-timezone">Timezone</Label>
            <button
              type="button"
              onClick={() => {
                const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (detected) setForm((f) => ({ ...f, timezone: detected }));
              }}
              className="text-xs text-primary hover:underline"
            >
              Auto-detect from browser
            </button>
          </div>
          <select
            id="business-timezone"
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            className={cn(
              'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
            )}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          {form.timezone && !TIMEZONE_OPTIONS.find((t) => t.value === form.timezone) && (
            <p className="text-xs text-muted-foreground">
              Using detected timezone: <span className="font-medium">{form.timezone}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save business hours'}
            </Button>
            {dirty && (
              <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
            )}
          </div>
          <SectionSaveFeedback feedback={getSection('hours')} />
        </div>
      </form>
      </CollapsibleSection>
    </section>
  );
}
