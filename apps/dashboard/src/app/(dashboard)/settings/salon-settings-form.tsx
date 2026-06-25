'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SectionSaveFeedback } from '@/components/save-feedback';
import { CollapsibleSection } from '@/components/collapsible-section';
import { useMultiSectionSaveFeedback } from '@/lib/use-save-feedback';
import { cn } from '@/lib/utils';
import { PLATFORM_BOT_NAME } from '@/lib/bot-branding';
import {
  saveDisplayName,
  saveMessages,
  saveBotActive,
  saveLocation,
  saveBusinessName,
  saveInactivityMessages,
  saveGoogleReviewSettings,
  saveCurrentSpecial,
  saveLoyaltyProgram,
  saveWhatsAppConfig,
  type SalonSettings,
} from './actions';
import { ConversationFlowSection } from './conversation-flow-section';
import { BusinessHoursSection } from './business-hours-section';
import {
  FIRST_FOLLOW_UP_TEMPLATES,
  SECOND_FOLLOW_UP_TEMPLATES,
  CLOSING_MESSAGE_TEMPLATES,
  FOLLOW_UP_MESSAGE_SETS,
  type FollowUpMessageSet,
} from './follow-up-message-templates';
import { FollowUpTemplatePicker, FollowUpCharCount } from './follow-up-template-picker';
import {
  resolveMessageSet,
  sanitizeFollowUpMessage,
  validateFollowUpSettings,
} from '@/lib/follow-up-template-utils';

const WHATSAPP_LIMIT = 4096;

function BookingLinkCopy({ slug, phoneDisplay }: { slug: string; phoneDisplay: string | null }) {
  const [copied, setCopied] = useState(false);
  // Derive E.164 digits from phoneDisplay (strip non-digits, add country code if needed)
  const e164 = phoneDisplay
    ? phoneDisplay.replace(/\D/g, '').replace(/^0/, '27')
    : '';
  const url = e164
    ? `https://wa.me/${e164}?text=${encodeURIComponent(`Hi, I'd like to book`)}`
    : `https://wa.me/?text=${encodeURIComponent(`Hi, I'd like to book at ${slug}`)}`;
  return (
    <div className="space-y-2 max-w-md">
      {!e164 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Add your phone number in the Location section to generate a complete booking link.
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono text-muted-foreground select-all truncate"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

export type { SalonSettings };

type PreviewMode = 'welcome' | 'afterHours';

interface Props {
  initialSettings: SalonSettings;
  loyaltyProgram?: { stampsPerReward: number; rewardDescription: string } | null;
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
    <div className="rounded-xl overflow-hidden border shadow-sm bg-muted/20 dark:bg-[#0b141a]">
      <div className="bg-[#075e54] dark:bg-[#1f2c34] px-4 py-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-[#25d366]/30 flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {salonName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium leading-tight truncate">{salonName}</p>
          <p className="text-white/70 text-xs">{botName} · online</p>
        </div>
      </div>
      <div className="p-4 min-h-[160px] bg-muted/15 dark:bg-[#0b141a]">
        <div className="max-w-[92%] rounded-lg rounded-tl-none bg-card shadow-sm px-3 py-2 border border-border/60">
          <p className="text-sm whitespace-pre-wrap break-words text-foreground">
            {message}
          </p>
          <p className="text-[10px] text-muted-foreground text-right mt-1">{timeLabel}</p>
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

export function SalonSettingsForm({ initialSettings, loyaltyProgram }: Props) {
  const router = useRouter();
  const { getSection, reportSuccess, reportError } = useMultiSectionSaveFeedback();
  const [salon, setSalon] = useState<SalonSettings>(initialSettings);
  const [saved, setSaved] = useState<SalonSettings>(initialSettings);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('welcome');

  const [tradingName, setTradingName] = useState(initialSettings.tradingName ?? '');
  const [businessName, setBusinessName] = useState(initialSettings.name ?? '');
  const [openTime, setOpenTime] = useState(initialSettings.openTime ?? '09:00');
  const [closeTime, setCloseTime] = useState(initialSettings.closeTime ?? '17:00');
  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings.welcomeMessage ?? '');
  const [afterHoursMessage, setAfterHoursMessage] = useState(initialSettings.afterHoursMessage ?? '');
  const [botActive, setBotActive] = useState(initialSettings.botActive);

  const [inactivityMsg1, setInactivityMsg1] = useState(initialSettings.inactivityMessage1 ?? '');
  const [inactivityDelay1, setInactivityDelay1] = useState(initialSettings.inactivityMessage1DelayMin ?? 10);
  const [inactivityMsg2, setInactivityMsg2] = useState(initialSettings.inactivityMessage2 ?? '');
  const [inactivityDelay2, setInactivityDelay2] = useState(initialSettings.inactivityMessage2DelayMin ?? 30);
  const [closingMsg, setClosingMsg] = useState(initialSettings.closingMessage ?? '');
  const [templateApplyHint, setTemplateApplyHint] = useState<string | null>(null);
  const [savingInactivity, setSavingInactivity] = useState(false);

  const [savingBusinessName, setSavingBusinessName] = useState(false);

  const [addressLine, setAddressLine] = useState(initialSettings.addressLine ?? '');
  const [phoneDisplay, setPhoneDisplay] = useState(initialSettings.phoneDisplay ?? '');
  const [contactEmail, setContactEmail] = useState(initialSettings.contactEmail ?? '');
  const [mapsUrl, setMapsUrl] = useState(initialSettings.mapsUrl ?? '');
  const [parkingNotes, setParkingNotes] = useState(initialSettings.parkingNotes ?? '');

  const [googleReviewUrl, setGoogleReviewUrl] = useState(initialSettings.googleReviewUrl ?? '');
  const [savingGoogleReviewUrl, setSavingGoogleReviewUrl] = useState(false);

  const [currentSpecial, setCurrentSpecial] = useState(initialSettings.currentSpecial ?? '');
  const [savingSpecial, setSavingSpecial] = useState(false);

  // Phase 4 — loyalty programme
  const [loyaltyStampsPerReward, setLoyaltyStampsPerReward] = useState(loyaltyProgram?.stampsPerReward ?? 10);
  const [loyaltyRewardDescription, setLoyaltyRewardDescription] = useState(loyaltyProgram?.rewardDescription ?? '');
  const [savedLoyaltyStamps, setSavedLoyaltyStamps] = useState(loyaltyProgram?.stampsPerReward ?? 10);
  const [savedLoyaltyDesc, setSavedLoyaltyDesc] = useState(loyaltyProgram?.rewardDescription ?? '');
  const [savingLoyalty, setSavingLoyalty] = useState(false);

  const [whatsappPhoneId, setWhatsappPhoneId] = useState(initialSettings.whatsappPhoneId ?? '');
  const [savedWhatsappPhoneId, setSavedWhatsappPhoneId] = useState(initialSettings.whatsappPhoneId ?? '');
  const [whatsappJustSaved, setWhatsappJustSaved] = useState(false);
  const [savingWhatsappPhoneId, setSavingWhatsappPhoneId] = useState(false);

  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [savingMessages, setSavingMessages] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const applySalon = useCallback((s: SalonSettings) => {
    setSalon(s);
    setSaved(s);
    setTradingName(s.tradingName ?? '');
    setBusinessName(s.name ?? '');
    setOpenTime(s.openTime ?? '09:00');
    setCloseTime(s.closeTime ?? '17:00');
    setWelcomeMessage(s.welcomeMessage ?? '');
    setAfterHoursMessage(s.afterHoursMessage ?? '');
    setBotActive(s.botActive);
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
    setCurrentSpecial(s.currentSpecial ?? '');
    const phoneId = s.whatsappPhoneId?.trim() ?? '';
    setWhatsappPhoneId(phoneId);
    setSavedWhatsappPhoneId(phoneId);
  }, []);

  const displayNameDirty = useMemo(() => tradingName !== (saved.tradingName ?? ''), [saved, tradingName]);
  const businessNameDirty = useMemo(() => businessName.trim() !== (saved.name ?? ''), [saved, businessName]);
  const whatsappPhoneIdDirty = useMemo(
    () => whatsappPhoneId.trim() !== savedWhatsappPhoneId.trim(),
    [savedWhatsappPhoneId, whatsappPhoneId],
  );

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

  const currentSpecialDirty = useMemo(
    () => currentSpecial !== (saved.currentSpecial ?? ''),
    [saved, currentSpecial],
  );

  const loyaltyDirty = useMemo(
    () => loyaltyStampsPerReward !== savedLoyaltyStamps || loyaltyRewardDescription !== savedLoyaltyDesc,
    [loyaltyStampsPerReward, loyaltyRewardDescription, savedLoyaltyStamps, savedLoyaltyDesc],
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

  const salonDisplayName = salon.tradingName ?? salon.name;

  function applyMessageSet(set: FollowUpMessageSet) {
    const resolved = resolveMessageSet(set, salonDisplayName);
    setInactivityMsg1(resolved.msg1);
    setInactivityMsg2(resolved.msg2);
    setClosingMsg(resolved.closing);
    setTemplateApplyHint(`Applied "${set.label}" preset — review and save when ready.`);
  }

  async function handleSaveInactivity(e: React.FormEvent) {
    e.preventDefault();
    setTemplateApplyHint(null);

    const validation = validateFollowUpSettings({
      inactivityMessage1: inactivityMsg1,
      inactivityMessage1DelayMin: inactivityDelay1,
      inactivityMessage2: inactivityMsg2,
      inactivityMessage2DelayMin: inactivityDelay2,
      closingMessage: closingMsg,
    });
    if (!validation.ok) {
      reportError('inactivity', validation.message);
      return;
    }

    if (inactivityDelay2 <= inactivityDelay1) {
      reportError('inactivity', 'Second follow-up must be sent later than the first');
      return;
    }
    setSavingInactivity(true);
    try {
      const result = await saveInactivityMessages({
        inactivityMessage1: sanitizeFollowUpMessage(inactivityMsg1) || null,
        inactivityMessage1DelayMin: inactivityDelay1,
        inactivityMessage2: sanitizeFollowUpMessage(inactivityMsg2) || null,
        inactivityMessage2DelayMin: inactivityDelay2,
        closingMessage: sanitizeFollowUpMessage(closingMsg) || null,
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

  async function handleSaveBusinessName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = businessName.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 120) {
      reportError('businessName', 'Business name must be 2–120 characters');
      return;
    }
    setSavingBusinessName(true);
    try {
      const result = await saveBusinessName(trimmed);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('businessName', `Business name updated to "${trimmed}"`);
        router.refresh();
      } else {
        reportError('businessName', result.error ?? 'Save failed');
      }
    } catch {
      reportError('businessName', 'Save failed — please try again');
    } finally {
      setSavingBusinessName(false);
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
      const result = await saveGoogleReviewSettings(trimmed || null);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('googleReview', 'Google review URL saved');
      } else {
        reportError('googleReview', result.error ?? 'Save failed');
      }
    } catch {
      reportError('googleReview', 'Save failed — please try again');
    } finally {
      setSavingGoogleReviewUrl(false);
    }
  }

  async function handleSaveCurrentSpecial(e: React.FormEvent) {
    e.preventDefault();
    if (currentSpecial.trim().length > 160) {
      reportError('currentSpecial', 'Special must be 160 characters or fewer');
      return;
    }
    setSavingSpecial(true);
    try {
      const result = await saveCurrentSpecial(currentSpecial.trim() || null);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('currentSpecial', 'Current special saved');
      } else {
        reportError('currentSpecial', result.error ?? 'Save failed');
      }
    } catch {
      reportError('currentSpecial', 'Save failed — please try again');
    } finally {
      setSavingSpecial(false);
    }
  }

  async function handleSaveLoyalty(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(loyaltyStampsPerReward) || loyaltyStampsPerReward < 1 || loyaltyStampsPerReward > 100) {
      reportError('loyalty', 'Stamps per reward must be between 1 and 100');
      return;
    }
    if (loyaltyRewardDescription.length > 200) {
      reportError('loyalty', 'Reward description must be 200 characters or fewer');
      return;
    }
    setSavingLoyalty(true);
    try {
      const result = await saveLoyaltyProgram(loyaltyStampsPerReward, loyaltyRewardDescription);
      if (result.error) {
        reportError('loyalty', result.error);
      } else {
        setSavedLoyaltyStamps(result.stampsPerReward ?? loyaltyStampsPerReward);
        setSavedLoyaltyDesc(result.rewardDescription ?? loyaltyRewardDescription);
        reportSuccess('loyalty', 'Loyalty programme saved');
      }
    } catch {
      reportError('loyalty', 'Save failed — please try again');
    } finally {
      setSavingLoyalty(false);
    }
  }

  async function handleSaveWhatsAppPhoneId(e: React.FormEvent) {
    e.preventDefault();
    setSavingWhatsappPhoneId(true);
    setWhatsappJustSaved(false);
    try {
      const result = await saveWhatsAppConfig(whatsappPhoneId || null);
      if (result.salon) {
        applySalon(result.salon);
        const saved = result.salon.whatsappPhoneId?.trim() ?? whatsappPhoneId.trim();
        setWhatsappPhoneId(saved);
        setSavedWhatsappPhoneId(saved);
        setWhatsappJustSaved(true);
        reportSuccess(
          'whatsappPhoneId',
          saved
            ? 'Phone Number ID saved — WhatsApp Cloud API is configured'
            : 'Phone Number ID cleared',
        );
        router.refresh();
      } else {
        reportError('whatsappPhoneId', result.error ?? 'Save failed — please try again');
      }
    } catch {
      reportError('whatsappPhoneId', 'Save failed — please try again');
    } finally {
      setSavingWhatsappPhoneId(false);
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
      {/* WhatsApp business name */}
      <section id="settings-business-name" data-section-label="Business name" className="dashboard-section-anchor">
      <CollapsibleSection
        id="settings-business-name-toggle"
        title="WhatsApp business name"
        subtitle={
          <>
            The name customers see in WhatsApp messages and greetings (e.g. &quot;Welcome to{' '}
            <strong>{businessName || salon.name}</strong>!&quot;). Your booking assistant is always{' '}
            <strong>{salon.botName || PLATFORM_BOT_NAME}</strong> — that name is part of MarineFlow branding.
          </>
        }
        manualToggle
        className="border-0 bg-transparent shadow-none"
      >
        <form onSubmit={(e) => void handleSaveBusinessName(e)} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Solupair Hair Studio"
              maxLength={120}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={!businessNameDirty || savingBusinessName}>
            {savingBusinessName ? 'Saving…' : 'Save business name'}
          </Button>
          <SectionSaveFeedback feedback={getSection('businessName')} />
        </form>
      </CollapsibleSection>
      </section>

      <Separator />

      {/* Dashboard display name */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Dashboard display name</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Optional label shown in your dashboard sidebar only. Does not change WhatsApp messages — use the business
            name above for customer-facing copy.
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

      {/* Booking link */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Booking link</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Share this link with customers to let them start a WhatsApp booking conversation.
          </p>
        </div>
        <BookingLinkCopy slug={salon.slug} phoneDisplay={salon.phoneDisplay ?? null} />
      </section>

      <Separator />

      {/* WhatsApp Cloud API Phone Number ID */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">WhatsApp Cloud API — Phone Number ID</h3>
          {savedWhatsappPhoneId.trim() ? (
            <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">
              Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="border-destructive text-destructive">
              Not set
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Found in Meta Business Manager → WhatsApp → API Setup. Required for the bot to receive and send messages via Meta Cloud API.
        </p>
        <form className="space-y-3" onSubmit={(e) => void handleSaveWhatsAppPhoneId(e)}>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="whatsappPhoneId">Phone Number ID</Label>
              <Input
                id="whatsappPhoneId"
                placeholder="e.g. 123456789012345"
                value={whatsappPhoneId}
                onChange={(e) => {
                  setWhatsappPhoneId(e.target.value);
                  setWhatsappJustSaved(false);
                }}
                inputMode="numeric"
                pattern="\d*"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={savingWhatsappPhoneId || (!whatsappPhoneIdDirty && Boolean(savedWhatsappPhoneId.trim()))}
              variant={whatsappJustSaved ? 'outline' : 'default'}
              className={whatsappJustSaved ? 'border-green-600 text-green-700 dark:text-green-400' : undefined}
            >
              {savingWhatsappPhoneId ? 'Saving…' : whatsappJustSaved ? 'Saved ✓' : 'Save'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {whatsappPhoneIdDirty && savedWhatsappPhoneId.trim() && (
              <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
            )}
            <SectionSaveFeedback feedback={getSection('whatsappPhoneId')} className="flex-1 min-w-[12rem]" />
          </div>
        </form>
        {savedWhatsappPhoneId.trim() ? (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'rounded-lg border px-4 py-3 text-sm',
              whatsappJustSaved
                ? 'border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                : 'border-green-200 bg-green-50/80 text-green-800 dark:border-green-900 dark:bg-green-950/20 dark:text-green-300',
            )}
          >
            <p className="font-medium">
              {whatsappJustSaved ? '✓ Saved successfully' : '✓ Phone Number ID configured'}
            </p>
            <p className="mt-1 text-xs opacity-90">
              ID <span className="font-mono">{savedWhatsappPhoneId}</span> — the bot can receive WhatsApp messages via Meta Cloud API.
            </p>
          </div>
        ) : (
          <p className="text-xs text-destructive font-medium">
            ⚠️ Phone Number ID is not set — the bot cannot receive WhatsApp messages until this is configured.
          </p>
        )}
      </section>

      <Separator />

      <BusinessHoursSection
        fallbackTimezone={initialSettings.timezone || 'Africa/Johannesburg'}
        onWeekdayHoursChange={handleWeekdayHoursChange}
      />

      <Separator />

      {/* WhatsApp Bot Messages */}
      <section id="settings-messages" data-section-label="Bot messages" className="dashboard-section-anchor">
      <CollapsibleSection
        id="settings-messages-toggle"
        title="WhatsApp bot messages"
        subtitle="Customise automated replies. Leave blank to use smart defaults."
        manualToggle
        className="border-0 bg-transparent shadow-none"
      >
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
                Sent when a customer chooses &quot;Talk to a human&quot; outside business hours. Appointments, Bot FAQs, and loyalty still work 24/7.
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
              botName={salon.botName || PLATFORM_BOT_NAME}
            />
            <p className="text-xs text-muted-foreground">
              {previewMode === 'welcome'
                ? 'Preview uses your welcome text plus the numbered menu on the bot.'
                : 'Preview of the reply when someone asks for a human outside your opening hours.'}
            </p>
          </div>
        </form>
      </CollapsibleSection>
      </section>

      <Separator />

      {/* Current Special */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Current Special</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Shown at the bottom of the WhatsApp welcome menu. Clear it to remove. Max 160 characters.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveCurrentSpecial(e)} className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="current-special">Active special / promotion</Label>
              <span className={`text-xs tabular-nums ${currentSpecial.length > 160 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {currentSpecial.length} / 160
              </span>
            </div>
            <Input
              id="current-special"
              value={currentSpecial}
              onChange={(e) => setCurrentSpecial(e.target.value)}
              placeholder="e.g. 20% off all colour services this week — reply 1 to book"
              maxLength={200}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              {currentSpecialDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
              <SectionSaveFeedback feedback={getSection('currentSpecial')} />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={savingSpecial || !currentSpecialDirty}
            >
              {savingSpecial ? 'Saving…' : 'Save special'}
            </Button>
          </div>
        </form>
      </section>

      <Separator />

      {/* Location & Contact */}
      <section id="settings-location" data-section-label="Location" className="dashboard-section-anchor">
      <CollapsibleSection
        id="settings-location-toggle"
        title="Location & Contact"
        subtitle='Shown to customers when they select "Find us" or "Contact us" on WhatsApp.'
        manualToggle
        className="border-0 bg-transparent shadow-none"
      >
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
      </CollapsibleSection>
      </section>

      <Separator />

      {/* Bot Behaviour */}
      <section id="settings-bot-behaviour" data-section-label="Bot behaviour" className="dashboard-section-anchor">
      <CollapsibleSection
        id="settings-bot-behaviour-toggle"
        title="Bot behaviour"
        subtitle="Pause automation during holidays or when you want every message handled manually."
        manualToggle
        className="border-0 bg-transparent shadow-none"
      >
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
      </CollapsibleSection>
      </section>

      <Separator />

      <ConversationFlowSection initialSettings={salon} onSaved={applySalon} />

      <Separator />

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold">Power Features</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Reminders, win-back, review incentives, booking rules, and campaign templates live in one place — not here.
          </p>
        </div>
        <Link href="/automations" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Open Power Features
        </Link>
      </section>

      <Separator />

      {/* Google Reviews — URL only; toggles live under Power Features */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Google Reviews</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Paste your Google Business review link here. Enable review requests and incentives under{' '}
            <Link href="/automations" className="text-primary underline-offset-4 hover:underline">
              Power Features
            </Link>
            .
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
              Find it in Google Business Profile → &quot;Get more reviews&quot;. Leave blank to disable review links.
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
          <div className="space-y-2 rounded-lg border border-dashed p-4 bg-muted/30">
            <p className="text-sm font-medium">Quick apply all three</p>
            <p className="text-xs text-muted-foreground">
              One tap fills every message — toggle individual presets below or edit before saving.
            </p>
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UP_MESSAGE_SETS.map((set) => (
                <Button
                  key={set.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  title={set.description}
                  onClick={() => applyMessageSet(set)}
                >
                  {set.label}
                </Button>
              ))}
            </div>
            {templateApplyHint && (
              <p className="text-xs text-primary">{templateApplyHint}</p>
            )}
          </div>

          {/* First follow-up */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">First follow-up</p>
            <p className="text-xs text-muted-foreground">Sent when a customer stops replying. Leave blank to skip.</p>
            <FollowUpTemplatePicker
              templates={FIRST_FOLLOW_UP_TEMPLATES}
              salonName={salonDisplayName}
              value={inactivityMsg1}
              onChange={setInactivityMsg1}
              onApplyError={(msg) => setTemplateApplyHint(msg)}
            />
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
            <FollowUpCharCount value={inactivityMsg1} />
          </div>

          {/* Second follow-up */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Second follow-up</p>
            <p className="text-xs text-muted-foreground">A final nudge before the conversation goes idle. Leave blank to skip.</p>
            <FollowUpTemplatePicker
              templates={SECOND_FOLLOW_UP_TEMPLATES}
              salonName={salonDisplayName}
              value={inactivityMsg2}
              onChange={setInactivityMsg2}
              onApplyError={(msg) => setTemplateApplyHint(msg)}
            />
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
            <FollowUpCharCount value={inactivityMsg2} />
          </div>

          {/* Closing message */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Closing message</p>
            <p className="text-xs text-muted-foreground">Sent when a booking is confirmed or the conversation wraps up. Leave blank to skip.</p>
            <FollowUpTemplatePicker
              templates={CLOSING_MESSAGE_TEMPLATES}
              salonName={salonDisplayName}
              value={closingMsg}
              onChange={setClosingMsg}
              onApplyError={(msg) => setTemplateApplyHint(msg)}
            />
            <textarea
              value={closingMsg}
              onChange={(e) => setClosingMsg(e.target.value)}
              placeholder={`Thank you for contacting ${salon.tradingName ?? salon.name}! We appreciate your support. Remember — just send us a text and we'll respond faster than you can say "${salon.tradingName ?? salon.name}" 😄`}
              rows={4}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <FollowUpCharCount value={closingMsg} />
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

      {loyaltyProgram !== undefined && (
        <>
          <Separator />
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">Loyalty programme</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how many stamps customers need to earn a reward and what they receive.
              </p>
            </div>
            <form onSubmit={(e) => void handleSaveLoyalty(e)} className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label htmlFor="stamps-per-reward">Stamps needed for a reward</Label>
                <Input
                  id="stamps-per-reward"
                  type="number"
                  min={1}
                  max={100}
                  value={loyaltyStampsPerReward}
                  onChange={(e) => setLoyaltyStampsPerReward(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Default: 10. Customers earn one stamp per completed visit.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reward-description">Reward description</Label>
                  <span className={`text-xs tabular-nums ${loyaltyRewardDescription.length > 200 ? 'text-destructive' : 'text-muted-foreground'}`}>{loyaltyRewardDescription.length}/200</span>
                </div>
                <Input
                  id="reward-description"
                  value={loyaltyRewardDescription}
                  onChange={(e) => setLoyaltyRewardDescription(e.target.value)}
                  placeholder="e.g. Free haircut of your choice"
                  maxLength={210}
                />
                <p className="text-xs text-muted-foreground">Shown to customers when they check their loyalty balance on WhatsApp.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" disabled={savingLoyalty || !loyaltyDirty}>
                    {savingLoyalty ? 'Saving…' : 'Save loyalty settings'}
                  </Button>
                  {loyaltyDirty && <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>}
                </div>
                <SectionSaveFeedback feedback={getSection('loyalty')} />
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
