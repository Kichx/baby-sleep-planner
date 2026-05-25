import type { RecommendationScenario, WakeWindowPreset } from '@/types/sleep';

interface RecommendationInput {
  currentWakeMinutes: number;
  remainingAwakeMinutes: number;
  completedNaps: number;
  wakeWindow: WakeWindowPreset;
  isSleeping: boolean;
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

  if (input.currentWakeMinutes >= input.wakeWindow.maxWakeMinutes) {
    return [
      {
        id: 'microNap',
        title: 'Микросон',
        detail: 'Окно бодрствования уже близко к верхней границе. Подойдёт короткий сон.',
        priority: 'primary',
      },
      {
        id: 'earlyBedtime',
        title: 'Ранний ночной',
        detail: 'Если следующий сон будет коротким, лучше сдвинуть ночь раньше.',
        priority: 'secondary',
      },
    ];
  }

  if (input.remainingAwakeMinutes <= input.wakeWindow.minWakeMinutes) {
    return [
      {
        id: 'earlyBedtime',
        title: 'Ранний ночной',
        detail: 'До цели бодрствования осталось мало времени. День можно закрыть раньше.',
        priority: 'primary',
      },
    ];
  }

  if (input.completedNaps >= 2) {
    return [
      {
        id: 'capLastNap',
        title: 'Укоротить сон',
        detail: 'Последний сон лучше держать коротким, чтобы не увести ночь поздно.',
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
