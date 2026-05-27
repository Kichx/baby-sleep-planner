import { describe, expect, it } from 'vitest';

import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import {
  getSleepDayDateKeyForDate,
  getSleepDayDateKeysForInterval,
} from '@/core/sleepDay';

describe('sleep day date keys', () => {
  it('assigns early morning time to the previous sleep day', () => {
    expect(getSleepDayDateKeyForDate(new Date(2026, 0, 2, 6, 30), DEFAULT_SLEEP_PLAN)).toBe(
      '2026-01-01',
    );
  });

  it('assigns daytime time to its calendar sleep day', () => {
    expect(getSleepDayDateKeyForDate(new Date(2026, 0, 2, 7, 30), DEFAULT_SLEEP_PLAN)).toBe(
      '2026-01-02',
    );
  });

  it('returns every sleep day touched by a long interval', () => {
    expect(
      getSleepDayDateKeysForInterval(
        new Date(2026, 0, 2, 22, 0),
        new Date(2026, 0, 3, 8, 0),
        DEFAULT_SLEEP_PLAN,
      ),
    ).toEqual(['2026-01-02', '2026-01-03']);
  });

  it('does not include the next sleep day when an interval ends exactly at day start', () => {
    expect(
      getSleepDayDateKeysForInterval(
        new Date(2026, 0, 2, 22, 0),
        new Date(2026, 0, 3, 7, 0),
        DEFAULT_SLEEP_PLAN,
      ),
    ).toEqual(['2026-01-02']);
  });
});
