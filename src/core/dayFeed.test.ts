import { describe, expect, it } from 'vitest';

import {
  buildBottleFeedingDayFeedItem,
  buildSleepDayFeedItem,
  getSleepDayFeedSortAt,
  sortDayFeedItemsNewestFirst,
} from '@/core/dayFeed';
import type { BottleFeeding } from '@/types/bottleFeeding';
import type { SleepSession } from '@/types/sleep';

function buildSleepSession(input: {
  endedAt: string | null;
  id: string;
  startedAt: string;
}): SleepSession {
  return {
    childId: 'default-child',
    endedAt: input.endedAt,
    id: input.id,
    kind: 'night',
    startedAt: input.startedAt,
  };
}

function buildBottleFeeding(input: {
  id: string;
  startedAt: string;
  volumeMl?: number;
}): BottleFeeding {
  return {
    childId: 'default-child',
    createdAt: input.startedAt,
    id: input.id,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    volumeMl: input.volumeMl ?? 180,
  };
}

describe('day feed sorting', () => {
  it('uses the visible day start for sleep that began before the displayed range', () => {
    const rangeStart = new Date('2026-06-02T07:00:00.000Z');
    const sleep = buildSleepSession({
      endedAt: '2026-06-02T07:20:00.000Z',
      id: 'night-sleep',
      startedAt: '2026-06-01T20:30:00.000Z',
    });

    expect(getSleepDayFeedSortAt(sleep, rangeStart).toISOString()).toBe(
      '2026-06-02T07:00:00.000Z',
    );
  });

  it('sorts records from newest to oldest in the same displayed day', () => {
    const rangeStart = new Date('2026-06-02T07:00:00.000Z');
    const nightSleep = buildSleepSession({
      endedAt: '2026-06-02T07:20:00.000Z',
      id: 'night-sleep',
      startedAt: '2026-06-01T20:30:00.000Z',
    });
    const morningFeeding = buildBottleFeeding({
      id: 'morning-feeding',
      startedAt: '2026-06-02T07:05:00.000Z',
    });
    const nap = buildSleepSession({
      endedAt: '2026-06-02T10:30:00.000Z',
      id: 'nap',
      startedAt: '2026-06-02T09:30:00.000Z',
    });

    const sortedIds = sortDayFeedItemsNewestFirst([
      buildSleepDayFeedItem(nap, rangeStart),
      buildBottleFeedingDayFeedItem(morningFeeding),
      buildSleepDayFeedItem(nightSleep, rangeStart),
    ]).map((item) => item.id);

    expect(sortedIds).toEqual(['nap', 'morning-feeding', 'night-sleep']);
  });

  it('keeps sleep before feeding when both have the same visible time', () => {
    const rangeStart = new Date('2026-06-02T07:00:00.000Z');
    const sleep = buildSleepSession({
      endedAt: '2026-06-02T07:15:00.000Z',
      id: 'sleep',
      startedAt: '2026-06-01T20:30:00.000Z',
    });
    const feeding = buildBottleFeeding({
      id: 'feeding',
      startedAt: '2026-06-02T07:00:00.000Z',
    });

    const sortedIds = sortDayFeedItemsNewestFirst([
      buildBottleFeedingDayFeedItem(feeding),
      buildSleepDayFeedItem(sleep, rangeStart),
    ]).map((item) => item.id);

    expect(sortedIds).toEqual(['sleep', 'feeding']);
  });
});
