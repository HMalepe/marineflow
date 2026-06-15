'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';

interface Props {
  appointmentId: string;
  token: string;
}

export function WaivePenaltyButton({ appointmentId, token }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function waive() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/appointments/${appointmentId}/waive-penalty`, { method: 'POST' }, token);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-3.5" />
        Penalty waived
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs border-amber-500/40 text-amber-800 dark:text-amber-200"
        disabled={loading}
        onClick={() => void waive()}
        title="Waive late-cancellation payment penalty (car broke down, child sick, etc.)"
      >
        <ShieldCheck className="size-3.5 mr-1" />
        {loading ? '…' : 'Emergency waive'}
      </Button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
