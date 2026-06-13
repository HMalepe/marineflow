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
  saveInactivityMessages,
  saveGoogleReviewSettings,
  saveCurrentSpecial,
  saveReminderSettings,
  saveAutomationSection,
  saveLoyaltyProgram,
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

export function SalonSettingsForm({ initialSettings, loyaltyProgram }: Props) {
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

  const [inactivityMsg1, setInactivityMsg1] = useState(initialSettings.inactivityMessage1 ?? '');
  const [inactivityDelay1, setInactivityDelay1] = useState(initialSettings.inactivityMessage1DelayMin ?? 10);
  const [inactivityMsg2, setInactivityMsg2] = useState(initialSettings.inactivityMessage2 ?? '');
  const [inactivityDelay2, setInactivityDelay2] = useState(initialSettings.inactivityMessage2DelayMin ?? 30);
  const [closingMsg, setClosingMsg] = useState(initialSettings.closingMessage ?? '');
  const [templateApplyHint, setTemplateApplyHint] = useState<string | null>(null);
  const [savingInactivity, setSavingInactivity] = useState(false);

  const [botNameVal, setBotNameVal] = useState(initialSettings.botName ?? 'Ava');
  const [savingBotName, setSavingBotName] = useState(false);

  const [addressLine, setAddressLine] = useState(initialSettings.addressLine ?? '');
  const [phoneDisplay, setPhoneDisplay] = useState(initialSettings.phoneDisplay ?? '');
  const [contactEmail, setContactEmail] = useState(initialSettings.contactEmail ?? '');
  const [mapsUrl, setMapsUrl] = useState(initialSettings.mapsUrl ?? '');
  const [parkingNotes, setParkingNotes] = useState(initialSettings.parkingNotes ?? '');

  const [googleReviewUrl, setGoogleReviewUrl] = useState(initialSettings.googleReviewUrl ?? '');
  const [reviewIncentiveEnabled, setReviewIncentiveEnabled] = useState(
    initialSettings.automations?.googleReview?.incentiveEnabled ?? true,
  );
  const [reviewIncentiveRands, setReviewIncentiveRands] = useState(
    String((initialSettings.automations?.googleReview?.incentiveCents ?? 5000) / 100),
  );
  const [savingGoogleReviewUrl, setSavingGoogleReviewUrl] = useState(false);

  const [currentSpecial, setCurrentSpecial] = useState(initialSettings.currentSpecial ?? '');
  const [savingSpecial, setSavingSpecial] = useState(false);

  const DEFAULT_REMINDER_HOURS = [24, 2];
  const [reminderEnabled, setReminderEnabled] = useState(
    initialSettings.automations?.reminders?.enabled ?? true,
  );
  const [reminderHours, setReminderHours] = useState<number[]>(
    initialSettings.automations?.reminders?.hoursBefore ?? DEFAULT_REMINDER_HOURS,
  );
  const [savingReminders, setSavingReminders] = useState(false);

  // Phase 4 — win-back / reactivation settings
  const [reactivationEnabled, setReactivationEnabled] = useState(
    initialSettings.automations?.reactivation?.enabled ?? true,
  );
  const [reactivationInactiveDays, setReactivationInactiveDays] = useState(
    (initialSettings.automations?.reactivation?.inactiveDays ?? [21])[0] ?? 21,
  );
  const [reactivationDailyLimit, setReactivationDailyLimit] = useState(
    initialSettings.automations?.reactivation?.dailyLimit ?? 50,
  );
  const [reactivationCooldown, setReactivationCooldown] = useState(
    initialSettings.automations?.reactivation?.cooldownDays ?? 30,
  );
  const [savingReactivation, setSavingReactivation] = useState(false);

  // Phase 4 — slot interval
  const [slotIntervalMin, setSlotIntervalMin] = useState(
    initialSettings.automations?.booking?.slotIntervalMin ?? 15,
  );
  const [holdTimeoutMin, setHoldTimeoutMin] = useState(
    initialSettings.automations?.booking?.holdTimeoutMin ?? 30,
  );
  const [savingSlotInterval, setSavingSlotInterval] = useState(false);

  // Phase 4 — message templates
  const [winbackBody, setWinbackBody] = useState(initialSettings.automations?.messaging?.winbackBody ?? '');
  const [birthdayBody, setBirthdayBody] = useState(initialSettings.automations?.messaging?.birthdayBody ?? '');
  const [cancellationPolicyText, setCancellationPolicyText] = useState(
    initialSettings.automations?.messaging?.cancellationPolicyText ?? '',
  );
  const [savingMessaging, setSavingMessaging] = useState(false);

  // Phase 4 — loyalty programme
  const [loyaltyStampsPerReward, setLoyaltyStampsPerReward] = useState(loyaltyProgram?.stampsPerReward ?? 10);
  const [loyaltyRewardDescription, setLoyaltyRewardDescription] = useState(loyaltyProgram?.rewardDescription ?? '');
  const [savedLoyaltyStamps, setSavedLoyaltyStamps] = useState(loyaltyProgram?.stampsPerReward ?? 10);
  const [savedLoyaltyDesc, setSavedLoyaltyDesc] = useState(loyaltyProgram?.rewardDescription ?? '');
  const [savingLoyalty, setSavingLoyalty] = useState(false);

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
    setReviewIncentiveEnabled(s.automations?.googleReview?.incentiveEnabled ?? true);
    setReviewIncentiveRands(String((s.automations?.googleReview?.incentiveCents ?? 5000) / 100));
    setCurrentSpecial(s.currentSpecial ?? '');
    setReminderEnabled(s.automations?.reminders?.enabled ?? true);
    setReminderHours(s.automations?.reminders?.hoursBefore ?? DEFAULT_REMINDER_HOURS);
    setReactivationEnabled(s.automations?.reactivation?.enabled ?? true);
    setReactivationInactiveDays((s.automations?.reactivation?.inactiveDays ?? [21])[0] ?? 21);
    setReactivationDailyLimit(s.automations?.reactivation?.dailyLimit ?? 50);
    setReactivationCooldown(s.automations?.reactivation?.cooldownDays ?? 30);
    setSlotIntervalMin(s.automations?.booking?.slotIntervalMin ?? 15);
    setHoldTimeoutMin(s.automations?.booking?.holdTimeoutMin ?? 30);
    setWinbackBody(s.automations?.messaging?.winbackBody ?? '');
    setBirthdayBody(s.automations?.messaging?.birthdayBody ?? '');
    setCancellationPolicyText(s.automations?.messaging?.cancellationPolicyText ?? '');
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
    () =>
      googleReviewUrl !== (saved.googleReviewUrl ?? '') ||
      reviewIncentiveEnabled !== (saved.automations?.googleReview?.incentiveEnabled ?? true) ||
      reviewIncentiveRands !==
        String((saved.automations?.googleReview?.incentiveCents ?? 5000) / 100),
    [saved, googleReviewUrl, reviewIncentiveEnabled, reviewIncentiveRands],
  );

  const currentSpecialDirty = useMemo(
    () => currentSpecial !== (saved.currentSpecial ?? ''),
    [saved, currentSpecial],
  );

  const remindersDirty = useMemo(() => {
    const savedEnabled = saved.automations?.reminders?.enabled ?? true;
    const savedHours = saved.automations?.reminders?.hoursBefore ?? DEFAULT_REMINDER_HOURS;
    return (
      reminderEnabled !== savedEnabled ||
      JSON.stringify([...reminderHours].sort((a, b) => b - a)) !==
        JSON.stringify([...savedHours].sort((a, b) => b - a))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, reminderEnabled, reminderHours]);

  const reactivationDirty = useMemo(() => {
    const a = saved.automations?.reactivation;
    return (
      reactivationEnabled !== (a?.enabled ?? true) ||
      reactivationInactiveDays !== ((a?.inactiveDays ?? [21])[0] ?? 21) ||
      reactivationDailyLimit !== (a?.dailyLimit ?? 50) ||
      reactivationCooldown !== (a?.cooldownDays ?? 30)
    );
  }, [saved, reactivationEnabled, reactivationInactiveDays, reactivationDailyLimit, reactivationCooldown]);

  const slotIntervalDirty = useMemo(
    () =>
      slotIntervalMin !== (saved.automations?.booking?.slotIntervalMin ?? 15) ||
      holdTimeoutMin !== (saved.automations?.booking?.holdTimeoutMin ?? 30),
    [saved, slotIntervalMin, holdTimeoutMin],
  );

  const messagingDirty = useMemo(() => {
    const m = saved.automations?.messaging;
    return (
      winbackBody !== (m?.winbackBody ?? '') ||
      birthdayBody !== (m?.birthdayBody ?? '') ||
      cancellationPolicyText !== (m?.cancellationPolicyText ?? '')
    );
  }, [saved, winbackBody, birthdayBody, cancellationPolicyText]);

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
    const incentiveRands = parseInt(reviewIncentiveRands, 10);
    if (reviewIncentiveEnabled && (!Number.isFinite(incentiveRands) || incentiveRands < 1 || incentiveRands > 1000)) {
      reportError('googleReview', 'Incentive amount must be between R1 and R1000');
      return;
    }
    setSavingGoogleReviewUrl(true);
    try {
      const result = await saveGoogleReviewSettings(trimmed || null, {
        incentiveEnabled: reviewIncentiveEnabled,
        incentiveCents: reviewIncentiveEnabled ? incentiveRands * 100 : 0,
      });
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('googleReview', 'Google review settings saved');
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

  async function handleSaveReactivation(e: React.FormEvent) {
    e.preventDefault();
    if (reactivationInactiveDays < 7 || reactivationInactiveDays > 180) {
      reportError('reactivation', 'Inactive days must be between 7 and 180');
      return;
    }
    if (reactivationDailyLimit < 1 || reactivationDailyLimit > 500) {
      reportError('reactivation', 'Daily limit must be between 1 and 500');
      return;
    }
    if (reactivationCooldown < 7 || reactivationCooldown > 90) {
      reportError('reactivation', 'Cooldown must be between 7 and 90 days');
      return;
    }
    setSavingReactivation(true);
    try {
      const result = await saveAutomationSection('reactivation', {
        enabled: reactivationEnabled,
        inactiveDays: [reactivationInactiveDays],
        dailyLimit: reactivationDailyLimit,
        cooldownDays: reactivationCooldown,
      });
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('reactivation', 'Win-back settings saved');
      } else {
        reportError('reactivation', result.error ?? 'Save failed');
      }
    } catch {
      reportError('reactivation', 'Save failed — please try again');
    } finally {
      setSavingReactivation(false);
    }
  }

  async function handleSaveSlotInterval(e: React.FormEvent) {
    e.preventDefault();
    setSavingSlotInterval(true);
    try {
      const result = await saveAutomationSection('booking', { slotIntervalMin, holdTimeoutMin });
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('slotInterval', 'Slot interval saved');
      } else {
        reportError('slotInterval', result.error ?? 'Save failed');
      }
    } catch {
      reportError('slotInterval', 'Save failed — please try again');
    } finally {
      setSavingSlotInterval(false);
    }
  }

  async function handleSaveMessaging(e: React.FormEvent) {
    e.preventDefault();
    if (winbackBody.length > 1600) {
      reportError('messaging', 'Win-back message must be 1600 characters or fewer');
      return;
    }
    if (birthdayBody.length > 1600) {
      reportError('messaging', 'Birthday message must be 1600 characters or fewer');
      return;
    }
    if (cancellationPolicyText.length > 2000) {
      reportError('messaging', 'Cancellation policy must be 2000 characters or fewer');
      return;
    }
    setSavingMessaging(true);
    try {
      const result = await saveAutomationSection('messaging', {
        winbackBody: winbackBody.trim(),
        birthdayBody: birthdayBody.trim(),
        cancellationPolicyText: cancellationPolicyText.trim(),
      });
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('messaging', 'Message templates saved');
      } else {
        reportError('messaging', result.error ?? 'Save failed');
      }
    } catch {
      reportError('messaging', 'Save failed — please try again');
    } finally {
      setSavingMessaging(false);
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

  async function handleSaveReminders(e: React.FormEvent) {
    e.preventDefault();
    const unique = [...new Set(reminderHours.filter((h) => h > 0 && h <= 168))].sort((a, b) => b - a);
    if (reminderEnabled && unique.length === 0) {
      reportError('reminders', 'Add at least one reminder time');
      return;
    }
    setSavingReminders(true);
    try {
      const result = await saveReminderSettings(reminderEnabled, unique);
      if (result.salon) {
        applySalon(result.salon);
        reportSuccess('reminders', 'Reminder settings saved');
      } else {
        reportError('reminders', result.error ?? 'Save failed');
      }
    } catch {
      reportError('reminders', 'Save failed — please try again');
    } finally {
      setSavingReminders(false);
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

      <ConversationFlowSection initialSettings={salon} onSaved={applySalon} />

      <Separator />

      {/* Google Reviews */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Google Reviews</h3>
          <p className="text-sm text-muted-foreground mt-1">
            After a visit, customers receive your Google review link via WhatsApp. Enable the incentive to offer a discount for any review — good or bad — with a special claim link.
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
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Review incentive</p>
                <p className="text-xs text-muted-foreground">
                  Customers get a special link to claim their discount after leaving a review.
                </p>
              </div>
              <input
                id="review-incentive-enabled"
                type="checkbox"
                checked={reviewIncentiveEnabled}
                onChange={(e) => setReviewIncentiveEnabled(e.target.checked)}
                className="size-4 rounded border-input"
              />
            </div>
            {reviewIncentiveEnabled && (
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="review-incentive-rands">Discount amount (R)</Label>
                <Input
                  id="review-incentive-rands"
                  type="number"
                  min={1}
                  max={1000}
                  value={reviewIncentiveRands}
                  onChange={(e) => setReviewIncentiveRands(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Default R50 — applied automatically on their next booking after they claim via WhatsApp.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingGoogleReviewUrl || !googleReviewUrlDirty}>
                {savingGoogleReviewUrl ? 'Saving…' : 'Save review settings'}
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

      {/* Appointment reminders */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Appointment reminders</h3>
          <p className="text-sm text-muted-foreground mt-1">
            WhatsApp reminders sent automatically before each confirmed appointment. Helps reduce no-shows.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveReminders(e)} className="space-y-4 max-w-lg">
          <div
            className={cn(
              'rounded-lg border p-4 transition-colors',
              reminderEnabled ? 'border-green-600/25 bg-green-600/5' : 'border-muted bg-muted/20',
            )}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="mt-1 size-4 rounded border-input accent-primary"
              />
              <div>
                <p className="text-sm font-medium">Reminders enabled</p>
                <p className="text-xs text-muted-foreground">
                  {reminderEnabled
                    ? 'Customers receive a WhatsApp message before each appointment.'
                    : 'No reminders will be sent.'}
                </p>
              </div>
            </label>
          </div>

          {reminderEnabled && (
            <div className="space-y-3">
              <Label>Send reminder at</Label>
              <div className="flex flex-wrap gap-2">
                {[48, 24, 12, 4, 2, 1].map((h) => {
                  const active = reminderHours.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() =>
                        setReminderHours((prev) =>
                          active ? prev.filter((x) => x !== h) : [...prev, h],
                        )
                      }
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm border transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:border-ring',
                      )}
                    >
                      {h === 1 ? '1 hour' : `${h} hours`} before
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Toggle the times you want. At least one must be selected.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingReminders || !remindersDirty}>
                {savingReminders ? 'Saving…' : 'Save reminder settings'}
              </Button>
              {remindersDirty && (
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
              )}
            </div>
            <SectionSaveFeedback feedback={getSection('reminders')} />
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

      <Separator />

      {/* Win-back / reactivation */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Win-back campaign</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically message inactive customers on WhatsApp to bring them back. Only sent to customers who have accepted marketing.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveReactivation(e)} className="space-y-4 max-w-lg">
          <div className={cn('rounded-lg border p-4 transition-colors', reactivationEnabled ? 'border-green-600/25 bg-green-600/5' : 'border-muted bg-muted/20')}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reactivationEnabled}
                onChange={(e) => setReactivationEnabled(e.target.checked)}
                className="mt-1 size-4 rounded border-input accent-primary"
              />
              <div>
                <p className="text-sm font-medium">Win-back enabled</p>
                <p className="text-xs text-muted-foreground">Runs daily — message consented customers who haven&apos;t visited recently.</p>
              </div>
            </label>
          </div>
          {reactivationEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reactivation-days">Inactive after (days)</Label>
                <Input
                  id="reactivation-days"
                  type="number"
                  min={7}
                  max={180}
                  value={reactivationInactiveDays}
                  onChange={(e) => setReactivationInactiveDays(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Min days since last visit before messaging.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reactivation-limit">Daily cap</Label>
                <Input
                  id="reactivation-limit"
                  type="number"
                  min={1}
                  max={500}
                  value={reactivationDailyLimit}
                  onChange={(e) => setReactivationDailyLimit(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Max customers messaged per day.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reactivation-cooldown">Cooldown (days)</Label>
                <Input
                  id="reactivation-cooldown"
                  type="number"
                  min={7}
                  max={90}
                  value={reactivationCooldown}
                  onChange={(e) => setReactivationCooldown(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Days before re-sending to same customer.</p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingReactivation || !reactivationDirty}>
                {savingReactivation ? 'Saving…' : 'Save win-back settings'}
              </Button>
              {reactivationDirty && <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>}
            </div>
            <SectionSaveFeedback feedback={getSection('reactivation')} />
          </div>
        </form>
      </section>

      <Separator />

      {/* Slot interval */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Booking slot interval</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Controls how granular the time picker is when customers book. Shorter intervals show more options; longer intervals simplify scheduling.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveSlotInterval(e)} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label>Slot interval</Label>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 30, 60].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setSlotIntervalMin(min)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-colors',
                    slotIntervalMin === min
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-ring',
                  )}
                >
                  {min === 60 ? '1 hour' : `${min} min`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hold-timeout">Hold timeout (minutes)</Label>
            <p className="text-xs text-muted-foreground">
              Held appointments are auto-cancelled after this many minutes if payment is not received. Set to 0 to disable auto-release.
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="hold-timeout"
                type="number"
                min={0}
                max={240}
                step={5}
                value={holdTimeoutMin}
                onChange={(e) => setHoldTimeoutMin(Math.max(0, Math.min(240, parseInt(e.target.value) || 0)))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">min{holdTimeoutMin === 0 ? ' (disabled)' : ''}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingSlotInterval || !slotIntervalDirty}>
                {savingSlotInterval ? 'Saving…' : 'Save booking settings'}
              </Button>
              {slotIntervalDirty && <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>}
            </div>
            <SectionSaveFeedback feedback={getSection('slotInterval')} />
          </div>
        </form>
      </section>

      <Separator />

      {/* Message templates */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Campaign message templates</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customise automatic WhatsApp messages. Use <code className="font-mono text-xs bg-muted px-1 rounded">{'{name}'}</code> for the customer&apos;s first name and <code className="font-mono text-xs bg-muted px-1 rounded">{'{salon}'}</code> for your salon name. Leave blank to use the smart default.
          </p>
        </div>
        <form onSubmit={(e) => void handleSaveMessaging(e)} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="winback-body">Win-back message</Label>
              <span className={`text-xs tabular-nums ${winbackBody.length > 1600 ? 'text-destructive' : 'text-muted-foreground'}`}>{winbackBody.length}/1600</span>
            </div>
            <textarea
              id="winback-body"
              value={winbackBody}
              onChange={(e) => setWinbackBody(e.target.value)}
              rows={3}
              maxLength={1700}
              placeholder="Hey {name}! We miss you at {salon}. It's been a while — reply 1 to book. Reply STOP to opt out."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[72px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="birthday-body">Birthday message</Label>
              <span className={`text-xs tabular-nums ${birthdayBody.length > 1600 ? 'text-destructive' : 'text-muted-foreground'}`}>{birthdayBody.length}/1600</span>
            </div>
            <textarea
              id="birthday-body"
              value={birthdayBody}
              onChange={(e) => setBirthdayBody(e.target.value)}
              rows={3}
              maxLength={1700}
              placeholder="Happy birthday {name}! 🎂 From all of us at {salon} — reply BIRTHDAY for a special treat."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[72px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cancellation-policy">Cancellation policy</Label>
              <span className={`text-xs tabular-nums ${cancellationPolicyText.length > 2000 ? 'text-destructive' : 'text-muted-foreground'}`}>{cancellationPolicyText.length}/2000</span>
            </div>
            <textarea
              id="cancellation-policy"
              value={cancellationPolicyText}
              onChange={(e) => setCancellationPolicyText(e.target.value)}
              rows={4}
              maxLength={2100}
              placeholder="e.g. Cancellations within 24 hours of your appointment will incur a 50% fee. No-shows will be charged in full."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[96px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Shown to customers when they request a cancellation via WhatsApp.</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={savingMessaging || !messagingDirty}>
                {savingMessaging ? 'Saving…' : 'Save message templates'}
              </Button>
              {messagingDirty && <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>}
            </div>
            <SectionSaveFeedback feedback={getSection('messaging')} />
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
