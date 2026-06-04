import {
  addLocalCalendarDays,
  formatLocalClock,
  formatLocalDateLabel,
  getLocalCalendarDayDiff,
  startOfLocalCalendarDay,
} from '@/core/localDateTime';
import type { BottleFeeding, BottleFeedingStats } from '@/types/bottleFeeding';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const BOTTLE_FEEDING_EMPTY_TEXT = 'Записей пока нет';

export interface BottleFeedingDateRange {
  end: Date;
  start: Date;
}

export function getBottleFeedingCalendarDayRange(
  date: Date,
  timeZone?: string,
): BottleFeedingDateRange {
  const start = startOfLocalCalendarDay(date, timeZone);
  const nextDay = addLocalCalendarDays(date, 1, timeZone);
  const end = startOfLocalCalendarDay(nextDay, timeZone);

  return { end, start };
}

export function getTodayBottleFeedingRange(
  now: Date,
  timeZone?: string,
): BottleFeedingDateRange {
  return getBottleFeedingCalendarDayRange(now, timeZone);
}

export function getLast24HoursBottleFeedingRange(now: Date): BottleFeedingDateRange {
  return {
    end: new Date(now.getTime()),
    start: new Date(now.getTime() - MS_PER_DAY),
  };
}

export function filterBottleFeedingsInRange(
  feedings: readonly BottleFeeding[],
  rangeStart: Date,
  rangeEnd: Date,
): BottleFeeding[] {
  const startTime = rangeStart.getTime();
  const endTime = rangeEnd.getTime();

  return feedings.filter((feeding) => {
    const startedAt = new Date(feeding.startedAt).getTime();

    return startedAt >= startTime && startedAt < endTime;
  });
}

export function filterBottleFeedingsInCalendarDay(
  feedings: readonly BottleFeeding[],
  date: Date,
  timeZone?: string,
): BottleFeeding[] {
  const range = getBottleFeedingCalendarDayRange(date, timeZone);

  return filterBottleFeedingsInRange(feedings, range.start, range.end);
}

export function calculateBottleFeedingStats(
  feedings: readonly Pick<BottleFeeding, 'volumeMl'>[],
): BottleFeedingStats {
  return {
    count: feedings.length,
    totalVolumeMl: feedings.reduce((total, feeding) => total + feeding.volumeMl, 0),
  };
}

export interface BottleFeedingTopUpStats {
  regularCount: number;
  topUpCount: number;
  totalVolumeMl: number;
}

export function calculateBottleFeedingTopUpStats(
  feedings: readonly Pick<BottleFeeding, 'volumeMl'>[],
  topUpThresholdMl: number,
): BottleFeedingTopUpStats {
  return feedings.reduce<BottleFeedingTopUpStats>(
    (stats, feeding) => {
      stats.totalVolumeMl += feeding.volumeMl;

      if (isBottleFeedingTopUp(feeding, topUpThresholdMl)) {
        stats.topUpCount += 1;
      } else {
        stats.regularCount += 1;
      }

      return stats;
    },
    {
      regularCount: 0,
      topUpCount: 0,
      totalVolumeMl: 0,
    },
  );
}

export function calculateBottleFeedingStatsInRange(
  feedings: readonly BottleFeeding[],
  rangeStart: Date,
  rangeEnd: Date,
): BottleFeedingStats {
  return calculateBottleFeedingStats(
    filterBottleFeedingsInRange(feedings, rangeStart, rangeEnd),
  );
}

export function isBottleFeedingTopUpVolume(
  volumeMl: number,
  topUpThresholdMl: number,
): boolean {
  return (
    Number.isInteger(volumeMl) &&
    volumeMl > 0 &&
    Number.isInteger(topUpThresholdMl) &&
    topUpThresholdMl > 0 &&
    volumeMl <= topUpThresholdMl
  );
}

export function isBottleFeedingTopUp(
  feeding: Pick<BottleFeeding, 'volumeMl'>,
  topUpThresholdMl: number,
): boolean {
  return isBottleFeedingTopUpVolume(feeding.volumeMl, topUpThresholdMl);
}

export function formatBottleFeedingTopUpThresholdLine(thresholdMl: number): string {
  if (!Number.isInteger(thresholdMl) || thresholdMl <= 0) {
    return 'Небольшой объём';
  }

  return `До ${thresholdMl} мл включительно`;
}

function formatRussianCount(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;

  return `${value} ${suffix}`;
}

export function formatBottleFeedingCount(count: number): string {
  return formatRussianCount(count, 'кормление', 'кормления', 'кормлений');
}

export function formatBottleFeedingTopUpCount(count: number): string {
  return formatRussianCount(count, 'доешка', 'доешки', 'доешек');
}

export function formatBottleFeedingElapsed(startedAt: Date, now: Date): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - startedAt.getTime()) / 60_000),
  );

  if (elapsedMinutes === 0) {
    return 'только что';
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  if (hours === 0) {
    return `${minutes} мин назад`;
  }

  if (minutes === 0) {
    return `${hours} ч назад`;
  }

  return `${hours} ч ${minutes} мин назад`;
}

export function formatBottleFeedingRecordLine(feeding: BottleFeeding): string {
  return `${formatLocalClock(new Date(feeding.startedAt))} · ${feeding.volumeMl} мл`;
}

export function formatBottleFeedingReminderBody(feeding: BottleFeeding): string {
  return `Последнее: ${feeding.volumeMl} мл в ${formatLocalClock(
    new Date(feeding.startedAt),
  )}`;
}

export function formatLatestBottleFeedingLine(
  feeding: BottleFeeding | null,
  now: Date,
): string {
  if (!feeding) {
    return BOTTLE_FEEDING_EMPTY_TEXT;
  }

  const startedAt = new Date(feeding.startedAt);
  const dayDiff = getLocalCalendarDayDiff(startedAt, now);

  if (dayDiff === 0) {
    return `${formatBottleFeedingElapsed(startedAt, now)} · ${feeding.volumeMl} мл`;
  }

  if (dayDiff === -1) {
    return `Последнее: вчера в ${formatLocalClock(startedAt)} · ${feeding.volumeMl} мл`;
  }

  return `Последнее: ${formatLocalDateLabel(startedAt, {
    day: 'numeric',
    month: 'long',
  })} в ${formatLocalClock(startedAt)} · ${feeding.volumeMl} мл`;
}

export function formatBottleFeedingStatsLine(stats: BottleFeedingStats): string {
  return `${stats.totalVolumeMl} мл · ${formatBottleFeedingCount(stats.count)}`;
}

export function formatTodayBottleFeedingStatsLine(stats: BottleFeedingStats): string {
  if (stats.count === 0) {
    return 'Сегодня: пока нет записей';
  }

  return `Сегодня: ${stats.totalVolumeMl} мл · ${formatBottleFeedingCount(stats.count)}`;
}

export function formatTodayBottleFeedingStatsWithTopUpsLine(
  feedings: readonly Pick<BottleFeeding, 'volumeMl'>[],
  topUpThresholdMl: number,
): string {
  const stats = calculateBottleFeedingTopUpStats(feedings, topUpThresholdMl);
  const totalCount = stats.regularCount + stats.topUpCount;

  if (totalCount === 0) {
    return 'Сегодня: пока нет записей';
  }

  if (stats.topUpCount === 0) {
    return `Сегодня: ${stats.totalVolumeMl} мл · ${formatBottleFeedingCount(
      stats.regularCount,
    )}`;
  }

  const countLabel =
    stats.regularCount > 0
      ? `${formatBottleFeedingCount(stats.regularCount)} и ${formatBottleFeedingTopUpCount(
          stats.topUpCount,
        )}`
      : formatBottleFeedingTopUpCount(stats.topUpCount);

  return `Сегодня: ${stats.totalVolumeMl} мл · ${countLabel}`;
}

export function formatBottleFeedingReminderInterval(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    return 'выбранное время';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} мин`;
  }

  if (remainingMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${remainingMinutes} мин`;
}

export function formatBottleFeedingReminderStatusLine(input: {
  remindersEnabled: boolean;
  reminderIntervalMinutes: number;
  notifyDuringSleep: boolean;
}): string {
  if (!input.remindersEnabled) {
    return 'Напоминания выключены';
  }

  const interval = formatBottleFeedingReminderInterval(input.reminderIntervalMinutes);

  if (!input.notifyDuringSleep) {
    return `Через ${interval} после кормления, если ребёнок не спит`;
  }

  return `Через ${interval} после кормления`;
}
