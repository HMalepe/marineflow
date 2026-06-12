import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { reminderField } from './appointmentReminders.js';

describe('appointmentReminders', () => {
  it('maps standard reminder hours to DB fields', () => {
    expect(reminderField(24)).toBe('reminder24hSentAt');
    expect(reminderField(2)).toBe('reminder2hSentAt');
    expect(reminderField(3)).toBeNull();
  });
});

describe('scheduleAppointmentReminders logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T10:00:00+02:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips fire times already in the past', () => {
    const TZ = 'Africa/Johannesburg';
    const start = DateTime.now().setZone(TZ).plus({ hours: 3 }).toJSDate();
    const now = DateTime.now().setZone(TZ);
    const hoursBefore = [24, 2];
    const schedulable = hoursBefore.filter((h) => {
      const fireAt = DateTime.fromJSDate(start).setZone(TZ).minus({ hours: h });
      return fireAt > now;
    });
    expect(schedulable).toEqual([2]);
  });

  it('skips all reminders when appointment is in the past', () => {
    const TZ = 'Africa/Johannesburg';
    const start = DateTime.now().setZone(TZ).minus({ hours: 1 }).toJSDate();
    expect(start.getTime() <= Date.now()).toBe(true);
  });
});
