'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SectionSaveFeedback } from '@/components/save-feedback';
import { useMultiSectionSaveFeedback } from '@/lib/use-save-feedback';
import { cn } from '@/lib/utils';
import {
  saveDisplayName,
  saveMessages,
  saveBotActive,
  saveLocation,
  saveBotName,
  saveBotBehaviour,
  saveInactivityMessages,
  saveGoogleReviewUrl,
  type SalonSettings,
} from './actions';
import { BusinessHoursSection } from './business-hours-section';

const WHATSAPP_LIMIT = 4096;

export type { SalonSettings };

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

export function SalonSettingsForm({ initialSettings }: Props) {
  const router = useRouter();
  const { getSection, reportSuccess, reportError } = useMultiSectionSaveFeedback();
  const [salon, setSalon] = useState<SalonSettings>(initialSettings);
  const [saved, setSaved] = useState<SalonSettings>(initialSettings);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('welcome');

  const [tradingName, setTradingName] = useState(initialSettings.tradingName ?? '');
  const [openTime, setOpenTime] = useState(initialSettings.openTime ?? '09:00');
  const [closeTime, setCloseTime] = useState(initialSettings.closeTime ?? '17:00');
  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings.welcomeMessage ?? '');
  const [afterHoursMessage, setAfterHoursMessage] = useState(initialSettings.afterHoursMessage ?? '');
  const [botActive, setBotActive] = useState(initialSettings.botActive);
  const [botAskMarketingConsent, setBotAskMarketingConsent] = useState(initialSettings.botAskMarketingConsent ?? true);
  const [botAllowStaffPick, setBotAllowStaffPick] = useState(initialSettings.botAllowStaffPick ?? true);
  const [botLoyaltyEnabled, setBotLoyaltyEnabled] = useState(initialSettings.botLoyaltyEnabled ?? true);
  const [botRequireDepositStep, setBotRequireDepositStep] = useState(initialSettings.botRequireDepositStep ?? true);
  const [botWinbackEnabled, setBotWinbackEnabled] = useState(initialSettings.botWinbackEnabled ?? true);
  const [botBirthdayEnabled, setBotBirthdayEnabled] = useState(initialSettings.botBirthdayEnabled ?? true);
  const [savingBotBehaviour, setSavingBotBehaviour] = useState(false);

  const [inactivityMsg1, setInactivityMsg1] = useState(initialSettings.inactivityMessage1 ?? '');
  const [inactivityDelay1, setInactivityDelay1] = useState(initialSettings.inactivityMessage1DelayMin ?? 10);
  const [inactivityMsg2, setInactivityMsg2] = useState(initialSettings.inactivityMessage2 ?? '');
  const [inactivityDelay2, setInactivityDelay2] = useState(initialSettings.inactivityMessage2DelayMin ?? 30);
  const [closingMsg, setClosingMsg] = useState(initialSettings.closingMessage ?? '');
  const [savingInactivity, setSavingInactivity] = useState(false);

  const [botNameVal, setBotNameVal] = useState(initialSettings.botName ?? 'Ava');
  const [savingBotName, setSavingBotName] = useState(false);

  const [addressLine, setAddressLine] = useState(initialSettings.addressLine ?? '');
  const [phoneDisplay, setPhoneDisplay] = useState(initialSettings.phoneDisplay ?? '');
  const [contactEmail, setContactEmail] = useState(initialSettings.contactEmail ?? '');
  const [mapsUrl, setMapsUrl] = useState(initialSettings.mapsUrl ?? '');
  const [parkingNotes, setParkingNotes] = useState(initialSettings.parkingNotes ?? '');

  const [googleReviewUrl, setGoogleReviewUrl] = useState(initialSettings.googleReviewUrl ?? '');
  const [savingGoogleReviewUrl, setSavingGoogleReviewUrl] = useState(false);

  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [savingMessages, setSavingMessages] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const applySalon = useCallback((s: SalonSettings) => {
    setSalon(s);
    setSaved(s);
    setTradingName(s.tradingName ?? '');
    setOpenTime(s.openTime ?? '09:00');
    setCloseTime(s.closeTime ?? '17:00');
    setWelcomeMessage(s.welcomeMessage ?? '');
    setAfterHoursMessage(s.afterHoursMessage ?? '');
    setBotActive(s.botActive);
    setBotNameVal(s.botName ?? 'Ava');
    setBotAskMarketingConsent(s.botAskMarketingConsent ?? true);
    setBotAllowStaffPick(s.botAllowStaffPick ?? true);
    setBotLoyaltyEnabled(s.botLoyaltyEnabled ?? true);
    setBotRequireDepositStep(s.botRequireDepositStep ?? true);
    setBotWinbackEnabled(s.botWinbackEnabled ?? true);
    setBotBirthdayEnabled(s.botBirthdayEnabled ?? true);
    setInactivityMsg1(s.inactivityMessage1 ?? '');
    setInactivityDelay1(s.inactivityMessage1DelayMin ?? 10);
    setInactivityMsg2(s.inactivityMessage2 ?? '');
    setInactivityDelay2(s.inactivityMessage2DelayMin ?? 30);
    setClosingMsg(s.closingMessage ?? '');
    setAddressLine(s.addressLine ?? '');
    setPhoneDisplay(s.phoneDisplay ?? '');
    setContactEmail(s.contactEmail ?? '');
    setMapsUrl(s.mapsUrl ?? '');
    setParkingNotes(s.parkingNotes ?? '');
    setGoogleReviewUrl(s.googleReviewUrl ?? '');
  }, []);

  const displayNameDirty = useMemo(() => tradingName !== (saved.tradingName ?? ''), [saved, tradingName]);

  const handleWeekdayHoursChange = useCallback((open: string, close: string) => {
    setOpenTime(open);
    setCloseTime(close);
  }, []);

  const messagesDirty = useMemo(() => {
    return (
      welcomeMessage !== (saved.welcomeMessage ?? '') ||
      afterHoursMessage !== (saved.afterHoursMessage ?? '')
    );
  }, [saved, welcomeMessage, afterHoursMessage]);

  const botDirty = useMemo(() => botActive !== saved.botActive, [saved, botActive]);
  const inactivityDirty = useMemo(() =>
    inactivityMsg1 !== (saved.inactivityMessage1 ?? '') ||
    inactivityDelay1 !== (saved.inactivityMessage1DelayMin ?? 10) ||
    inactivityMsg2 !== (saved.inactivityMessage2 ?? '') ||
    inactivityDelay2 !== (saved.inactivityMessage2DelayMin ?? 30) ||
    closingMsg !== (saved.closingMessage ?? ''),
  [saved, inactivityMsg1, inactivityDelay1, inactivityMsg2, inactivityDelay2, closingMsg]);

  const botBehaviourDirty = useMemo(() =>
    botAskMarketingConsent !== (saved.botAskMarketingConsent ?? true) ||
    botAllowStaffPick !== (saved.botAllowStaffPick ?? true) ||
    botLoyaltyEnabled !== (saved.botLoyaltyEnabled ?? true) ||
    botRequireDepositStep !== (saved.botRequireDepositStep ?? true) ||
    botWinbackEnabled !== (saved.botWinbackEnabled ?? true) ||
    botBirthdayEnabled !== (saved.botBirthdayEnabled ?? true),
  [saved, botAskMarketingConsent, botAllowStaffPick, botLoyaltyEnabled, botRequireDepositStep, botWinbackEnabled, botBirthdayEnabled]);
  const botNameDirty = useMemo(() => botNameVal !== (saved.botName ?? 'Ava'), [saved, botNameVal]);

  const locationDirty = useMemo(() => {
    return (
      addressLine !== (saved.addressLine ?? '') ||
      phoneDisplay !== (saved.phoneDisplay ?? '') ||
      contactEmail !== (saved.contactEmail ?? '') ||
      mapsUrl !== (saved.mapsUrl ?? '') ||
      parkingNotes !== (saved.parkingNotes ?? '')
    );
  }, [saved, addressLine, phoneDisplay, contactEmail, mapsUrl, parkingNotes]);

  const googleReviewUrlDirty = useMemo(
    () => googleReviewUrl !== (saved.googleReviewUrl ?? ''),
    [saved, googleReviewUrl],
  );

  const defaultWelcome = `Welcome to ${salon.name}! Reply with a number:`;
  const defaultAfterHours =
    `We're closed for live support right now (our hours are ${openTime}–${closeTime}). ` +
    `Someone from our team will contact you when we open. ` +
    `Customers can still book, check loyalty, and browse FAQs 24/7.`;

  const previewWelcome = welcomeMessage.trim() || defaultWelcome;
  const previewAfterHours = afterHoursMessage.trim() || defaultAfterHours;
  const previewText = previewMode === 'welcome' ? previewWelcome : previewAfterHours;

  const welcomeOver = welcomeMessage.length > WHATSAPP_LIMIT;
  const afterHoursOver = afterHoursMessage.length > WHATSAPP_LIMIT;

  async function handleSaveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tradingName.trim();
    if (!trimmed) {
      reportError('displayName', 'Enter a business display name');
      return;
    }
    setSavingDisplayName(true);
    try {
      const result = await saveDisplayName(trimmed);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('displayName', 'Business display name saved');
        router.refresh();
      } else {
        reportError('displayName', result.error ?? 'Save failed');
      }
    } catch {
      reportError('displayName', 'Save failed — please try again');
    } finally {
      setSavingDisplayName(false);
    }
  }

  async function handleSaveMessages(e: React.FormEvent) {
    e.preventDefault();
    if (welcomeOver || afterHoursOver) {
      reportError('messages', `Messages must be under ${WHATSAPP_LIMIT.toLocaleString()} characters`);
      return;
    }
    setSavingMessages(true);
    try {
      const result = await saveMessages(
        welcomeMessage.trim() || null,
        afterHoursMessage.trim() || null,
      );
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('messages', 'Bot messages saved');
      } else {
        reportError('messages', result.error ?? 'Save failed');
      }
    } catch {
      reportError('messages', 'Save failed — please try again');
    } finally {
      setSavingMessages(false);
    }
  }

  async function handleSaveInactivity(e: React.FormEvent) {
    e.preventDefault();
    if (inactivityDelay2 <= inactivityDelay1) {
      reportError('inactivity', 'Second follow-up must be sent later than the first');
      return;
    }
    setSavingInactivity(true);
    try {
      const result = await saveInactivityMessages({
        inactivityMessage1: inactivityMsg1.trim() || null,
        inactivityMessage1DelayMin: inactivityDelay1,
        inactivityMessage2: inactivityMsg2.trim() || null,
        inactivityMessage2DelayMin: inactivityDelay2,
        closingMessage: closingMsg.trim() || null,
      });
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('inactivity', 'Follow-up messages saved');
      } else {
        reportError('inactivity', result.error ?? 'Save failed');
      }
    } catch {
      reportError('inactivity', 'Save failed — please try again');
    } finally {
      setSavingInactivity(false);
    }
  }

  async function handleSaveBotBehaviour(e: React.FormEvent) {
    e.preventDefault();
    setSavingBotBehaviour(true);
    try {
      const result = await saveBotBehaviour({
        botAskMarketingConsent,
        botAllowStaffPick,
        botLoyaltyEnabled,
        botRequireDepositStep,
        botWinbackEnabled,
        botBirthdayEnabled,
      });
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('botBehaviour', 'Conversation flow settings saved');
      } else {
        reportError('botBehaviour', result.error ?? 'Save failed');
      }
    } catch {
      reportError('botBehaviour', 'Save failed — please try again');
    } finally {
      setSavingBotBehaviour(false);
    }
  }

  async function handleSaveBotName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = botNameVal.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 40) {
      reportError('botName', 'Bot name must be 2–40 characters');
      return;
    }
    setSavingBotName(true);
    try {
      const result = await saveBotName(trimmed);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('botName', `Bot name updated to "${trimmed}"`);
      } else {
        reportError('botName', result.error ?? 'Save failed');
      }
    } catch {
      reportError('botName', 'Save failed — please try again');
    } finally {
      setSavingBotName(false);
    }
  }

  async function handleSaveLocation(e: React.FormEvent) {
    e.preventDefault();
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      reportError('location', 'Enter a valid email address');
      return;
    }
    if (mapsUrl.trim() && !/^https?:\/\//.test(mapsUrl.trim())) {
      reportError('location', 'Maps link must start with https://');
      return;
    }
    setSavingLocation(true);
    try {
      const result = await saveLocation(
        addressLine.trim() || null,
        phoneDisplay.trim() || null,
        contactEmail.trim() || null,
        mapsUrl.trim() || null,
        parkingNotes.trim() || null,
      );
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('location', 'Location & contact details saved');
      } else {
        reportError('location', result.error ?? 'Save failed');
      }
    } catch {
      reportError('location', 'Save failed — please try again');
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleSaveGoogleReviewUrl(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = googleReviewUrl.trim();
    if (trimmed.length > 2048) {
      reportError('googleReview', 'Google Review URL is too long (max 2048 characters)');
      return;
    }
    if (trimmed && !trimmed.startsWith('https://')) {
      reportError('googleReview', 'Google Review URL must start with https://');
      return;
    }
    setSavingGoogleReviewUrl(true);
    try {
      const result = await saveGoogleReviewUrl(trimmed || null);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('googleReview', 'Google Review URL saved');
      } else {
        reportError('googleReview', result.error ?? 'Save failed');
      }
    } catch {
      reportError('googleReview', 'Save failed — please try again');
    } finally {
      setSavingGoogleReviewUrl(false);
    }
  }

  async function handleSaveBot(e: React.FormEvent) {
    e.preventDefault();
    setSavingBot(true);
    try {
      const result = await saveBotActive(botActive);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess(
          'botActive',
          botActive ? 'Bot is live on WhatsApp' : 'Bot paused — team will handle all messages',
        );
      } else {
        reportError('botActive', result.error ?? 'Save failed');
      }
    } catch {
      reportError('botActive', 'Save failed — please try again');
    } finally {
      setSavingBot(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Bot name */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">WhatsApp bot name</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The name your bot introduces itself as to customers (e.g. &quot;Hi! I&apos;m <strong>{botNameVal || salon.botName}</strong>, your booking assistant&quot;).
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveBotName(e)} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="botName">Bot name</Label>
            <Input
              id="botName"
              value={botNameVal}
              onChange={(e) => setBotNameVal(e.target.value)}
              placeholder="e.g. Ava"
              maxLength={40}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={!botNameDirty || savingBotName}>
            {savingBotName ? 'Saving…' : 'Save bot name'}
          </Button>
          <SectionSaveFeedback feedback={getSection('botName')} />
        </form>
      </section>

      <Separator />

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
          <SectionSaveFeedback feedback={getSection('displayName')} />
        </form>
      </section>

      <Separator />

      <BusinessHoursSection
        fallbackTimezone={initialSettings.timezone || 'Africa/Johannesburg'}
        onWeekdayHoursChange={handleWeekdayHoursChange}
      />

      <Separator />

      {/* WhatsApp Bot Messages */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">WhatsApp bot messages</h3>
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
                Sent when a customer chooses &quot;Talk to a human&quot; outside business hours. Bookings, FAQs, and loyalty still work 24/7.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingMessages || !messagesDirty || welcomeOver || afterHoursOver}
                >
                  {savingMessages ? 'Saving…' : 'Save bot messages'}
                </Button>
                {messagesDirty && (
                  <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
                )}
              </div>
              <SectionSaveFeedback feedback={getSection('messages')} />
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
                : 'Preview of the reply when someone asks for a human outside your opening hours.'}
            </p>
          </div>
        </form>
      </section>

      <Separator />

      {/* Location & Contact */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Location &amp; Contact</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Shown to customers when they select &quot;Find us&quot; or &quot;Contact us&quot; on WhatsApp.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveLocation(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address-line">Street address</Label>
            <Input
              id="address-line"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="123 Main Street, Sandton, 2196"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone-display">Phone number</Label>
              <Input
                id="phone-display"
                value={phoneDisplay}
                onChange={(e) => setPhoneDisplay(e.target.value)}
                placeholder="+27 11 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Business email</Label>
              <Input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@yoursalon.co.za"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maps-url">
              Maps / directions link
              <span className="text-xs font-normal text-muted-foreground ml-2">Google Maps, Waze, etc.</span>
            </Label>
            <Input
              id="maps-url"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/?q=..."
            />
            <p className="text-xs text-muted-foreground">
              Paste the share link from Google Maps or Waze — customers tap it to open directions.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parking-notes">Parking notes <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="parking-notes"
              value={parkingNotes}
              onChange={(e) => setParkingNotes(e.target.value)}
              placeholder="Free parking at rear, entrance on Smith St"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingLocation || !locationDirty}>
                {savingLocation ? 'Saving…' : locationDirty ? 'Save location & contact' : 'No changes'}
              </Button>
              {locationDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
            </div>
            <SectionSaveFeedback feedback={getSection('location')} />
          </div>
        </form>
      </section>

      <Separator />

      {/* Bot Behaviour */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Bot behaviour</h3>
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingBot || !botDirty}>
                {savingBot ? 'Saving…' : 'Save bot behaviour'}
              </Button>
              {botDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
            </div>
            <SectionSaveFeedback feedback={getSection('botActive')} />
          </div>
        </form>
      </section>

      <Separator />

      {/* Bot conversation flow */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Conversation flow</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Control which steps the bot runs when a customer messages for the first time.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveBotBehaviour(e)} className="space-y-3 max-w-lg">
          {[
            {
              key: 'botAskMarketingConsent' as const,
              value: botAskMarketingConsent,
              set: setBotAskMarketingConsent,
              label: 'Ask for marketing consent (POPIA)',
              description: 'Prompts new customers to accept or decline marketing messages before entering the menu.',
            },
            {
              key: 'botAllowStaffPick' as const,
              value: botAllowStaffPick,
              set: setBotAllowStaffPick,
              label: 'Let customers choose their stylist',
              description: 'Shows a staff selection step after the customer picks a service. Disable to auto-assign the next available.',
            },
            {
              key: 'botLoyaltyEnabled' as const,
              value: botLoyaltyEnabled,
              set: setBotLoyaltyEnabled,
              label: 'Loyalty rewards in bot menu',
              description: 'Shows "My rewards / loyalty" as a menu option so customers can check their stamp balance.',
            },
            {
              key: 'botRequireDepositStep' as const,
              value: botRequireDepositStep,
              set: setBotRequireDepositStep,
              label: 'Require deposit / payment before confirming',
              description: 'When a service has a deposit or full-pay requirement, the bot sends a payment link before confirming. Disable to confirm immediately and collect payment in-person.',
            },
            {
              key: 'botWinbackEnabled' as const,
              value: botWinbackEnabled,
              set: setBotWinbackEnabled,
              label: 'Win-back messages (21-day inactive)',
              description: 'Daily at 09:00 — messages customers who have not visited in 21–60 days. Requires marketing consent. Max 50 customers per day.',
            },
            {
              key: 'botBirthdayEnabled' as const,
              value: botBirthdayEnabled,
              set: setBotBirthdayEnabled,
              label: 'Birthday messages',
              description: 'Daily at 08:00 — sends a birthday greeting with a treat offer. Requires date of birth on file and marketing consent.',
            },
          ].map(({ key, value, set, label, description }) => (
            <div key={key} className="rounded-lg border p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => set(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input accent-primary"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-snug">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </label>
            </div>
          ))}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingBotBehaviour || !botBehaviourDirty}>
                {savingBotBehaviour ? 'Saving…' : 'Save flow settings'}
              </Button>
              {botBehaviourDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
            </div>
            <SectionSaveFeedback feedback={getSection('botBehaviour')} />
          </div>
        </form>
      </section>

      <Separator />

      {/* Google Reviews */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Google Reviews</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customers who rate their experience <span className="font-medium text-foreground">5 stars</span> will automatically receive this link via WhatsApp to leave a Google review.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveGoogleReviewUrl(e)} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="google-review-url">Google Review URL</Label>
            <Input
              id="google-review-url"
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/YOUR_REVIEW_LINK/review"
              maxLength={2048}
            />
            <p className="text-xs text-muted-foreground">
              Paste your Google Business review link. Find it in Google Business Profile → &quot;Get more reviews&quot;. Leave blank to disable.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingGoogleReviewUrl || !googleReviewUrlDirty}>
                {savingGoogleReviewUrl ? 'Saving…' : 'Save review URL'}
              </Button>
              {googleReviewUrlDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
            </div>
            <SectionSaveFeedback feedback={getSection('googleReview')} />
          </div>
        </form>
      </section>

      <Separator />

      {/* Inactivity & closing messages */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Follow-up &amp; closing messages</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically re-engage customers who go quiet, and leave them with a warm sign-off when the conversation closes.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveInactivity(e)} className="space-y-6 max-w-lg">
          {/* First follow-up */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">First follow-up</p>
            <p className="text-xs text-muted-foreground">Sent when a customer stops replying. Leave blank to skip.</p>
            <div className="flex items-center gap-3">
              <Label htmlFor="inactivityDelay1" className="text-xs whitespace-nowrap">Send after</Label>
              <select
                id="inactivityDelay1"
                value={inactivityDelay1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setInactivityDelay1(v);
                  // bump delay2 if it's no longer strictly greater
                  if (inactivityDelay2 <= v) {
                    const next = [15, 20, 30, 45, 60].find((m) => m > v);
                    if (next) setInactivityDelay2(next);
                  }
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {[5, 10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>{m} minutes of silence</option>
                ))}
              </select>
            </div>
            <textarea
              value={inactivityMsg1}
              onChange={(e) => setInactivityMsg1(e.target.value)}
              placeholder={`Hi! Still there? Just reply when you're ready and we'll pick up right where we left off 😊`}
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground text-right">{inactivityMsg1.length} / 500</p>
          </div>

          {/* Second follow-up */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Second follow-up</p>
            <p className="text-xs text-muted-foreground">A final nudge before the conversation goes idle. Leave blank to skip.</p>
            <div className="flex items-center gap-3">
              <Label htmlFor="inactivityDelay2" className="text-xs whitespace-nowrap">Send after</Label>
              <select
                id="inactivityDelay2"
                value={inactivityDelay2}
                onChange={(e) => setInactivityDelay2(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {[15, 20, 30, 45, 60].filter((m) => m > inactivityDelay1).map((m) => (
                  <option key={m} value={m}>{m} minutes of silence</option>
                ))}
              </select>
              {inactivityDelay2 <= inactivityDelay1 && (
                <p className="text-xs text-destructive">Must be later than the first follow-up ({inactivityDelay1} min)</p>
              )}
            </div>
            <textarea
              value={inactivityMsg2}
              onChange={(e) => setInactivityMsg2(e.target.value)}
              placeholder={`No worries — we'll be here whenever you're ready. You can always start fresh by messaging us again 💚`}
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground text-right">{inactivityMsg2.length} / 500</p>
          </div>

          {/* Closing message */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Closing message</p>
            <p className="text-xs text-muted-foreground">Sent when a booking is confirmed or the conversation wraps up. Leave blank to skip.</p>
            <textarea
              value={closingMsg}
              onChange={(e) => setClosingMsg(e.target.value)}
              placeholder={`Thank you for contacting ${salon.tradingName ?? salon.name}! We appreciate your support. Remember — just send us a text and we'll respond faster than you can say "${salon.tradingName ?? salon.name}" 😄`}
              rows={4}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground text-right">{closingMsg.length} / 500</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingInactivity || !inactivityDirty}>
                {savingInactivity ? 'Saving…' : 'Save messages'}
              </Button>
              {inactivityDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
            </div>
            <SectionSaveFeedback feedback={getSection('inactivity')} />
          </div>
        </form>
      </section>
    </div>
  );
}
