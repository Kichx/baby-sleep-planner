import { describe, expect, it } from 'vitest';

import {
  PLAN_CHECK_AWAKE_DESCRIPTION,
  buildSleepPlanChecks,
} from '@/core/sleepPlanChecks';
import { buildEffectiveSleepDayPlan, buildSleepPlanPreset } from '@/core/sleepPlan';
import type { SleepDayTemporaryMode, TargetDayPlan } from '@/types/sleep';

function buildPlan(input?: Partial<Parameters<typeof buildSleepPlanPreset>[0]>) {
  const baseInput: Parameters<typeof buildSleepPlanPreset>[0] = {
    latestEveningNapEndMinutes: 21 * 60,
    maxEveningNapMinutes: 45,
    minNightSleepMinutes: 3 * 60,
    microNapMinutes: 20,
    napCount: 3,
    targetAwakeMaxMinutes: 10 * 60,
    targetAwakeMinMinutes: 10 * 60,
    targetDaySleepMaxMinutes: 4 * 60,
    targetDaySleepMinMinutes: 3 * 60,
    wakeUpEndMinutes: 7 * 60,
    wakeUpStartMinutes: 7 * 60,
  };

  return buildSleepPlanPreset({
    ...baseInput,
    ...input,
  });
}

function createTargetDayPlan(): TargetDayPlan {
  return {
    childId: 'default-child',
    eveningRulesMode: 'auto',
    id: 'base-plan',
    isActive: true,
    name: 'Base plan',
    plan: buildPlan({
      targetAwakeMaxMinutes: 10 * 60 + 30,
      targetAwakeMinMinutes: 10 * 60,
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

describe('sleep plan checks', () => {
  it('builds compact A/B/C statuses from the provided plan', () => {
    const checks = buildSleepPlanChecks({
      ageMonths: 6,
      plan: buildPlan(),
    });

    expect(checks.officialSleep.summaryLabel).toBe('в ориентире');
    expect(checks.daySleep.summaryLabel).toBe('подходит возрасту');
    expect(checks.wakeWindows.summaryLabel).toBe('спокойный диапазон');
  });

  it('shows lower awake range for today when soft day is active', () => {
    const basePlan = createTargetDayPlan();
    const todayPlan = buildEffectiveSleepDayPlan(basePlan, [createTemporaryMode('soft_day')]);

    const baseChecks = buildSleepPlanChecks({
      ageMonths: 6,
      plan: basePlan.plan,
    });
    const todayChecks = buildSleepPlanChecks({
      ageMonths: 6,
      plan: todayPlan.plan,
    });

    expect(todayChecks.awakeRange?.minMinutes).toBe(
      (baseChecks.awakeRange?.minMinutes ?? 0) - 30,
    );
    expect(todayChecks.awakeRange?.maxMinutes).toBe(
      (baseChecks.awakeRange?.maxMinutes ?? 0) - 30,
    );
  });

  it('keeps level A tied only to total sleep for 24 hours', () => {
    const firstPlan = buildPlan({
      napCount: 3,
      targetAwakeMaxMinutes: 10 * 60,
      targetAwakeMinMinutes: 10 * 60,
      targetDaySleepMaxMinutes: 3 * 60,
      targetDaySleepMinMinutes: 3 * 60,
    });
    const secondPlan = buildPlan({
      napCount: 5,
      targetAwakeMaxMinutes: 10 * 60,
      targetAwakeMinMinutes: 10 * 60,
      targetDaySleepMaxMinutes: 6 * 60,
      targetDaySleepMinMinutes: 5 * 60,
    });

    expect(
      buildSleepPlanChecks({
        ageMonths: 6,
        plan: firstPlan,
      }).officialSleep,
    ).toMatchObject(
      buildSleepPlanChecks({
        ageMonths: 6,
        plan: secondPlan,
      }).officialSleep,
    );
  });

  it('does not label practical B/C checks as official medical norms', () => {
    const checks = buildSleepPlanChecks({
      ageMonths: 6,
      plan: buildPlan({
        targetAwakeMaxMinutes: 5 * 60,
        targetAwakeMinMinutes: 5 * 60,
        targetDaySleepMaxMinutes: 2 * 60,
        targetDaySleepMinMinutes: 90,
      }),
    });

    expect(checks.daySleep.summaryLabel).toBe('отличается от ориентира');
    expect(checks.wakeWindows.summaryLabel).toBe('короче');
    expect(checks.daySleep.summaryLabel).not.toMatch(/официаль|медицин/i);
    expect(checks.wakeWindows.summaryLabel).not.toMatch(/официаль|медицин/i);
    expect(PLAN_CHECK_AWAKE_DESCRIPTION).not.toMatch(/официаль|медицин/i);
  });
});
