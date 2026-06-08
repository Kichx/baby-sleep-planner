import { describe, expect, it } from 'vitest';

import {
  buildSleepRetrospectiveDay,
  buildSleepRetrospectivePeriodSummary,
  buildSleepRetrospectivePeriodStats,
} from '@/core/sleepRetrospective';
import type {
  SleepDaySummary,
  SleepDayTemporaryMode,
  SleepDayTemporaryModeType,
} from '@/types/sleep';

function daySummary(overrides: Partial<SleepDaySummary> = {}): SleepDaySummary {
  return {
    bedtimeAt: new Date('2026-05-26T17:30:00.000Z'),
    completedNaps: 3,
    feedbackLines: ['Основные показатели близко к плану'],
    napCountDelta: 0,
    onTrackLabel: 'День близко к плану',
    sleepSessionCount: 4,
    targetAwakeDeltaMinutes: 0,
    targetBedtimeDeltaMinutes: 0,
    targetDaySleepDeltaMinutes: 0,
    totalAwakeMinutes: 615,
    totalDaySleepMinutes: 195,
    totalNightSleepMinutes: 630,
    verdictLabel: 'День близко к плану',
    wakeUpAt: new Date('2026-05-27T04:00:00.000Z'),
    ...overrides,
  };
}

function temporaryMode(
  mode: SleepDayTemporaryModeType,
  overrides: Partial<SleepDayTemporaryMode> = {},
): SleepDayTemporaryMode {
  return {
    basePlanId: 'base-plan',
    childId: 'default-child',
    createdAt: '2026-05-26T08:00:00.000Z',
    disabledAt: null,
    dismissedAt: null,
    id: `temporary-mode-${mode}`,
    mode,
    sleepDayDateKey: '2026-05-26',
    ...overrides,
  };
}

describe('buildSleepRetrospectiveDay', () => {
  it('keeps a close day calm and compact', () => {
    const day = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary(),
    });

    expect(day.status).toBe('onTrack');
    expect(day.statusLabel).toBe('Близко к плану');
    expect(day.hint).toBe('День ровный. Можно держать обычный план.');
    expect(day.reason).toBeNull();
    expect(day.temporaryModeBadges).toEqual([]);
  });

  it('uses a strong shifted status for a short day sleep with another drift', () => {
    const day = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary({
        targetAwakeDeltaMinutes: 55,
        targetDaySleepDeltaMinutes: -95,
      }),
    });

    expect(day.status).toBe('stronglyShifted');
    expect(day.statusLabel).toBe('Сильно сдвинулся');
    expect(day.reason).toBe('shortDaySleep');
    expect(day.hint).toBe(
      'Дневного сна было меньше. В похожий день лучше не тянуть первый сон.',
    );
  });

  it('adds a soft day badge and uses a softer retrospective hint', () => {
    const day = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary({ targetAwakeDeltaMinutes: -45 }),
      temporaryModes: [temporaryMode('soft_day')],
    });

    expect(day.temporaryModeBadges).toEqual([{ label: 'Мягкий день', mode: 'soft_day' }]);
    expect(day.hint).toBe(
      'День был мягче обычного после сложной ночи. Можно вернуться к основному плану.',
    );
  });

  it('adds an early wake badge and uses an early wake retrospective hint', () => {
    const day = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary({ targetBedtimeDeltaMinutes: -50 }),
      temporaryModes: [temporaryMode('early_wake')],
    });

    expect(day.temporaryModeBadges).toEqual([
      { label: 'Ранний подъём', mode: 'early_wake' },
    ]);
    expect(day.hint).toBe(
      'День начался раньше обычного, поэтому первый сон был сдвинут мягче.',
    );
  });

  it('shows both active temporary mode badges when both modes were active', () => {
    const day = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary({ targetAwakeDeltaMinutes: -45 }),
      temporaryModes: [temporaryMode('soft_day'), temporaryMode('early_wake')],
    });

    expect(day.temporaryModeBadges).toEqual([
      { label: 'Мягкий день', mode: 'soft_day' },
      { label: 'Ранний подъём', mode: 'early_wake' },
    ]);
    expect(day.hint).toBe(
      'День был мягче обычного после раннего подъёма. Можно вернуться к основному плану.',
    );
  });

  it('keeps an empty day explicit without alarming copy', () => {
    const day = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary({
        bedtimeAt: null,
        completedNaps: 0,
        feedbackLines: ['Итоги появятся после первой записи сна.'],
        sleepSessionCount: 0,
        targetBedtimeDeltaMinutes: null,
        totalAwakeMinutes: 0,
        totalDaySleepMinutes: 0,
        totalNightSleepMinutes: 0,
        wakeUpAt: null,
      }),
    });

    expect(day.status).toBe('empty');
    expect(day.statusLabel).toBe('Нет записей');
    expect(day.hint).toBe('Нет записей за день. Можно открыть день и добавить сон.');
  });
});

describe('buildSleepRetrospectivePeriodSummary', () => {
  it('summarizes close and shifted days with the dominant reason', () => {
    const closeDay = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary(),
    });
    const shortSleepDay = buildSleepRetrospectiveDay({
      date: new Date('2026-05-25T09:00:00.000Z'),
      summary: daySummary({ targetDaySleepDeltaMinutes: -80 }),
    });

    const summary = buildSleepRetrospectivePeriodSummary([closeDay, shortSleepDay], 7);

    expect(summary.periodLabel).toBe('За 7 дней');
    expect(summary.primaryLine).toBe('1 день близко к плану');
    expect(summary.detailLine).toBe('1 день сдвинулся из-за короткого дневного сна.');
  });

  it('has a useful empty-period message', () => {
    const summary = buildSleepRetrospectivePeriodSummary([], 14);

    expect(summary.periodLabel).toBe('За 14 дней');
    expect(summary.primaryLine).toBe('Пока нет завершённых дней с записями');
  });
});

describe('buildSleepRetrospectivePeriodStats', () => {
  it('calculates calm averages and chronological trend points', () => {
    const recentDay = buildSleepRetrospectiveDay({
      date: new Date('2026-05-27T09:00:00.000Z'),
      summary: daySummary({
        completedNaps: 2,
        targetAwakeDeltaMinutes: -30,
        totalAwakeMinutes: 600,
        totalDaySleepMinutes: 120,
        totalNightSleepMinutes: 660,
      }),
    });
    const olderDay = buildSleepRetrospectiveDay({
      date: new Date('2026-05-26T09:00:00.000Z'),
      summary: daySummary({
        completedNaps: 3,
        targetAwakeDeltaMinutes: 30,
        totalAwakeMinutes: 660,
        totalDaySleepMinutes: 180,
        totalNightSleepMinutes: 600,
      }),
    });

    const stats = buildSleepRetrospectivePeriodStats([recentDay, olderDay], 7);

    expect(stats.recordedDays).toBe(2);
    expect(stats.averageTotalSleepMinutes).toBe(780);
    expect(stats.averageDaySleepMinutes).toBe(150);
    expect(stats.averageNightSleepMinutes).toBe(630);
    expect(stats.averageAwakeMinutes).toBe(630);
    expect(stats.averageNapsPerDay).toBe(2.5);
    expect(stats.averageWakeWindowMinutes).toBe(183);
    expect(stats.headline).toBe('В среднем 13 ч сна за сутки');
    expect(stats.detailLine).toBe('Есть данные за 2 дня из 7.');
    expect(stats.metricCards[1]).toEqual({
      detail: '2,5 сна/день',
      label: 'Дневной сон',
      value: '2 ч 30 мин',
    });
    expect(stats.sleepTrend.map((point) => point.date.toISOString())).toEqual([
      '2026-05-26T09:00:00.000Z',
      '2026-05-27T09:00:00.000Z',
    ]);
    expect(stats.awakeTrend.map((point) => point.awakeDeltaMinutes)).toEqual([30, -30]);
  });

  it('keeps an empty stats period explicit', () => {
    const stats = buildSleepRetrospectivePeriodStats([], 14);

    expect(stats.recordedDays).toBe(0);
    expect(stats.averageTotalSleepMinutes).toBeNull();
    expect(stats.headline).toBe('Пока мало данных');
    expect(stats.detailLine).toBe('Сводка появится после нескольких записанных дней.');
    expect(stats.metricCards[0]).toEqual({
      detail: 'после записей',
      label: 'Сон за сутки',
      value: '--',
    });
  });
});
