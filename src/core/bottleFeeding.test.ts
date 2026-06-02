import { describe, expect, it } from 'vitest';

import {
  BOTTLE_FEEDING_EMPTY_TEXT,
  calculateBottleFeedingStats,
  calculateBottleFeedingStatsInRange,
  formatBottleFeedingCount,
  formatBottleFeedingElapsed,
  formatBottleFeedingRecordLine,
  formatBottleFeedingReminderBody,
  formatBottleFeedingStatsLine,
  formatLatestBottleFeedingLine,
  formatTodayBottleFeedingStatsLine,
  getLast24HoursBottleFeedingRange,
  getTodayBottleFeedingRange,
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

  it('formats Russian feeding count forms', () => {
    expect(formatBottleFeedingCount(1)).toBe('1 кормление');
    expect(formatBottleFeedingCount(2)).toBe('2 кормления');
    expect(formatBottleFeedingCount(5)).toBe('5 кормлений');
    expect(formatBottleFeedingCount(21)).toBe('21 кормление');
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
});
