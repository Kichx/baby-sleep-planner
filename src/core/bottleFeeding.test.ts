import { describe, expect, it } from 'vitest';

import {
  BOTTLE_FEEDING_EMPTY_TEXT,
  calculateBottleFeedingStats,
  calculateBottleFeedingStatsInRange,
  calculateBottleFeedingTopUpStats,
  filterBottleFeedingsInCalendarDay,
  formatBottleFeedingCount,
  formatBottleFeedingElapsed,
  formatBottleFeedingRecordLine,
  formatBottleFeedingReminderBody,
  formatBottleFeedingReminderInterval,
  formatBottleFeedingReminderStatusLine,
  formatBottleFeedingTopUpThresholdLine,
  formatBottleFeedingTopUpCount,
  formatBottleFeedingStatsLine,
  formatLatestBottleFeedingLine,
  formatTodayBottleFeedingStatsLine,
  formatTodayBottleFeedingStatsWithTopUpsLine,
  getBottleFeedingCalendarDayRange,
  getLast24HoursBottleFeedingRange,
  getTodayBottleFeedingRange,
  isBottleFeedingTopUp,
  isBottleFeedingTopUpVolume,
} from '@/core/bottleFeeding';
import {
  formatLocalClock,
  formatLocalDateLabel,
} from '@/core/localDateTime';
import type { BottleFeeding } from '@/types/bottleFeeding';

function feeding(id: string, startedAt: string, volumeMl: number): BottleFeeding {
  return {
    childId: 'default-child',
    createdAt: startedAt,
    id,
    startedAt,
    updatedAt: startedAt,
    volumeMl,
  };
}

describe('bottle feeding calculations', () => {
  it('builds today range from the local calendar day', () => {
    const now = new Date('2026-05-30T21:30:00.000Z');
    const range = getTodayBottleFeedingRange(now, 'Europe/Moscow');

    expect(range.start.toISOString()).toBe('2026-05-30T21:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-05-31T21:00:00.000Z');
  });

  it('builds a calendar day range for any displayed feeding day', () => {
    const selectedDay = new Date('2026-06-03T09:00:00.000Z');
    const range = getBottleFeedingCalendarDayRange(selectedDay, 'Europe/Moscow');

    expect(range.start.toISOString()).toBe('2026-06-02T21:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-06-03T21:00:00.000Z');
  });

  it('keeps an early morning feeding on the same local calendar day', () => {
    const selectedDay = new Date('2026-06-03T09:00:00.000Z');
    const previousDay = new Date('2026-06-02T09:00:00.000Z');
    const earlyMorningFeeding = feeding(
      'early-morning',
      '2026-06-03T01:00:00.000Z',
      150,
    );

    expect(
      filterBottleFeedingsInCalendarDay(
        [earlyMorningFeeding],
        selectedDay,
        'Europe/Moscow',
      ).map((item) => item.id),
    ).toEqual(['early-morning']);
    expect(
      filterBottleFeedingsInCalendarDay(
        [earlyMorningFeeding],
        previousDay,
        'Europe/Moscow',
      ),
    ).toEqual([]);
  });

  it('builds the last 24 hours range from now', () => {
    const now = new Date('2026-05-31T12:15:00.000Z');
    const range = getLast24HoursBottleFeedingRange(now);

    expect(range.start.toISOString()).toBe('2026-05-30T12:15:00.000Z');
    expect(range.end.toISOString()).toBe('2026-05-31T12:15:00.000Z');
  });

  it('counts feedings and sums volume', () => {
    expect(
      calculateBottleFeedingStats([
        feeding('feeding-1', '2026-05-31T06:00:00.000Z', 90),
        feeding('feeding-2', '2026-05-31T09:00:00.000Z', 120),
      ]),
    ).toEqual({
      count: 2,
      totalVolumeMl: 210,
    });
  });

  it('keeps yesterday out of today while still counting it in the last 24 hours', () => {
    const now = new Date('2026-06-01T07:00:00.000Z');
    const yesterdayWithin24Hours = feeding(
      'yesterday-within-24h',
      '2026-05-31T17:00:00.000Z',
      90,
    );
    const todayFeeding = feeding('today', '2026-06-01T06:30:00.000Z', 120);
    const feedings = [yesterdayWithin24Hours, todayFeeding];
    const todayRange = getTodayBottleFeedingRange(now, 'Europe/Moscow');
    const last24HoursRange = getLast24HoursBottleFeedingRange(now);

    expect(
      calculateBottleFeedingStatsInRange(feedings, todayRange.start, todayRange.end),
    ).toEqual({
      count: 1,
      totalVolumeMl: 120,
    });
    expect(
      calculateBottleFeedingStatsInRange(
        feedings,
        last24HoursRange.start,
        last24HoursRange.end,
      ),
    ).toEqual({
      count: 2,
      totalVolumeMl: 210,
    });
  });

  it('calculates stats inside a half-open period', () => {
    const feedings = [
      feeding('before', '2026-05-31T05:59:59.000Z', 60),
      feeding('inside-1', '2026-05-31T06:00:00.000Z', 90),
      feeding('inside-2', '2026-05-31T08:30:00.000Z', 100),
      feeding('at-end', '2026-05-31T10:00:00.000Z', 150),
    ];

    expect(
      calculateBottleFeedingStatsInRange(
        feedings,
        new Date('2026-05-31T06:00:00.000Z'),
        new Date('2026-05-31T10:00:00.000Z'),
      ),
    ).toEqual({
      count: 2,
      totalVolumeMl: 190,
    });
  });

  it('formats feeding elapsed time clearly', () => {
    expect(
      formatBottleFeedingElapsed(
        new Date('2026-05-31T09:00:30.000Z'),
        new Date('2026-05-31T09:00:45.000Z'),
      ),
    ).toBe('только что');
    expect(
      formatBottleFeedingElapsed(
        new Date('2026-05-31T09:00:00.000Z'),
        new Date('2026-05-31T09:15:00.000Z'),
      ),
    ).toBe('15 мин назад');
    expect(
      formatBottleFeedingElapsed(
        new Date('2026-05-31T09:00:00.000Z'),
        new Date('2026-05-31T10:00:00.000Z'),
      ),
    ).toBe('1 ч назад');
    expect(
      formatBottleFeedingElapsed(
        new Date('2026-05-31T09:00:00.000Z'),
        new Date('2026-05-31T11:15:00.000Z'),
      ),
    ).toBe('2 ч 15 мин назад');
  });

  it('formats the first fresh feeding as just now with volume', () => {
    const now = new Date('2026-05-31T09:00:45.000Z');

    expect(
      formatLatestBottleFeedingLine(
        feeding('first-feeding', '2026-05-31T09:00:30.000Z', 90),
        now,
      ),
    ).toBe('только что · 90 мл');
  });

  it('formats Russian feeding count forms', () => {
    expect(formatBottleFeedingCount(1)).toBe('1 кормление');
    expect(formatBottleFeedingCount(2)).toBe('2 кормления');
    expect(formatBottleFeedingCount(5)).toBe('5 кормлений');
    expect(formatBottleFeedingCount(21)).toBe('21 кормление');
    expect(formatBottleFeedingTopUpCount(1)).toBe('1 доешка');
    expect(formatBottleFeedingTopUpCount(2)).toBe('2 доешки');
    expect(formatBottleFeedingTopUpCount(5)).toBe('5 доешек');
  });

  it('formats the latest feeding for today, yesterday, older days, and empty state', () => {
    const now = new Date('2026-05-31T12:15:00.000Z');
    const todayFeeding = feeding('today', '2026-05-31T10:00:00.000Z', 120);
    const yesterdayFeeding = feeding('yesterday', '2026-05-30T10:00:00.000Z', 90);
    const olderFeeding = feeding('older', '2026-05-28T10:00:00.000Z', 150);
    const yesterdayClock = formatLocalClock(new Date(yesterdayFeeding.startedAt));
    const olderDate = formatLocalDateLabel(new Date(olderFeeding.startedAt), {
      day: 'numeric',
      month: 'long',
    });
    const olderClock = formatLocalClock(new Date(olderFeeding.startedAt));

    expect(formatLatestBottleFeedingLine(todayFeeding, now)).toBe(
      '2 ч 15 мин назад · 120 мл',
    );
    expect(formatLatestBottleFeedingLine(yesterdayFeeding, now)).toBe(
      `Последнее: вчера в ${yesterdayClock} · 90 мл`,
    );
    expect(formatLatestBottleFeedingLine(olderFeeding, now)).toBe(
      `Последнее: ${olderDate} в ${olderClock} · 150 мл`,
    );
    expect(formatLatestBottleFeedingLine(null, now)).toBe(BOTTLE_FEEDING_EMPTY_TEXT);
  });

  it('formats today stats, generic stats, and feeding rows', () => {
    const item = feeding('feeding-1', '2026-05-31T09:00:00.000Z', 120);

    expect(formatTodayBottleFeedingStatsLine({ count: 0, totalVolumeMl: 0 })).toBe(
      'Сегодня: пока нет записей',
    );
    expect(formatTodayBottleFeedingStatsLine({ count: 2, totalVolumeMl: 210 })).toBe(
      'Сегодня: 210 мл · 2 кормления',
    );
    expect(formatBottleFeedingStatsLine({ count: 5, totalVolumeMl: 450 })).toBe(
      '450 мл · 5 кормлений',
    );
    expect(formatBottleFeedingRecordLine(item)).toBe(
      `${formatLocalClock(new Date(item.startedAt))} · 120 мл`,
    );
    expect(formatBottleFeedingReminderBody(item)).toBe(
      `Последнее: 120 мл в ${formatLocalClock(new Date(item.startedAt))}`,
    );
  });

  it('marks top-up feedings inclusively by threshold volume', () => {
    expect(isBottleFeedingTopUpVolume(30, 30)).toBe(true);
    expect(isBottleFeedingTopUpVolume(31, 30)).toBe(false);
    expect(isBottleFeedingTopUp(feeding('small', '2026-05-31T06:00:00.000Z', 60), 60)).toBe(
      true,
    );
    expect(isBottleFeedingTopUp(feeding('regular', '2026-05-31T06:00:00.000Z', 90), 60)).toBe(
      false,
    );
    expect(isBottleFeedingTopUpVolume(30, 0)).toBe(false);
  });

  it('formats today stats with top-ups separated from regular feedings', () => {
    const feedings = [
      feeding('regular-1', '2026-05-31T06:00:00.000Z', 120),
      feeding('top-up', '2026-05-31T08:00:00.000Z', 30),
      feeding('regular-2', '2026-05-31T10:00:00.000Z', 150),
    ];

    expect(calculateBottleFeedingTopUpStats(feedings, 30)).toEqual({
      regularCount: 2,
      topUpCount: 1,
      totalVolumeMl: 300,
    });
    expect(formatTodayBottleFeedingStatsWithTopUpsLine(feedings, 30)).toBe(
      'Сегодня: 300 мл · 2 кормления и 1 доешка',
    );
    expect(formatTodayBottleFeedingStatsWithTopUpsLine(feedings, 20)).toBe(
      'Сегодня: 300 мл · 3 кормления',
    );
    expect(
      formatTodayBottleFeedingStatsWithTopUpsLine(
        [feeding('top-up-only', '2026-05-31T08:00:00.000Z', 30)],
        30,
      ),
    ).toBe('Сегодня: 30 мл · 1 доешка');
  });

  it('formats reminder status lines calmly', () => {
    expect(formatBottleFeedingReminderInterval(45)).toBe('45 мин');
    expect(formatBottleFeedingReminderInterval(180)).toBe('3 ч');
    expect(formatBottleFeedingReminderInterval(150)).toBe('2 ч 30 мин');
    expect(formatBottleFeedingReminderInterval(0)).toBe('выбранное время');
    expect(
      formatBottleFeedingReminderStatusLine({
        notifyDuringSleep: true,
        reminderIntervalMinutes: 180,
        remindersEnabled: false,
      }),
    ).toBe('Напоминания выключены');
    expect(
      formatBottleFeedingReminderStatusLine({
        notifyDuringSleep: true,
        reminderIntervalMinutes: 180,
        remindersEnabled: true,
      }),
    ).toBe('Через 3 ч после кормления');
    expect(
      formatBottleFeedingReminderStatusLine({
        notifyDuringSleep: false,
        reminderIntervalMinutes: 150,
        remindersEnabled: true,
      }),
    ).toBe('Через 2 ч 30 мин после кормления, если ребёнок не спит');
    expect(formatBottleFeedingTopUpThresholdLine(60)).toBe('До 60 мл включительно');
  });
});
