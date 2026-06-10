import type { RecommendationScenario, SleepKind, WakeWindowPreset } from '@/types/sleep';

interface RecommendationInput {
  currentWakeMinutes: number;
  remainingAwakeMinutes: number;
  completedNaps: number;
  maxEveningNapMinutes: number;
  projectedMicroNapMinutes: number;
  wakeWindow: WakeWindowPreset;
  nextSleepKind: SleepKind;
  predictedBedtimeDeltaMinutes: number;
  isSleeping: boolean;
}

export const RECOMMENDATION_TIME_TOLERANCE_MINUTES = 10;

function applyRecommendationTimeTolerance(deltaMinutes: number): number {
  return Math.abs(deltaMinutes) <= RECOMMENDATION_TIME_TOLERANCE_MINUTES ? 0 : deltaMinutes;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function buildEarlyBedtimeScenario(
  detail: string,
  priority: RecommendationScenario['priority'] = 'primary',
): RecommendationScenario {
  return {
    id: 'earlyBedtime',
    title: 'Отбой раньше',
    detail,
    priority,
  };
}

function buildClosingNightScenario(
  predictedBedtimeDeltaMinutes: number,
  priority: RecommendationScenario['priority'] = 'primary',
): RecommendationScenario {
  if (predictedBedtimeDeltaMinutes > 0) {
    return {
      id: 'normal',
      title: 'Ночь без еще одного сна',
      detail: 'Прогноз ночи уже позже плана. Лучше не добавлять дневной сон и спокойно идти к ночи.',
      priority,
    };
  }

  return {
    id: 'normal',
    title: 'Отбой по плану',
    detail: 'До цели бодрствования осталось мало времени. Следующий сон можно считать ночным.',
    priority,
  };
}

function buildPostMicroNapNightScenario(
  predictedBedtimeDeltaMinutes: number,
  priority: RecommendationScenario['priority'] = 'secondary',
): RecommendationScenario {
  if (predictedBedtimeDeltaMinutes > 0) {
    return {
      id: 'normal',
      title: 'Ночь после микросна',
      detail:
        'После микросна оставляем обычное вечернее окно бодрствования. Отбой может выйти позже плана, поэтому следующий сон лучше держать коротким.',
      priority,
    };
  }

  return {
    id: 'normal',
    title: 'Ночь после микросна',
    detail:
      'После микросна оставляем обычное вечернее окно бодрствования перед ночью. Отбой остаётся близко к плану.',
    priority,
  };
}

export function buildRecommendationScenarios(input: RecommendationInput): RecommendationScenario[] {
  const predictedBedtimeDeltaMinutes = applyRecommendationTimeTolerance(
    input.predictedBedtimeDeltaMinutes,
  );

  if (input.isSleeping) {
    return [
      {
        id: 'normal',
        title: 'Продолжить сон',
        detail: 'После пробуждения пересчитаем окно бодрствования и следующий сон.',
        priority: 'primary',
      },
    ];
  }

  if (input.projectedMicroNapMinutes > 0) {
    const nightScenario =
      predictedBedtimeDeltaMinutes >= 0
        ? buildPostMicroNapNightScenario(predictedBedtimeDeltaMinutes, 'secondary')
        : buildEarlyBedtimeScenario(
            'Даже с обычным окном после микросна отбой получается раньше плана. Можно спокойно закрыть день раньше.',
            'secondary',
          );

    return [
      {
        id: 'microNap',
        title: 'Микросон',
        detail: `Чтобы оставить обычное последнее окно перед ночью, в прогноз помещается микро-сон на ${formatDuration(
          input.projectedMicroNapMinutes,
        )}.`,
        priority: 'primary',
      },
      nightScenario,
    ];
  }

  if (input.currentWakeMinutes >= input.wakeWindow.maxWakeMinutes) {
    if (input.nextSleepKind === 'night' && predictedBedtimeDeltaMinutes >= 0) {
      return [buildClosingNightScenario(predictedBedtimeDeltaMinutes)];
    }

    if (input.nextSleepKind === 'night') {
      return [
        buildEarlyBedtimeScenario(
          'Микро-сон уже не помещается по вечерним правилам. Спокойнее двигаться к отбою.',
        ),
      ];
    }

    return [
      {
        id: 'normal',
        title: 'Сон сейчас',
        detail: 'Окно бодрствования уже у верхней границы. Лучше начинать следующий сон.',
        priority: 'primary',
      },
    ];
  }

  if (input.remainingAwakeMinutes <= input.wakeWindow.minWakeMinutes) {
    const scenario =
      input.nextSleepKind === 'night' && predictedBedtimeDeltaMinutes >= 0
        ? buildClosingNightScenario(predictedBedtimeDeltaMinutes)
        : buildEarlyBedtimeScenario(
            'До цели бодрствования осталось мало времени. День можно закрыть раньше.',
          );

    return [scenario];
  }

  if (input.completedNaps >= 2) {
    return [
      {
        id: 'capLastNap',
        title: 'Укоротить сон',
        detail: `Последний вечерний сон лучше держать до ${formatDuration(
          input.maxEveningNapMinutes,
        )}, чтобы не увести ночь поздно.`,
        priority: 'primary',
      },
      {
        id: 'normal',
        title: 'Обычный план',
        detail: 'День близко к плану. Следующий сон можно вести по текущему окну.',
        priority: 'secondary',
      },
    ];
  }

  return [
    {
      id: 'normal',
      title: 'Обычный план',
      detail: 'День близко к цели. Следующий сон можно начать по плановому окну.',
      priority: 'primary',
    },
    {
      id: 'stretchWakeWindow',
      title: 'Чуть потянуть',
      detail: 'Если ребёнок спокоен, окно можно мягко продлить на 10-15 минут.',
      priority: 'secondary',
    },
  ];
}
