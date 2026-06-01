import { describe, expect, it } from 'vitest';

import {
  dateAtLocalMinutes,
  dateFromLocalDateTime,
  formatLocalClock,
  formatLocalDateInput,
  formatLocalDateKey,
  getLocalMinutesFromMidnight,
} from '@/core/localDateTime';

describe('local date-time helpers', () => {
  it('formats one stored instant in the requested local time zone', () => {
    const instant = new Date('2026-05-30T07:15:00.000Z');

    expect(formatLocalClock(instant, 'Europe/Moscow')).toBe('10:15');
    expect(formatLocalDateInput(instant, 'Europe/Moscow')).toBe('30.05');
    expect(formatLocalClock(instant, 'America/New_York')).toBe('03:15');
    expect(formatLocalDateInput(instant, 'America/New_York')).toBe('30.05');
  });

  it('creates an absolute instant from local phone date and time fields', () => {
    const moscowDate = dateFromLocalDateTime(
      { day: 30, hours: 10, minutes: 15, month: 5, year: 2026 },
      'Europe/Moscow',
    );
    const newYorkDate = dateFromLocalDateTime(
      { day: 30, hours: 10, minutes: 15, month: 5, year: 2026 },
      'America/New_York',
    );

    expect(moscowDate.toISOString()).toBe('2026-05-30T07:15:00.000Z');
    expect(newYorkDate.toISOString()).toBe('2026-05-30T14:15:00.000Z');
  });

  it('keeps day keys tied to the current local calendar day', () => {
    const lateUtcInstant = new Date('2026-05-30T21:30:00.000Z');

    expect(formatLocalDateKey(lateUtcInstant, 'Europe/Moscow')).toBe('2026-05-31');
    expect(formatLocalDateKey(lateUtcInstant, 'America/New_York')).toBe('2026-05-30');
  });

  it('builds local time on the same visible date as the reference', () => {
    const referenceInMoscow = new Date('2026-05-30T22:30:00.000Z');
    const morning = dateAtLocalMinutes(referenceInMoscow, 7 * 60 + 30, 'Europe/Moscow');

    expect(formatLocalDateKey(morning, 'Europe/Moscow')).toBe('2026-05-31');
    expect(formatLocalClock(morning, 'Europe/Moscow')).toBe('07:30');
    expect(getLocalMinutesFromMidnight(morning, 'Europe/Moscow')).toBe(7 * 60 + 30);
  });
});
