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

export function buildRecommendationScenarios(input: RecommendationInput): RecommendationScenario[] {
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
      input.nextSleepKind === 'night' && input.predictedBedtimeDeltaMinutes >= 0
        ? buildClosingNightScenario(input.predictedBedtimeDeltaMinutes, 'secondary')
        : buildEarlyBedtimeScenario(
            'Если следующий сон будет коротким, лучше сдвинуть ночь раньше.',
            'secondary',
          );

    return [
      {
        id: 'microNap',
        title: 'Микросон',
        detail: `Окно бодрствования получится длинным. В прогноз помещается микро-сон на ${formatDuration(
          input.projectedMicroNapMinutes,
        )}.`,
        priority: 'primary',
      },
      nightScenario,
    ];
  }

  if (input.currentWakeMinutes >= input.wakeWindow.maxWakeMinutes) {
    if (input.nextSleepKind === 'night' && input.predictedBedtimeDeltaMinutes >= 0) {
      return [buildClosingNightScenario(input.predictedBedtimeDeltaMinutes)];
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
      input.nextSleepKind === 'night' && input.predictedBedtimeDeltaMinutes >= 0
        ? buildClosingNightScenario(input.predictedBedtimeDeltaMinutes)
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
        priority: 'secondary',
      },
      {
        id: 'normal',
        title: 'Обычный план',
        detail: 'День близко к плану. Следующий сон можно вести по текущему окну.',
        priority: 'primary',
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
