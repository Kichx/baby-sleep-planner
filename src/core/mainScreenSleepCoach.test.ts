import { describe, expect, it } from 'vitest';

import {
  buildSleepCoachCardVm,
  type BuildSleepCoachCardVmInput,
  type SleepCoachCardVm,
} from '@/core/mainScreenSleepCoach';
import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import type { SleepPlanPreset, SleepSnapshot } from '@/types/sleep';

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

const dayStart = at(7, 0);
const baseViewState = {
  canShowCoachBlocks: true,
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
    totalDaySleepMinutes: 0,
    ...overrides,
  };
}

function buildCard(overrides: Partial<BuildSleepCoachCardVmInput> = {}): SleepCoachCardVm {
  return buildSleepCoachCardVm({
    now: at(8, 0),
    plan: TEST_PLAN,
    sleepDayStart: dayStart,
    snapshot: baseSnapshot(),
    temporaryModeBadge: null,
    viewState: baseViewState,
    ...overrides,
  });
}

function expectUserStringsSafe(card: SleepCoachCardVm): void {
  const userStrings = [
    card.eyebrow,
    card.badge,
    card.title,
    card.body,
    card.anchor,
    card.primaryActionLabel,
    card.secondaryActionLabel,
  ].filter((value): value is string => typeof value === 'string');

  userStrings.forEach((value) => {
    expect(value).not.toMatch(/undefined|null|NaN/);
  });
}

describe('buildSleepCoachCardVm', () => {
  it('hides the coach card for tracking-only mode without an active target plan', () => {
    const card = buildCard({
      plan: null,
      viewState: {
        ...baseViewState,
        canShowCoachBlocks: false,
        hasActiveTargetPlan: false,
        isTrackingOnlyWithoutPlan: true,
        showPlanBasedPredictions: false,
      },
    });

    expect(card.visible).toBe(false);
  });

  it('hides the coach card for past and future selected dates', () => {
    expect(
      buildCard({
        viewState: {
          ...baseViewState,
          canShowCoachBlocks: false,
          isTodaySelected: false,
        },
      }).visible,
    ).toBe(false);

    expect(
      buildCard({
        viewState: {
          ...baseViewState,
          canShowCoachBlocks: false,
          isTodaySelected: false,
        },
      }).visible,
    ).toBe(false);
  });

  it('hides the coach card when no safe snapshot is available', () => {
    expect(buildCard({ snapshot: null }).visible).toBe(false);
    expect(
      buildCard({
        snapshot: baseSnapshot({
          scenarios: [],
        }),
      }).visible,
    ).toBe(false);
  });

  it('hides the coach card for the active-plan no-records onboarding state', () => {
    const card = buildCard({
      viewState: {
        ...baseViewState,
        showPlanBasedPredictions: false,
        showPlanStartNoDataHint: true,
      },
    });

    expect(card.visible).toBe(false);
  });

  it('shows a calm active-sleep recommendation without "после сна" text', () => {
    const card = buildCard({
      now: at(10, 0),
      snapshot: baseSnapshot({
        currentDurationMinutes: 20,
        nextSleepAt: at(10, 0),
        predictedBedtimeAt: at(20, 30),
        projectedRemainingDaySleepMinutes: 40,
        state: 'sleeping',
        statusStartedAt: at(9, 40),
      }),
    });

    expect(card).toMatchObject({
      anchor: 'Отбой пока около 20:30',
      body: 'Сон пока короткий. Пусть доберёт, а после пробуждения пересчитаем следующий шаг.',
      eyebrow: 'Что лучше сейчас',
      title: 'Дать поспать ещё',
      tone: 'calm',
      visible: true,
    });
    expect(`${card.title} ${card.body} ${card.anchor}`).not.toContain('после сна');
    expectUserStringsSafe(card);
  });

  it('suggests softly ending an active nap when it can shift the evening', () => {
    const card = buildCard({
      now: at(18, 10),
      snapshot: baseSnapshot({
        currentDurationMinutes: 70,
        nextSleepAt: at(18, 10),
        predictedBedtimeAt: at(21, 0),
        projectedRemainingDaySleepMinutes: 0,
        state: 'sleeping',
        statusStartedAt: at(17, 0),
      }),
    });

    expect(card).toMatchObject({
      body: 'Если сон сильно затянется, отбой может уйти позже. Лучше мягко завершить сон в ближайшее время.',
      title: 'Скоро завершить сон',
      tone: 'adjustDay',
      visible: true,
    });
    expectUserStringsSafe(card);
  });

  it('keeps a short active nap calm even when no projected day sleep remains', () => {
    const card = buildCard({
      now: at(16, 15),
      snapshot: baseSnapshot({
        currentDurationMinutes: 15,
        nextSleepAt: at(16, 15),
        projectedRemainingDaySleepMinutes: 0,
        state: 'sleeping',
        statusStartedAt: at(16, 0),
      }),
    });

    expect(card).toMatchObject({
      title: 'Дать поспать ещё',
      tone: 'calm',
      visible: true,
    });
    expectUserStringsSafe(card);
  });

  it('shows an awake calm recommendation when the sleep window is not close yet', () => {
    const card = buildCard();

    expect(card).toMatchObject({
      anchor: 'Сон примерно через 60–120 мин',
      body: 'Следующий сон ожидается не сразу. Ближе к окну лучше перейти к спокойной подготовке.',
      title: 'Пока можно бодрствовать',
      tone: 'calm',
      visible: true,
    });
    expectUserStringsSafe(card);
  });

  it('shows a preparation recommendation when the sleep window is close', () => {
    const card = buildCard({
      now: at(8, 45),
      snapshot: baseSnapshot({
        currentDurationMinutes: 105,
        nextSleepAt: at(9, 0),
        statusStartedAt: at(7, 0),
      }),
    });

    expect(card).toMatchObject({
      anchor: 'Ориентир сна: 09:00–10:00',
      body: 'Окно бодрствования уже близко к ориентиру. Лучше начать укладывание спокойно, без спешки.',
      title: 'Пора готовиться ко сну',
      tone: 'prepare',
      visible: true,
    });
    expectUserStringsSafe(card);
  });

  it('shows an act-soon recommendation when awake time is already long', () => {
    const card = buildCard({
      now: at(10, 20),
      snapshot: baseSnapshot({
        currentDurationMinutes: 200,
        nextSleepAt: at(10, 20),
        predictedBedtimeAt: at(20, 30),
        statusStartedAt: at(7, 0),
      }),
    });

    expect(card).toMatchObject({
      anchor: 'Отбой пока можно сохранить около 20:30',
      body: 'Бодрствование уже затянулось. Сон сейчас поможет не разогнать вечер.',
      title: 'Лучше укладывать сейчас',
      tone: 'actSoon',
      visible: true,
    });
    expectUserStringsSafe(card);
  });

  it('uses the early bedtime copy when the next reasonable step is night', () => {
    const card = buildCard({
      now: at(18, 20),
      snapshot: baseSnapshot({
        currentDurationMinutes: 140,
        nextSleepAt: at(19, 0),
        nextSleepKind: 'night',
        predictedBedtimeAt: at(19, 0),
        scenarios: [
          {
            detail: 'Ночь лучше начать раньше.',
            id: 'earlyBedtime',
            priority: 'primary',
            title: 'Отбой раньше',
          },
        ],
        statusStartedAt: at(16, 0),
      }),
    });

    expect(card).toMatchObject({
      anchor: 'Ориентир отбоя: 20:00–21:30',
      body: 'День немного сдвинулся, но ночь можно мягко выровнять ранним укладыванием.',
      scenarioId: 'earlyBedtime',
      title: 'Лучше ранний отбой',
      tone: 'adjustDay',
      visible: true,
    });
    expectUserStringsSafe(card);
  });

  it('passes temporary-mode badge and alternative flags through the view model', () => {
    const card = buildCard({
      snapshot: baseSnapshot({
        scenarios: [
          {
            detail: 'Основная причина.',
            id: 'microNap',
            priority: 'primary',
            title: 'Микросон',
          },
          {
            detail: 'Запасной вариант.',
            id: 'earlyBedtime',
            priority: 'secondary',
            title: 'Отбой раньше',
          },
        ],
      }),
      temporaryModeBadge: 'Сегодня график скорректирован',
    });

    expect(card).toMatchObject({
      badge: 'Сегодня график скорректирован',
      hasAlternatives: true,
      hasWhyDetails: true,
      scenarioId: 'microNap',
      visible: true,
    });
    expectUserStringsSafe(card);
  });
});
