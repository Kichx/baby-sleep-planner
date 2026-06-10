import { describe, expect, it } from 'vitest';

import {
  filterSleepSessionsForDisplayedDay,
  sleepSessionOverlapsDisplayedDay,
} from '@/core/mainScreenDaySessions';
import type { SleepKind, SleepSession } from '@/types/sleep';

function buildSleepSession(input: {
  endedAt: string | null;
  id: string;
  kind?: SleepKind;
  startedAt: string;
}): SleepSession {
  return {
    childId: 'default-child',
    endedAt: input.endedAt,
    id: input.id,
    kind: input.kind ?? 'nap',
    startedAt: input.startedAt,
  };
}

describe('main screen displayed day sleep sessions', () => {
  const dayStart = new Date('2026-06-10T07:00:00.000Z');
  const dayEnd = new Date('2026-06-11T07:00:00.000Z');
  const now = new Date('2026-06-10T07:20:00.000Z');

  it('can include the completed night sleep that ends exactly at the displayed day start', () => {
    const nightSleep = buildSleepSession({
      endedAt: '2026-06-10T07:00:00.000Z',
      id: 'night-sleep',
      kind: 'night',
      startedAt: '2026-06-09T20:00:00.000Z',
    });

    expect(
      sleepSessionOverlapsDisplayedDay(nightSleep, dayStart, dayEnd, now, {
        includeNightEndingAtStart: true,
      }),
    ).toBe(true);
  });

  it('keeps the boundary night sleep out when the caller does not request wake context', () => {
    const nightSleep = buildSleepSession({
      endedAt: '2026-06-10T07:00:00.000Z',
      id: 'night-sleep',
      kind: 'night',
      startedAt: '2026-06-09T20:00:00.000Z',
    });

    expect(sleepSessionOverlapsDisplayedDay(nightSleep, dayStart, dayEnd, now)).toBe(
      false,
    );
  });

  it('does not include previous-day naps that ended at the day start', () => {
    const earlyNap = buildSleepSession({
      endedAt: '2026-06-10T07:00:00.000Z',
      id: 'early-nap',
      kind: 'nap',
      startedAt: '2026-06-10T06:40:00.000Z',
    });

    expect(
      sleepSessionOverlapsDisplayedDay(earlyNap, dayStart, dayEnd, now, {
        includeNightEndingAtStart: true,
      }),
    ).toBe(false);
  });

  it('filters today wake context without pulling in previous-day daytime sleep', () => {
    const nightSleep = buildSleepSession({
      endedAt: '2026-06-10T07:00:00.000Z',
      id: 'night-sleep',
      kind: 'night',
      startedAt: '2026-06-09T20:00:00.000Z',
    });
    const previousNap = buildSleepSession({
      endedAt: '2026-06-10T07:00:00.000Z',
      id: 'previous-nap',
      kind: 'nap',
      startedAt: '2026-06-10T06:30:00.000Z',
    });
    const morningNap = buildSleepSession({
      endedAt: '2026-06-10T10:30:00.000Z',
      id: 'morning-nap',
      kind: 'nap',
      startedAt: '2026-06-10T09:30:00.000Z',
    });

    expect(
      filterSleepSessionsForDisplayedDay(
        [nightSleep, previousNap, morningNap],
        dayStart,
        dayEnd,
        now,
        { includeNightEndingAtStart: true },
      ).map((session) => session.id),
    ).toEqual(['night-sleep', 'morning-nap']);
  });
});
