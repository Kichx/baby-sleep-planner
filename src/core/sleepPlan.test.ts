import { describe, expect, it } from 'vitest';

import { deriveEveningSleepRulesForPlan } from '@/core/sleepPlan';

const basePlan = {
  targetAwakeMaxMinutes: 10 * 60,
  targetAwakeMinMinutes: 10 * 60,
  targetDaySleepMaxMinutes: 3 * 60,
  targetDaySleepMinMinutes: 3 * 60,
  wakeUpEndMinutes: 7 * 60,
  wakeUpStartMinutes: 7 * 60,
};

describe('deriveEveningSleepRulesForPlan', () => {
  it('keeps a three-nap default permissive for a short evening bridge', () => {
    expect(deriveEveningSleepRulesForPlan({ ...basePlan, napCount: 3 })).toEqual({
      latestEveningNapEndMinutes: 20 * 60,
      maxEveningNapMinutes: 45,
      microNapMinutes: 20,
    });
  });

  it('moves the evening cutoff earlier when the plan has fewer naps', () => {
    expect(deriveEveningSleepRulesForPlan({ ...basePlan, napCount: 2 })).toMatchObject({
      latestEveningNapEndMinutes: 18 * 60,
      maxEveningNapMinutes: 40,
      microNapMinutes: 15,
    });

    expect(deriveEveningSleepRulesForPlan({ ...basePlan, napCount: 1 })).toMatchObject({
      latestEveningNapEndMinutes: 17 * 60,
      maxEveningNapMinutes: 30,
      microNapMinutes: 0,
    });
  });
});
