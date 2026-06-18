'use client';

import { useState } from 'react';
import { Banknote, Link2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { WaivePenaltyButton } from '@/app/(dashboard)/appointments/waive-penalty-button';

type NoShowRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AppointmentData {
  id: string;
  start: string;
  end: string;
  status: string;
  cancellationPenaltyApplied: boolean;
  paymentForfeited: boolean;
  penaltyWaivedAt: string | null;
  paymentLinkSentAt?: string | null;
  reminder24hSentAt: string | null;
  reminder2hSentAt: string | null;
  reminder24hFailed: boolean;
  reminder2hFailed: boolean;
  service: { name: string };
  staff: { name: string; displayName: string | null; deletedAt: string | null };
  customer: {
    displayName: string | null;
    waId: string;
    noShowRisk?: NoShowRisk;
    noShowCount?: number;
    bookingCount?: number;
  };
  payments?: { id: string; amountCents: number; status: string; method?: string | null }[];
  notes: string | null;
  cancellationReason: string | null;
  branch: { id: string; name: string } | null;
}

const ACTIONABLE_STATUSES = new Set([
  'CONFIRMED',
  'CONFIRMED_PAID',
  'HELD',
  'PENDING_PAYMENT',
]);

function shouldShowRiskBadge(appt: AppointmentData): boolean {
  const risk = appt.customer.noShowRisk ?? 'LOW';
  return (
    (risk === 'MEDIUM' || risk === 'HIGH') &&
    ACTIONABLE_STATUSES.has(appt.status)
  );
}

function riskSummary(noShowCount: number, bookingCount: number): string {
  return `Based on ${noShowCount} no-show${noShowCount === 1 ? '' : 's'} from ${bookingCount} booking${bookingCount === 1 ? '' : 's'}`;
}

function getPaymentStatus(appt: AppointmentData): 'none' | 'paid' | 'unpaid' {
  if (
    appt.status === 'CONFIRMED_PAID' ||
    (appt.payments ?? []).some((p) => p.status === 'SUCCEEDED')
  ) {
    return 'paid';
  }
  if (appt.status === 'PENDING_PAYMENT' || appt.status === 'HELD') {
    return 'unpaid';
  }
  return 'none';
}

function NoShowRiskBadge({
  risk,
  noShowCount,
  bookingCount,
}: {
  risk: NoShowRisk;
  noShowCount: number;
  bookingCount: number;
}) {
  const label = risk === 'HIGH' ? 'High risk' : 'Confirm?';
  const className =
    risk === 'HIGH'
      ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900';

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
      >
        {label}
      </span>
      <p className="text-[10px] text-muted-foreground leading-tight text-right max-w-[160px]">
        {riskSummary(noShowCount, bookingCount)}
      </p>
    </div>
  );
}

function ReminderPill({ sent, failed, label }: { sent: boolean; failed: boolean; label: string }) {
  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        {label} sent
      </span>
    );
  }
  if (failed) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
        {label} failed
      </span>
    );
  }
  return null;
}

type Props = {
  appt: AppointmentData;
  showRisk?: boolean;
  token?: string;
  onUpdated?: (patch: Partial<AppointmentData> & { id: string }) => void;
};

export function AppointmentCard({ appt, showRisk = false, token = '', onUpdated }: Props) {
  const [sendingLink, setSendingLink] = useState(false);
  const [markingCash, setMarkingCash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkSentAt, setLinkSentAt] = useState<string | null>(appt.paymentLinkSentAt ?? null);
  const [localStatus, setLocalStatus] = useState(appt.status);

  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    CONFIRMED: 'default',
    CONFIRMED_PAID: 'default',
    HELD: 'secondary',
    PENDING_PAYMENT: 'secondary',
    CANCELLED: 'destructive',
    NO_SHOW: 'destructive',
    COMPLETED: 'secondary',
    RESCHEDULED: 'outline',
  };

  const mergedAppt = { ...appt, status: localStatus, paymentLinkSentAt: linkSentAt };
  const risk = appt.customer.noShowRisk ?? 'LOW';
  const noShowCount = appt.customer.noShowCount ?? 0;
  const bookingCount = appt.customer.bookingCount ?? 0;
  const showBadge = showRisk && shouldShowRiskBadge(mergedAppt);
  const isFormerStaff = !!appt.staff.deletedAt;
  const staffLabel = appt.staff.displayName ?? appt.staff.name;
  const paymentStatus = getPaymentStatus(mergedAppt);
  const showPaymentActions = localStatus === 'PENDING_PAYMENT' && paymentStatus !== 'paid' && token;

  async function sendPaymentLink() {
    setSendingLink(true);
    setError(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        phone?: string;
        paymentLinkSentAt?: string;
        message?: string;
      }>(`/appointments/${appt.id}/send-payment-link`, { method: 'POST' }, token);
      if (!res.ok || !res.paymentLinkSentAt) {
        setError(res.message ?? 'Could not send payment link');
        return;
      }
      setLinkSentAt(res.paymentLinkSentAt);
      setToast(`Payment link sent to ${res.phone ?? 'customer'}`);
      onUpdated?.({ id: appt.id, paymentLinkSentAt: res.paymentLinkSentAt });
      window.setTimeout(() => setToast(null), 5000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send payment link');
    } finally {
      setSendingLink(false);
    }
  }

  async function markCashPaid() {
    setMarkingCash(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; message?: string }>(
        `/appointments/${appt.id}/mark-cash-paid`,
        { method: 'POST' },
        token,
      );
      if (!res.ok) {
        setError(res.message ?? 'Could not mark as paid');
        return;
      }
      setLocalStatus('CONFIRMED_PAID');
      setToast('Marked as paid (cash)');
      onUpdated?.({ id: appt.id, status: 'CONFIRMED_PAID' });
      window.setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not mark as paid');
    } finally {
      setMarkingCash(false);
    }
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-start justify-between p-3 gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {appt.customer.displayName ?? appt.customer.waId}
          </p>
          <p className="text-xs text-muted-foreground">
            {appt.service.name} with{' '}
            <span className={isFormerStaff ? 'line-through opacity-60' : ''}>{staffLabel}</span>
            {isFormerStaff && (
              <span className="ml-1 text-[10px] text-muted-foreground italic">(former)</span>
            )}
            {appt.branch && (
              <span className="ml-2 text-[10px] bg-muted rounded px-1.5 py-0.5 font-medium">
                {appt.branch.name}
              </span>
            )}
          </p>
          {ACTIONABLE_STATUSES.has(localStatus) && (
            <div className="flex gap-2 mt-0.5">
              <ReminderPill sent={!!appt.reminder24hSentAt} failed={appt.reminder24hFailed} label="24h" />
              <ReminderPill sent={!!appt.reminder2hSentAt} failed={appt.reminder2hFailed} label="2h" />
            </div>
          )}
          {appt.cancellationPenaltyApplied && !appt.penaltyWaivedAt && (
            <span className="text-[10px] text-destructive font-medium">⚠ Cancellation penalty applied</span>
          )}
          {appt.penaltyWaivedAt && (
            <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">✓ Penalty waived</span>
          )}
          {appt.paymentForfeited && (
            <span className="text-[10px] text-destructive font-medium">⚠ Payment forfeited (no-show)</span>
          )}
          {appt.cancellationReason && (
            <span className="text-[10px] text-muted-foreground italic">
              Reason: {appt.cancellationReason.replace(/_/g, ' ').toLowerCase()}
            </span>
          )}
          {appt.notes && (
            <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2 italic mt-1 line-clamp-2">
              {appt.notes}
            </p>
          )}
        </div>
        <div className="text-right space-y-1 shrink-0">
          <p className="text-sm whitespace-nowrap">
            {new Date(appt.start).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}{' '}
            {new Date(appt.start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex flex-col items-end gap-1">
            {showRisk && token && ACTIONABLE_STATUSES.has(localStatus) && (
              <WaivePenaltyButton appointmentId={appt.id} token={token} />
            )}
            {showBadge && (
              <NoShowRiskBadge risk={risk} noShowCount={noShowCount} bookingCount={bookingCount} />
            )}
            {paymentStatus !== 'none' && ACTIONABLE_STATUSES.has(localStatus) && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  paymentStatus === 'paid'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : linkSentAt
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {paymentStatus === 'paid'
                  ? 'Paid'
                  : linkSentAt
                    ? `Link sent · ${new Date(linkSentAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Payment pending'}
              </span>
            )}
            <Badge variant={statusColors[localStatus] ?? 'secondary'}>
              {localStatus.toLowerCase().replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </div>

      {showPaymentActions && (
        <div className="flex flex-wrap gap-2 border-t bg-muted/20 px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={sendingLink || markingCash}
            onClick={() => void sendPaymentLink()}
          >
            {sendingLink ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5 mr-1.5" />
            )}
            Send payment link
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            disabled={sendingLink || markingCash}
            onClick={() => void markCashPaid()}
          >
            {markingCash ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Banknote className="size-3.5 mr-1.5" />
            )}
            Mark as paid (cash)
          </Button>
        </div>
      )}

      {toast && (
        <p className="border-t bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
          {toast}
        </p>
      )}
      {error && (
        <p className="border-t bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
