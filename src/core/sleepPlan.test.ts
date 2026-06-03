import { describe, expect, it } from 'vitest';

import {
  buildEffectiveSleepDayPlan,
  buildSleepPlanPreset,
  deriveEarlyWakePlan,
  deriveEveningSleepRulesForPlan,
  deriveSoftDayPlan,
  shouldSuggestEarlyWakeMode,
} from '@/core/sleepPlan';
import type { SleepDayTemporaryMode, TargetDayPlan } from '@/types/sleep';

const basePlan = {
  targetAwakeMaxMinutes: 10 * 60,
  targetAwakeMinMinutes: 10 * 60,
  targetDaySleepMaxMinutes: 3 * 60,
  targetDaySleepMinMinutes: 3 * 60,
  wakeUpEndMinutes: 7 * 60,
  wakeUpStartMinutes: 7 * 60,
};

const targetPlanBaseInput = {
  minNightSleepMinutes: 3 * 60,
  napCount: 3,
  targetAwakeMaxMinutes: 10 * 60 + 30,
  targetAwakeMinMinutes: 10 * 60,
  targetDaySleepMaxMinutes: 3 * 60 + 30,
  targetDaySleepMinMinutes: 3 * 60,
  wakeUpEndMinutes: 7 * 60 + 30,
  wakeUpStartMinutes: 7 * 60,
};

function createTargetDayPlan(): TargetDayPlan {
  return {
    childId: 'default-child',
    eveningRulesMode: 'custom',
    id: 'base-plan',
    isActive: true,
    name: 'Base plan',
    plan: buildSleepPlanPreset({
      ...targetPlanBaseInput,
      latestEveningNapEndMinutes: 21 * 60,
      maxEveningNapMinutes: 55,
      microNapMinutes: 10,
    }),
    updatedAt: '2026-06-03T06:00:00.000Z',
  };
}

function createTemporaryMode(mode: SleepDayTemporaryMode['mode']): SleepDayTemporaryMode {
  return {
    basePlanId: 'base-plan',
    childId: 'default-child',
    createdAt: '2026-06-03T06:00:00.000Z',
    disabledAt: null,
    dismissedAt: null,
    id: `mode-${mode}`,
    mode,
    sleepDayDateKey: '2026-06-03',
  };
}

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

describe('effective sleep day plan', () => {
  it('reduces total awake time by 30 minutes for a soft day', () => {
    const baseTargetPlan = createTargetDayPlan();
    const softDayPlan = deriveSoftDayPlan(baseTargetPlan);

    expect(softDayPlan.plan.targetAwakeMinMinutes).toBe(
      baseTargetPlan.plan.targetAwakeMinMinutes - 30,
    );
    expect(softDayPlan.plan.targetAwakeMaxMinutes).toBe(
      baseTargetPlan.plan.targetAwakeMaxMinutes - 30,
    );
    expect(softDayPlan.plan.targetAwakeMinutes).toBe(baseTargetPlan.plan.targetAwakeMinutes - 30);
  });

  it('does not change nap count for a soft day', () => {
    const baseTargetPlan = createTargetDayPlan();
    const softDayPlan = deriveSoftDayPlan(baseTargetPlan);

    expect(softDayPlan.plan.napCount).toBe(baseTargetPlan.plan.napCount);
  });

  it('does not change wake-up range for a soft day', () => {
    const baseTargetPlan = createTargetDayPlan();
    const softDayPlan = deriveSoftDayPlan(baseTargetPlan);

    expect(softDayPlan.plan.dayStartMinutes).toBe(baseTargetPlan.plan.dayStartMinutes);
    expect(softDayPlan.plan.wakeUpStartMinutes).toBe(baseTargetPlan.plan.wakeUpStartMinutes);
    expect(softDayPlan.plan.wakeUpEndMinutes).toBe(baseTargetPlan.plan.wakeUpEndMinutes);
  });

  it('softens the first wake window for an early wake day', () => {
    const baseTargetPlan = createTargetDayPlan();
    const earlyWakePlan = deriveEarlyWakePlan(
      baseTargetPlan,
      new Date('2026-06-03T06:15:00'),
    );

    expect(earlyWakePlan.plan.wakeWindows[0]).toMatchObject({
      maxWakeMinutes: baseTargetPlan.plan.wakeWindows[0].maxWakeMinutes - 30,
      minWakeMinutes: baseTargetPlan.plan.wakeWindows[0].minWakeMinutes - 30,
      targetWakeMinutes: baseTargetPlan.plan.wakeWindows[0].targetWakeMinutes - 30,
    });
    expect(earlyWakePlan.plan.wakeWindows[1]).toEqual(baseTargetPlan.plan.wakeWindows[1]);
    expect(earlyWakePlan.plan.napCount).toBe(baseTargetPlan.plan.napCount);
  });

  it('suggests early wake mode when wake-up is 30 minutes or more before the plan', () => {
    expect(
      shouldSuggestEarlyWakeMode({
        actualWakeMinutes: 6 * 60 + 25,
        alreadyDismissed: false,
        alreadyEnabled: false,
        planWakeWindowStartMinutes: 7 * 60,
      }),
    ).toBe(true);
  });

  it('does not suggest early wake mode when it is already enabled', () => {
    expect(
      shouldSuggestEarlyWakeMode({
        actualWakeMinutes: 6 * 60,
        alreadyDismissed: false,
        alreadyEnabled: true,
        planWakeWindowStartMinutes: 7 * 60,
      }),
    ).toBe(false);
  });

  it('does not suggest early wake mode when the suggestion was dismissed', () => {
    expect(
      shouldSuggestEarlyWakeMode({
        actualWakeMinutes: 6 * 60,
        alreadyDismissed: true,
        alreadyEnabled: false,
        planWakeWindowStartMinutes: 7 * 60,
      }),
    ).toBe(false);
  });

  it('builds effective plans in early wake then soft day then evening auto order', () => {
    const baseTargetPlan = createTargetDayPlan();
    const softOnlyPlan = deriveSoftDayPlan(baseTargetPlan);
    const effectivePlan = buildEffectiveSleepDayPlan(
      baseTargetPlan,
      [createTemporaryMode('soft_day'), createTemporaryMode('early_wake')],
      { actualWakeTime: new Date('2026-06-03T06:00:00') },
    );
    const expectedEveningRules = deriveEveningSleepRulesForPlan({
      napCount: softOnlyPlan.plan.napCount,
      targetAwakeMaxMinutes: softOnlyPlan.plan.targetAwakeMaxMinutes,
      targetAwakeMinMinutes: softOnlyPlan.plan.targetAwakeMinMinutes,
      targetDaySleepMaxMinutes: softOnlyPlan.plan.targetDaySleepMaxMinutes,
      targetDaySleepMinMinutes: softOnlyPlan.plan.targetDaySleepMinMinutes,
      wakeUpEndMinutes: softOnlyPlan.plan.wakeUpEndMinutes,
      wakeUpStartMinutes: softOnlyPlan.plan.wakeUpStartMinutes,
    });

    expect(effectivePlan.plan.targetAwakeMinutes).toBe(softOnlyPlan.plan.targetAwakeMinutes);
    expect(effectivePlan.plan.targetDaySleepMaxMinutes).toBe(
      baseTargetPlan.plan.targetDaySleepMaxMinutes + 30,
    );
    expect(effectivePlan.plan.wakeWindows[0]).toMatchObject({
      maxWakeMinutes: softOnlyPlan.plan.wakeWindows[0].maxWakeMinutes - 30,
      minWakeMinutes: softOnlyPlan.plan.wakeWindows[0].minWakeMinutes - 30,
      targetWakeMinutes: softOnlyPlan.plan.wakeWindows[0].targetWakeMinutes - 30,
    });
    expect(effectivePlan.plan.wakeWindows[1]).toEqual(softOnlyPlan.plan.wakeWindows[1]);
    expect(effectivePlan.plan).toMatchObject(expectedEveningRules);
  });

  it('does not mutate the base target day plan', () => {
    const baseTargetPlan = createTargetDayPlan();
    const before = structuredClone(baseTargetPlan);
    const effectivePlan = buildEffectiveSleepDayPlan(
      baseTargetPlan,
      [createTemporaryMode('early_wake'), createTemporaryMode('soft_day')],
      { actualWakeTime: new Date('2026-06-03T06:00:00') },
    );

    expect(baseTargetPlan).toEqual(before);
    expect(effectivePlan).not.toBe(baseTargetPlan);
    expect(effectivePlan.plan).not.toBe(baseTargetPlan.plan);
    expect(effectivePlan.plan.wakeWindows).not.toBe(baseTargetPlan.plan.wakeWindows);
  });
});
