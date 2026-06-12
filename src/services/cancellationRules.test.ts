import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { checkCancellationAllowed, formatHoursUntil } from './cancellationRules.js';

const TZ = 'Africa/Johannesburg';
const emptyMeta = {};

function apptInHours(hours: number, penaltyWaivedAt: Date | null = null) {
  const start = DateTime.now().setZone(TZ).plus({ hours }).toJSDate();
  return { start, penaltyWaivedAt, cancellationPenaltyApplied: false };
}

describe('cancellationRules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T10:00:00+02:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows cancel when outside window', () => {
    const result = checkCancellationAllowed({
      salon: { metadata: emptyMeta, timezone: TZ },
      appointment: apptInHours(48),
      action: 'cancel',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks cancel inside 24h window with penalty', () => {
    const result = checkCancellationAllowed({
      salon: { metadata: emptyMeta, timezone: TZ },
      appointment: apptInHours(6),
      action: 'cancel',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('penalty_applies');
  });

  it('blocks late cancel with penalty message when deposit forfeit applies', () => {
    const result = checkCancellationAllowed({
      salon: { metadata: emptyMeta, timezone: TZ },
      appointment: apptInHours(6),
      action: 'cancel',
    });
    expect(result.penaltyApplies).toBe(true);
    expect(result.message).toContain('forfeit');
  });

  it('allows late cancel when owner waived penalty (emergency override)', () => {
    const result = checkCancellationAllowed({
      salon: { metadata: emptyMeta, timezone: TZ },
      appointment: apptInHours(2, new Date()),
      action: 'cancel',
    });
    expect(result.allowed).toBe(true);
    expect(result.penaltyApplies).toBe(false);
  });

  it('blocks reschedule when self-service disabled', () => {
    const result = checkCancellationAllowed({
      salon: {
        metadata: {
          automations: {
            cancellation: { allowSelfServiceReschedule: false },
          },
        },
        timezone: TZ,
      },
      appointment: apptInHours(48),
      action: 'reschedule',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('self_service_disabled');
  });

  it('uses separate reschedule threshold (12h default)', () => {
    const result = checkCancellationAllowed({
      salon: { metadata: emptyMeta, timezone: TZ },
      appointment: apptInHours(18),
      action: 'reschedule',
    });
    expect(result.allowed).toBe(true);

    const tooLate = checkCancellationAllowed({
      salon: { metadata: emptyMeta, timezone: TZ },
      appointment: apptInHours(8),
      action: 'reschedule',
    });
    expect(tooLate.allowed).toBe(false);
  });

  it('allows late reschedule when penalty waived', () => {
    const result = checkCancellationAllowed({
      salon: { metadata: emptyMeta, timezone: TZ },
      appointment: apptInHours(2, new Date()),
      action: 'reschedule',
    });
    expect(result.allowed).toBe(true);
  });
});
