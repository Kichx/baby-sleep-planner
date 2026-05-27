import type { SleepPlanPreset } from '@/types/sleep';

const DAY_MINUTES = 24 * 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = DAY_MINUTES * MS_PER_MINUTE;

function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function addCalendarDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

export function formatSleepDayDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function dateFromSleepDayDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(year, month - 1, day, 12, 0, 0, 0);
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
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  return keys;
}
