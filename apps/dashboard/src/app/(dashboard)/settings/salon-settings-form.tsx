'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { saveDisplayName, saveHours, saveMessages, saveBotActive, type SalonSettings } from './actions';

const WHATSAPP_LIMIT = 4096;

export type { SalonSettings };

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

type PreviewMode = 'welcome' | 'afterHours';

interface Props {
  initialSettings: SalonSettings;
}

function WhatsAppPreview({
  message,
  salonName,
  botName,
}: {
  message: string;
  salonName: string;
  botName: string;
}) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-xl overflow-hidden border shadow-sm bg-[#e5ddd5] dark:bg-[#0b141a]">
      <div className="bg-[#075e54] dark:bg-[#1f2c34] px-4 py-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-[#25d366]/30 flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {salonName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium leading-tight truncate">{salonName}</p>
          <p className="text-white/70 text-xs">{botName} · online</p>
        </div>
      </div>
      <div
        className="p-4 min-h-[160px]"
        style={{
          backgroundColor: '#e5ddd5',
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d4cdc4\' fill-opacity=\'0.45\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        <div className="max-w-[92%] rounded-lg rounded-tl-none bg-white dark:bg-[#1f2c34] shadow-sm px-3 py-2">
          <p className="text-sm whitespace-pre-wrap break-words text-[#111b21] dark:text-[#e9edef]">
            {message}
          </p>
          <p className="text-[10px] text-[#667781] text-right mt-1">{timeLabel}</p>
        </div>
      </div>
    </div>
  );
}

function CharCount({ value, limit = WHATSAPP_LIMIT }: { value: string; limit?: number }) {
  const over = value.length > limit;
  const warn = !over && value.length > limit * 0.9;
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        over ? 'text-destructive font-medium' : warn ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground',
      )}
    >
      {value.length.toLocaleString()} / {limit.toLocaleString()}
    </span>
  );
}

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg max-w-sm animate-in slide-in-from-bottom-4',
        type === 'success'
          ? 'bg-card border-green-600/30'
          : 'bg-destructive/10 border-destructive/40 text-destructive',
      )}
    >
      <Badge
        className={cn(
          'shrink-0 border-0',
          type === 'success'
            ? 'bg-green-600/15 text-green-700 dark:text-green-400'
            : undefined,
        )}
        variant={type === 'success' ? 'secondary' : 'destructive'}
      >
        {type === 'success' ? 'Saved' : 'Error'}
      </Badge>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-muted-foreground hover:text-foreground ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function SalonSettingsForm({ initialSettings }: Props) {
  const router = useRouter();
  const [salon, setSalon] = useState<SalonSettings>(initialSettings);
  const [saved, setSaved] = useState<SalonSettings>(initialSettings);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('welcome');

  const [tradingName, setTradingName] = useState(initialSettings.tradingName ?? '');
  const [timezone, setTimezone] = useState(initialSettings.timezone || 'Africa/Johannesburg');
  const [openTime, setOpenTime] = useState(initialSettings.openTime ?? '09:00');
  const [closeTime, setCloseTime] = useState(initialSettings.closeTime ?? '17:00');
  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings.welcomeMessage ?? '');
  const [afterHoursMessage, setAfterHoursMessage] = useState(initialSettings.afterHoursMessage ?? '');
  const [botActive, setBotActive] = useState(initialSettings.botActive);

  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [savingMessages, setSavingMessages] = useState(false);
  const [savingBot, setSavingBot] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const applySalon = useCallback((s: SalonSettings) => {
    setSalon(s);
    setSaved(s);
    setTradingName(s.tradingName ?? '');
    setTimezone(s.timezone || 'Africa/Johannesburg');
    setOpenTime(s.openTime ?? '09:00');
    setCloseTime(s.closeTime ?? '17:00');
    setWelcomeMessage(s.welcomeMessage ?? '');
    setAfterHoursMessage(s.afterHoursMessage ?? '');
    setBotActive(s.botActive);
  }, []);

  const displayNameDirty = useMemo(() => tradingName !== (saved.tradingName ?? ''), [saved, tradingName]);

  const hoursDirty = useMemo(() => {
    return (
      timezone !== (saved.timezone || 'Africa/Johannesburg') ||
      openTime !== (saved.openTime ?? '09:00') ||
      closeTime !== (saved.closeTime ?? '17:00')
    );
  }, [saved, timezone, openTime, closeTime]);

  const messagesDirty = useMemo(() => {
    return (
      welcomeMessage !== (saved.welcomeMessage ?? '') ||
      afterHoursMessage !== (saved.afterHoursMessage ?? '')
    );
  }, [saved, welcomeMessage, afterHoursMessage]);

  const botDirty = useMemo(() => botActive !== saved.botActive, [saved, botActive]);

  const timezoneLabel =
    TIMEZONE_OPTIONS.find((t) => t.value === timezone)?.label ?? timezone;

  const defaultWelcome = `Welcome to ${salon.name}! Reply with a number:`;
  const defaultAfterHours = `We're currently closed. Our hours are ${openTime}–${closeTime}. We'll reply when we're back.`;

  const previewWelcome = welcomeMessage.trim() || defaultWelcome;
  const previewAfterHours = afterHoursMessage.trim() || defaultAfterHours;
  const previewText = previewMode === 'welcome' ? previewWelcome : previewAfterHours;

  const welcomeOver = welcomeMessage.length > WHATSAPP_LIMIT;
  const afterHoursOver = afterHoursMessage.length > WHATSAPP_LIMIT;

  async function handleSaveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tradingName.trim();
    if (!trimmed) {
      showToast('Enter a business display name', 'error');
      return;
    }
    setSavingDisplayName(true);
    const result = await saveDisplayName(trimmed);
    if (result.salon) {
      applySalon(result.salon);
      showToast('Business display name saved', 'success');
      router.refresh();
    } else {
      showToast(result.error ?? 'Save failed', 'error');
    }
    setSavingDisplayName(false);
  }

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault();
    setSavingHours(true);
    const result = await saveHours(openTime, closeTime, timezone);
    if (result.salon) {
      applySalon(result.salon);
      showToast('Business hours saved', 'success');
    } else {
      showToast(result.error ?? 'Save failed', 'error');
    }
    setSavingHours(false);
  }

  async function handleSaveMessages(e: React.FormEvent) {
    e.preventDefault();
    if (welcomeOver || afterHoursOver) {
      showToast(`Messages must be under ${WHATSAPP_LIMIT.toLocaleString()} characters`, 'error');
      return;
    }
    setSavingMessages(true);
    const result = await saveMessages(
      welcomeMessage.trim() || null,
      afterHoursMessage.trim() || null,
    );
    if (result.salon) {
      applySalon(result.salon);
      showToast('Bot messages saved', 'success');
    } else {
      showToast(result.error ?? 'Save failed', 'error');
    }
    setSavingMessages(false);
  }

  async function handleSaveBot(e: React.FormEvent) {
    e.preventDefault();
    setSavingBot(true);
    const result = await saveBotActive(botActive);
    if (result.salon) {
      applySalon(result.salon);
      showToast(
        botActive ? 'Bot is live on WhatsApp' : 'Bot paused — team will handle all messages',
        'success',
      );
    } else {
      showToast(result.error ?? 'Save failed', 'error');
    }
    setSavingBot(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          WhatsApp bot name: <span className="font-medium text-foreground">{salon.name}</span>
        </p>
      </div>

      {/* Dashboard business name */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Business display name</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Shown in your dashboard sidebar (e.g. Solupair). Does not change what customers see on WhatsApp — the bot
            still uses <span className="font-medium text-foreground">{salon.name}</span>.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveDisplayName(e)} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="tradingName">Display name</Label>
            <Input
              id="tradingName"
              value={tradingName}
              onChange={(e) => setTradingName(e.target.value)}
              placeholder="e.g. Solupair"
              maxLength={120}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={!displayNameDirty || savingDisplayName}>
            {savingDisplayName ? 'Saving…' : 'Save display name'}
          </Button>
        </form>
      </section>

      <Separator />

      {/* Business Hours */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Business Hours</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Controls after-hours auto-replies and hours shown to customers on WhatsApp.
          </p>
        </div>

        <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Currently set to </span>
          <span className="font-medium">{openTime} – {closeTime}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-medium">{timezoneLabel}</span>
        </div>

        <form onSubmit={(e) => void handleSaveHours(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="open-time">Opens</Label>
              <Input
                id="open-time"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-time">Closes</Label>
              <Input
                id="close-time"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
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
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={savingHours || !hoursDirty}>
              {savingHours ? 'Saving…' : hoursDirty ? 'Save business hours' : 'No changes'}
            </Button>
            {hoursDirty && (
              <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
            )}
          </div>
        </form>
      </section>

      <Separator />

      {/* WhatsApp Bot Messages */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">WhatsApp Bot Messages</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customise automated replies. Leave blank to use smart defaults.
          </p>
        </div>

        <form onSubmit={(e) => void handleSaveMessages(e)} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="welcome-message">Welcome message</Label>
                <CharCount value={welcomeMessage} />
              </div>
              <textarea
                id="welcome-message"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={6}
                placeholder={defaultWelcome}
                className={cn(
                  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y min-h-[120px]',
                  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
                  welcomeOver && 'border-destructive focus-visible:ring-destructive/30',
                )}
              />
              <p className="text-xs text-muted-foreground">
                First line customers see when they open your menu on WhatsApp.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="after-hours-message">After-hours message</Label>
                <CharCount value={afterHoursMessage} />
              </div>
              <textarea
                id="after-hours-message"
                value={afterHoursMessage}
                onChange={(e) => setAfterHoursMessage(e.target.value)}
                rows={5}
                placeholder={defaultAfterHours}
                className={cn(
                  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y min-h-[100px]',
                  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
                  afterHoursOver && 'border-destructive focus-visible:ring-destructive/30',
                )}
              />
              <p className="text-xs text-muted-foreground">
                Sent outside business hours or when the bot is paused. Creates a handoff for your team.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                size="sm"
                disabled={savingMessages || !messagesDirty || welcomeOver || afterHoursOver}
              >
                {savingMessages ? 'Saving…' : messagesDirty ? 'Save bot messages' : 'No changes'}
              </Button>
              {messagesDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>WhatsApp preview</Label>
              <div className="flex gap-1">
                {(['welcome', 'afterHours'] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={previewMode === mode ? 'default' : 'outline'}
                    onClick={() => setPreviewMode(mode)}
                  >
                    {mode === 'welcome' ? 'Welcome' : 'After hours'}
                  </Button>
                ))}
              </div>
            </div>
            <WhatsAppPreview
              message={previewText}
              salonName={salon.name}
              botName={salon.botName}
            />
            <p className="text-xs text-muted-foreground">
              {previewMode === 'welcome'
                ? 'Preview uses your welcome text plus the numbered menu on the bot.'
                : 'Preview of the closed-hours auto-reply.'}
            </p>
          </div>
        </form>
      </section>

      <Separator />

      {/* Bot Behaviour */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Bot Behaviour</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Pause automation during holidays or when you want every message handled manually.
          </p>
        </div>

        <form onSubmit={(e) => void handleSaveBot(e)} className="space-y-4">
          <div
            className={cn(
              'rounded-lg border p-4 transition-colors',
              botActive ? 'border-green-600/25 bg-green-600/5' : 'border-yellow-600/25 bg-yellow-500/5',
            )}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={botActive}
                onChange={(e) => setBotActive(e.target.checked)}
                className="mt-1 size-4 rounded border-input accent-primary"
              />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Bot active</p>
                  <Badge
                    className={cn(
                      botActive
                        ? 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30'
                        : 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-600/30',
                    )}
                  >
                    {botActive ? 'Live' : 'Paused'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {botActive
                    ? 'Customers get automated booking, FAQs, and menu replies.'
                    : 'Every inbound message goes straight to Conversations — no bot replies.'}
                </p>
              </div>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={savingBot || !botDirty}>
              {savingBot ? 'Saving…' : botDirty ? 'Save bot behaviour' : 'No changes'}
            </Button>
            {botDirty && (
              <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
            )}
          </div>
        </form>
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
