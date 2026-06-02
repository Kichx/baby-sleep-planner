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

export function getTodayBottleFeedingRange(
  now: Date,
  timeZone?: string,
): BottleFeedingDateRange {
  const start = startOfLocalCalendarDay(now, timeZone);
  const nextDay = addLocalCalendarDays(now, 1, timeZone);
  const end = startOfLocalCalendarDay(nextDay, timeZone);

  return { end, start };
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

export function calculateBottleFeedingStats(
  feedings: readonly Pick<BottleFeeding, 'volumeMl'>[],
): BottleFeedingStats {
  return {
    count: feedings.length,
    totalVolumeMl: feedings.reduce((total, feeding) => total + feeding.volumeMl, 0),
  };
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
