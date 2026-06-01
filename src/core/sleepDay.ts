import type { SleepPlanPreset } from '@/types/sleep';
import {
  addLocalCalendarDays,
  dateFromLocalDateTime,
  formatLocalDateKey,
  getLocalMinutesFromMidnight,
} from '@/core/localDateTime';

function getMinutesFromMidnight(date: Date): number {
  return getLocalMinutesFromMidnight(date);
}

function addCalendarDays(date: Date, days: number): Date {
  return addLocalCalendarDays(date, days);
}

export function formatSleepDayDateKey(date: Date): string {
  return formatLocalDateKey(date);
}

export function dateFromSleepDayDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);

  return dateFromLocalDateTime({ day, hours: 12, minutes: 0, month, year });
}

export function getSleepDayDateKeyForDate(
  date: Date,
  plan: Pick<SleepPlanPreset, 'dayStartMinutes'>,
): string {
  const sleepDayDate =
    getMinutesFromMidnight(date) < plan.dayStartMinutes ? addCalendarDays(date, -1) : date;

  return formatSleepDayDateKey(sleepDayDate);
}

export function getSleepDayDateKeysForInterval(
  startedAt: Date,
  endedAt: Date | null,
  plan: Pick<SleepPlanPreset, 'dayStartMinutes'>,
): string[] {
  const firstKey = getSleepDayDateKeyForDate(startedAt, plan);

  if (!endedAt || endedAt.getTime() <= startedAt.getTime()) {
    return [firstKey];
  }

  const lastVisibleMoment = new Date(endedAt.getTime() - 1);
  const lastKey = getSleepDayDateKeyForDate(lastVisibleMoment, plan);

  if (firstKey === lastKey) {
    return [firstKey];
  }

  const keys: string[] = [];
  const lastTime = dateFromSleepDayDateKey(lastKey).getTime();
  let cursor = dateFromSleepDayDateKey(firstKey);

  while (cursor.getTime() <= lastTime) {
    keys.push(formatSleepDayDateKey(cursor));
    cursor = addCalendarDays(cursor, 1);
  }

  return keys;
}
