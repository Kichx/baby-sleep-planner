import { describe, expect, it } from 'vitest';

import {
  buildDayFeedItems,
  buildBottleFeedingDayFeedItem,
  buildSleepDayFeedItem,
  countDayFeedRecords,
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

  it('nests a bottle feeding that happened during night sleep', () => {
    const rangeStart = new Date('2026-06-03T03:00:00.000Z');
    const rangeEnd = new Date('2026-06-04T03:00:00.000Z');
    const nightSleep = buildSleepSession({
      endedAt: '2026-06-03T03:58:00.000Z',
      id: 'night-sleep',
      startedAt: '2026-06-02T17:58:00.000Z',
    });
    const nightFeeding = buildBottleFeeding({
      id: 'night-feeding',
      startedAt: '2026-06-03T01:00:00.000Z',
      volumeMl: 150,
    });

    const items = buildDayFeedItems({
      feedings: [nightFeeding],
      now: new Date('2026-06-03T04:01:00.000Z'),
      rangeEnd,
      rangeStart,
      sessions: [nightSleep],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'night-sleep',
      type: 'sleep',
    });
    expect(items[0].type === 'sleep' ? items[0].sleepFeedings.map((feeding) => feeding.id) : []).toEqual([
      'night-feeding',
    ]);
    expect(countDayFeedRecords(items)).toBe(2);
  });

  it('nests a bottle feeding that happened during a nap', () => {
    const rangeStart = new Date('2026-06-03T03:00:00.000Z');
    const rangeEnd = new Date('2026-06-04T03:00:00.000Z');
    const nap = buildSleepSession({
      endedAt: '2026-06-03T10:10:00.000Z',
      id: 'nap',
      startedAt: '2026-06-03T09:30:00.000Z',
    });
    const napFeeding = buildBottleFeeding({
      id: 'nap-feeding',
      startedAt: '2026-06-03T09:45:00.000Z',
      volumeMl: 90,
    });

    const items = buildDayFeedItems({
      feedings: [napFeeding],
      now: new Date('2026-06-03T11:00:00.000Z'),
      rangeEnd,
      rangeStart,
      sessions: [nap],
    });

    expect(items).toHaveLength(1);
    expect(items[0].type === 'sleep' ? items[0].sleepFeedings.map((feeding) => feeding.id) : []).toEqual([
      'nap-feeding',
    ]);
  });

  it('nests a feeding even when it should not be shown as a standalone row in that group', () => {
    const rangeStart = new Date('2026-06-03T03:00:00.000Z');
    const rangeEnd = new Date('2026-06-04T03:00:00.000Z');
    const nightSleep = buildSleepSession({
      endedAt: '2026-06-03T03:58:00.000Z',
      id: 'night-sleep',
      startedAt: '2026-06-02T17:58:00.000Z',
    });
    const previousCalendarFeeding = buildBottleFeeding({
      id: 'previous-calendar-feeding',
      startedAt: '2026-06-02T19:30:00.000Z',
      volumeMl: 120,
    });

    const items = buildDayFeedItems({
      feedings: [previousCalendarFeeding],
      now: new Date('2026-06-03T04:01:00.000Z'),
      rangeEnd,
      rangeStart,
      sessions: [nightSleep],
      standaloneFeedings: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0].type === 'sleep' ? items[0].sleepFeedings.map((feeding) => feeding.id) : []).toEqual([
      'previous-calendar-feeding',
    ]);
    expect(countDayFeedRecords(items)).toBe(2);
  });

  it('keeps bottle feeding outside sleep as a standalone row', () => {
    const rangeStart = new Date('2026-06-03T03:00:00.000Z');
    const rangeEnd = new Date('2026-06-04T03:00:00.000Z');
    const nap = buildSleepSession({
      endedAt: '2026-06-03T10:10:00.000Z',
      id: 'nap',
      startedAt: '2026-06-03T09:30:00.000Z',
    });
    const afterNapFeeding = buildBottleFeeding({
      id: 'after-nap-feeding',
      startedAt: '2026-06-03T10:20:00.000Z',
      volumeMl: 120,
    });

    const items = buildDayFeedItems({
      feedings: [afterNapFeeding],
      now: new Date('2026-06-03T11:00:00.000Z'),
      rangeEnd,
      rangeStart,
      sessions: [nap],
    });

    expect(items.map((item) => item.id)).toEqual(['after-nap-feeding', 'nap']);
    expect(items.find((item) => item.type === 'sleep' && item.id === 'nap')).toMatchObject({
      sleepFeedings: [],
    });
    expect(countDayFeedRecords(items)).toBe(2);
  });
});
