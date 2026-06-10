import { describe, expect, it } from 'vitest';

import {
  buildRecommendationScenarios,
  RECOMMENDATION_TIME_TOLERANCE_MINUTES,
} from '@/core/recommendations';

type RecommendationInput = Parameters<typeof buildRecommendationScenarios>[0];

const baseInput: RecommendationInput = {
  completedNaps: 3,
  currentWakeMinutes: 90,
  isSleeping: false,
  maxEveningNapMinutes: 45,
  nextSleepKind: 'night',
  predictedBedtimeDeltaMinutes: 0,
  projectedMicroNapMinutes: 0,
  remainingAwakeMinutes: 60,
  wakeWindow: {
    maxWakeMinutes: 180,
    minWakeMinutes: 120,
    napNumber: 4,
    targetWakeMinutes: 150,
  },
};

function buildScenarios(overrides: Partial<RecommendationInput> = {}) {
  return buildRecommendationScenarios({
    ...baseInput,
    ...overrides,
  });
}

describe('buildRecommendationScenarios', () => {
  it('treats a slightly early bedtime forecast as on plan', () => {
    const scenarios = buildScenarios({
      predictedBedtimeDeltaMinutes: -RECOMMENDATION_TIME_TOLERANCE_MINUTES + 3,
    });

    expect(scenarios[0]).toMatchObject({
      id: 'normal',
      title: 'Отбой по плану',
      priority: 'primary',
    });
  });

  it('treats a slightly late bedtime forecast as on plan', () => {
    const scenarios = buildScenarios({
      predictedBedtimeDeltaMinutes: RECOMMENDATION_TIME_TOLERANCE_MINUTES - 3,
    });

    expect(scenarios[0]).toMatchObject({
      id: 'normal',
      title: 'Отбой по плану',
      priority: 'primary',
    });
  });

  it('keeps early bedtime advice when the forecast is earlier outside the tolerance', () => {
    const scenarios = buildScenarios({
      predictedBedtimeDeltaMinutes: -RECOMMENDATION_TIME_TOLERANCE_MINUTES - 1,
    });

    expect(scenarios[0]).toMatchObject({
      id: 'earlyBedtime',
      title: 'Отбой раньше',
      priority: 'primary',
    });
  });

  it('keeps late-night advice when the forecast is later outside the tolerance', () => {
    const scenarios = buildScenarios({
      predictedBedtimeDeltaMinutes: RECOMMENDATION_TIME_TOLERANCE_MINUTES + 1,
    });

    expect(scenarios[0]).toMatchObject({
      id: 'normal',
      title: 'Ночь без еще одного сна',
      priority: 'primary',
    });
  });

  it('makes the last-nap cap the primary advice when a daytime nap still remains late in the day', () => {
    const scenarios = buildScenarios({
      completedNaps: 2,
      currentWakeMinutes: 130,
      nextSleepKind: 'nap',
      predictedBedtimeDeltaMinutes: 0,
      remainingAwakeMinutes: 180,
    });

    expect(scenarios[0]).toMatchObject({
      id: 'capLastNap',
      title: 'Укоротить сон',
      priority: 'primary',
    });
    expect(scenarios[1]).toMatchObject({
      id: 'normal',
      priority: 'secondary',
    });
  });
});
