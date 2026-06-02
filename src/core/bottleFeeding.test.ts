import { describe, expect, it } from 'vitest';

import {
  calculateBottleFeedingStats,
  calculateBottleFeedingStatsInRange,
  getLast24HoursBottleFeedingRange,
  getTodayBottleFeedingRange,
} from '@/core/bottleFeeding';
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
});
