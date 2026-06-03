import { describe, expect, it } from 'vitest';

import { DEFAULT_CHILD_ID, DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { buildTodaySleepSnapshot, minutesBetween } from '@/core/sleepCalculations';
import {
  buildTodayEffectiveSleepPlan,
  getTemporaryModeBadgeLabel,
  shouldShowEarlyWakeModeSuggestion,
} from '@/core/todayEffectiveSleepPlan';
import type {
  SleepDayTemporaryMode,
  SleepDayTemporaryModeType,
  SleepSession,
  TargetDayPlan,
} from '@/types/sleep';

const BASE_PLAN: TargetDayPlan = {
  childId: DEFAULT_CHILD_ID,
  eveningRulesMode: 'auto',
  id: 'base-plan',
  isActive: true,
  name: 'Основной',
  plan: DEFAULT_SLEEP_PLAN,
  updatedAt: '2026-06-03T00:00:00.000Z',
};

function createTemporaryMode(
  mode: SleepDayTemporaryModeType,
  overrides: Partial<SleepDayTemporaryMode> = {},
): SleepDayTemporaryMode {
  return {
    basePlanId: BASE_PLAN.id,
    childId: DEFAULT_CHILD_ID,
    createdAt: '2026-06-03T06:45:00.000Z',
    disabledAt: null,
    dismissedAt: null,
    id: `mode-${mode}`,
    mode,
    sleepDayDateKey: '2026-06-03',
    ...overrides,
  };
}

function createNightSleepWakeUp(wakeUpAt: Date): SleepSession {
  return {
    childId: DEFAULT_CHILD_ID,
    endedAt: wakeUpAt.toISOString(),
    id: 'night-sleep',
    kind: 'night',
    startedAt: new Date(
      wakeUpAt.getFullYear(),
      wakeUpAt.getMonth(),
      wakeUpAt.getDate() - 1,
      20,
      30,
    ).toISOString(),
  };
}

describe('today effective sleep plan for the main screen', () => {
  it('uses soft day effective plan in the today snapshot', () => {
    const now = new Date(2026, 5, 3, 8, 0);
    const baseSnapshot = buildTodaySleepSnapshot([], now, BASE_PLAN.plan);
    const effective = buildTodayEffectiveSleepPlan({
      basePlan: BASE_PLAN,
      now,
      sessions: [],
      sleepDayDateKey: '2026-06-03',
      temporaryModes: [createTemporaryMode('soft_day')],
    });
    const softDaySnapshot = buildTodaySleepSnapshot([], now, effective.plan);

    expect(softDaySnapshot.remainingAwakeMinutes).toBe(
      baseSnapshot.remainingAwakeMinutes - 30,
    );
    expect(softDaySnapshot.predictedBedtimeAt.getTime()).toBeLessThan(
      baseSnapshot.predictedBedtimeAt.getTime(),
    );
  });

  it('uses early wake effective plan for the next sleep projection', () => {
    const now = new Date(2026, 5, 3, 8, 0);
    const earlyWakeTime = new Date(2026, 5, 3, 6, 30);
    const sessions = [createNightSleepWakeUp(earlyWakeTime)];
    const baseSnapshot = buildTodaySleepSnapshot([], now, BASE_PLAN.plan);
    const effective = buildTodayEffectiveSleepPlan({
      basePlan: BASE_PLAN,
      now,
      sessions,
      sleepDayDateKey: '2026-06-03',
      temporaryModes: [createTemporaryMode('early_wake')],
    });
    const earlyWakeSnapshot = buildTodaySleepSnapshot([], now, effective.plan);

    expect(effective.actualWakeTime?.getTime()).toBe(earlyWakeTime.getTime());
    expect(effective.plan.wakeWindows[0].targetWakeMinutes).toBe(
      BASE_PLAN.plan.wakeWindows[0].targetWakeMinutes - 30,
    );
    expect(minutesBetween(earlyWakeSnapshot.nextSleepAt, baseSnapshot.nextSleepAt)).toBe(
      30,
    );
  });

  it('shows early wake recommendation for a wake-up 30 minutes before the plan', () => {
    const now = new Date(2026, 5, 3, 8, 0);
    const effective = buildTodayEffectiveSleepPlan({
      basePlan: BASE_PLAN,
      now,
      sessions: [createNightSleepWakeUp(new Date(2026, 5, 3, 6, 30))],
      sleepDayDateKey: '2026-06-03',
      temporaryModes: [],
    });

    expect(
      shouldShowEarlyWakeModeSuggestion({
        actualWakeTime: effective.actualWakeTime,
        basePlan: BASE_PLAN.plan,
        temporaryModes: [],
      }),
    ).toBe(true);
  });

  it('does not show early wake recommendation after dismiss in the same sleep-day', () => {
    expect(
      shouldShowEarlyWakeModeSuggestion({
        actualWakeTime: new Date(2026, 5, 3, 6, 30),
        basePlan: BASE_PLAN.plan,
        temporaryModes: [
          createTemporaryMode('early_wake', {
            disabledAt: '2026-06-03T06:45:00.000Z',
            dismissedAt: '2026-06-03T06:45:00.000Z',
          }),
        ],
      }),
    ).toBe(false);
  });

  it('does not show early wake recommendation when early wake mode is already active', () => {
    expect(
      shouldShowEarlyWakeModeSuggestion({
        actualWakeTime: new Date(2026, 5, 3, 6, 30),
        basePlan: BASE_PLAN.plan,
        temporaryModes: [createTemporaryMode('early_wake')],
      }),
    ).toBe(false);
  });

  it('formats a compact badge for active temporary modes', () => {
    expect(getTemporaryModeBadgeLabel([createTemporaryMode('soft_day')])).toBe(
      'Сегодня мягкий день',
    );
    expect(getTemporaryModeBadgeLabel([createTemporaryMode('early_wake')])).toBe(
      'Сегодня ранний подъём',
    );
    expect(
      getTemporaryModeBadgeLabel([
        createTemporaryMode('soft_day'),
        createTemporaryMode('early_wake'),
      ]),
    ).toBe('Сегодня график скорректирован');
  });
});
