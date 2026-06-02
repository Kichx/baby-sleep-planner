import {
  addLocalCalendarDays,
  startOfLocalCalendarDay,
} from '@/core/localDateTime';
import type { BottleFeeding, BottleFeedingStats } from '@/types/bottleFeeding';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
