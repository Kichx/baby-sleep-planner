import { describe, expect, it } from 'vitest';

import {
  buildTodayShortSummaryVm,
  type BuildTodayShortSummaryVmInput,
  type TodayShortSummaryVm,
} from '@/core/todayShortSummary';
import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import type { SleepDaySummary, SleepPlanPreset, SleepSnapshot } from '@/types/sleep';

const TEST_PLAN: SleepPlanPreset = {
  ...DEFAULT_SLEEP_PLAN,
  wakeWindows: DEFAULT_SLEEP_PLAN.wakeWindows.map((window, index) =>
    index === 0
      ? {
          ...window,
          maxWakeMinutes: 180,
          minWakeMinutes: 120,
          targetWakeMinutes: 150,
        }
      : window,
  ),
};

const baseViewState = {
  hasActiveTargetPlan: true,
  isTodaySelected: true,
  isTrackingOnlyWithoutPlan: false,
  showPlanBasedPredictions: true,
  showPlanStartNoDataHint: false,
};

function at(hours: number, minutes: number): Date {
  return new Date(2026, 5, 5, hours, minutes);
}

function baseSnapshot(overrides: Partial<SleepSnapshot> = {}): SleepSnapshot {
  return {
    completedNaps: 0,
    currentDurationMinutes: 60,
    nextSleepAt: at(9, 30),
    nextSleepKind: 'nap',
    onTrackLabel: 'День близко к плану',
    predictedBedtimeAt: at(20, 30),
    projectedRemainingDaySleepMinutes: 120,
    remainingAwakeMinutes: 480,
    scenarios: [
      {
        detail: 'Есть понятная причина.',
        id: 'normal',
        priority: 'primary',
        title: 'Обычный план',
      },
    ],
    state: 'awake',
    statusStartedAt: at(7, 0),
    totalAwakeMinutes: 60,
    totalDaySleepMinutes: 30,
    ...overrides,
  };
}

function baseDaySummary(overrides: Partial<SleepDaySummary> = {}): SleepDaySummary {
  return {
    bedtimeAt: null,
    completedNaps: 1,
    feedbackLines: [],
    napCountDelta: -2,
    onTrackLabel: 'День близко к плану',
    sleepSessionCount: 1,
    targetAwakeDeltaMinutes: -120,
    targetBedtimeDeltaMinutes: null,
    targetDaySleepDeltaMinutes: -90,
    totalAwakeMinutes: 60,
    totalDaySleepMinutes: 30,
    totalNightSleepMinutes: 0,
    verdictLabel: 'День близко к плану',
    wakeUpAt: null,
    ...overrides,
  };
}

function buildSummary(
  overrides: Partial<BuildTodayShortSummaryVmInput> = {},
): TodayShortSummaryVm {
  return buildTodayShortSummaryVm({
    bottleFeedingEnabled: false,
    daySummary: baseDaySummary(),
    hasDetails: true,
    latestBottleFeeding: null,
    now: at(8, 0),
    plan: TEST_PLAN,
    snapshot: baseSnapshot(),
    viewState: baseViewState,
    ...overrides,
  });
}

function rowTexts(vm: TodayShortSummaryVm): string[] {
  return vm.rows.map((row) => row.text);
}

function expectUserStringsSafe(vm: TodayShortSummaryVm): void {
  const userStrings = [
    vm.title,
    vm.detailsLabel,
    ...vm.rows.flatMap((row) => [row.id, row.text, row.tone]),
  ];

  userStrings.forEach((value) => {
    expect(value).not.toMatch(/undefined|null|NaN/);
  });
}

function clonePlan(plan: SleepPlanPreset): SleepPlanPreset {
  return {
    ...plan,
    wakeWindows: plan.wakeWindows.map((window) => ({ ...window })),
  };
}

function cloneSnapshot(snapshot: SleepSnapshot): SleepSnapshot {
  return {
    ...snapshot,
    nextSleepAt: new Date(snapshot.nextSleepAt),
    predictedBedtimeAt: new Date(snapshot.predictedBedtimeAt),
    scenarios: snapshot.scenarios.map((scenario) => ({ ...scenario })),
    statusStartedAt: new Date(snapshot.statusStartedAt),
  };
}

describe('buildTodayShortSummaryVm', () => {
  it('shows compact plan and factual rows for today with an active plan', () => {
    const summary = buildSummary({
      bottleFeedingEnabled: true,
      latestBottleFeeding: {
        startedAt: at(7, 15).toISOString(),
      },
    });

    expect(summary).toMatchObject({
      detailsLabel: 'Подробнее',
      hasDetails: true,
      title: 'Сегодня коротко',
      visible: true,
    });
    expect(rowTexts(summary)).toEqual([
      'Следующий сон в 09:30 (через 1 час 30 минут)',
      'Отбой: около 20:30 (через 12 часов 30 минут)',
      'ВБ: 1 ч из 10 ч 15 мин',
      'Осталось ВБ: 8 ч',
      'Дневной сон: 30 мин из 3 ч 15 мин',
      'Кормление: 45 мин назад',
    ]);
    expect(summary.rows.find((row) => row.id === 'feeding')?.tone).toBe('secondary');
    expect(rowTexts(summary).join(' ')).not.toContain('До цели бодрств.');
    expectUserStringsSafe(summary);
  });

  it('shows the next sleep as one target time with hours and minutes', () => {
    const summary = buildSummary({
      now: at(8, 10),
      snapshot: baseSnapshot({
        nextSleepAt: at(10, 25),
      }),
    });

    expect(rowTexts(summary)[0]).toBe(
      'Следующий сон в 10:25 (через 2 часа 15 минут)',
    );
    expect(rowTexts(summary)[0]).not.toMatch(/примерно|–|142|147/);
    expectUserStringsSafe(summary);
  });

  it('uses a calm active-sleep row instead of a next-sleep-after-sleep forecast', () => {
    const summary = buildSummary({
      now: at(10, 0),
      snapshot: baseSnapshot({
        currentDurationMinutes: 20,
        nextSleepAt: at(10, 0),
        predictedBedtimeAt: at(20, 30),
        state: 'sleeping',
        statusStartedAt: at(9, 40),
      }),
    });

    expect(rowTexts(summary)).toContain('После пробуждения покажем следующее окно');
    expect(rowTexts(summary)).toContain(
      'Отбой: около 20:30 (через 10 часов 30 минут)',
    );
    expect(rowTexts(summary)).toContain('ВБ: 1 ч из 10 ч 15 мин');
    expect(rowTexts(summary)).toContain('Осталось ВБ: 8 ч');
    expect(rowTexts(summary)).toContain('Дневной сон: 30 мин из 3 ч 15 мин');
    expect(rowTexts(summary).join(' ')).not.toContain('Следующий сон: после сна');
    expect(rowTexts(summary).join(' ')).not.toContain('после сна');
    expectUserStringsSafe(summary);
  });

  it('hides plan rows for tracking-only without an active plan but keeps factual rows', () => {
    const summary = buildSummary({
      bottleFeedingEnabled: true,
      latestBottleFeeding: {
        startedAt: at(6, 30).toISOString(),
      },
      plan: null,
      viewState: {
        ...baseViewState,
        hasActiveTargetPlan: false,
        isTrackingOnlyWithoutPlan: true,
        showPlanBasedPredictions: false,
      },
    });

    expect(summary.visible).toBe(true);
    expect(rowTexts(summary)).toEqual(['Дневной сон: 30 мин', 'Кормление: 1 ч 30 мин назад']);
    expect(rowTexts(summary).join(' ')).not.toContain('Следующий сон');
    expect(rowTexts(summary).join(' ')).not.toContain('Отбой');
    expectUserStringsSafe(summary);
  });

  it('hides itself when no short rows are available', () => {
    const summary = buildSummary({
      bottleFeedingEnabled: false,
      daySummary: baseDaySummary({
        sleepSessionCount: 0,
        totalDaySleepMinutes: 0,
      }),
      plan: null,
      snapshot: null,
      viewState: {
        ...baseViewState,
        hasActiveTargetPlan: false,
        isTrackingOnlyWithoutPlan: true,
        showPlanBasedPredictions: false,
      },
    });

    expect(summary).toMatchObject({
      hasDetails: false,
      rows: [],
      visible: false,
    });
    expectUserStringsSafe(summary);
  });

  it('does not show details action unless details are available', () => {
    const summary = buildSummary({
      hasDetails: false,
    });

    expect(summary.visible).toBe(true);
    expect(summary.hasDetails).toBe(false);
    expect(summary.detailsLabel).toBe('Подробнее');
  });

  it('stays hidden outside today and does not mutate inputs', () => {
    const plan = clonePlan(TEST_PLAN);
    const snapshot = baseSnapshot();
    const planBefore = clonePlan(plan);
    const snapshotBefore = cloneSnapshot(snapshot);

    const summary = buildSummary({
      plan,
      snapshot,
      viewState: {
        ...baseViewState,
        isTodaySelected: false,
      },
    });

    expect(summary.visible).toBe(false);
    expect(plan).toEqual(planBefore);
    expect(snapshot).toEqual(snapshotBefore);
    expectUserStringsSafe(summary);
  });
});
