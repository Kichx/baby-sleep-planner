import { describe, expect, it } from 'vitest';

import {
  buildSleepRetrospectiveDay,
  buildSleepRetrospectivePeriodSummary,
} from '@/core/sleepRetrospective';
import type { SleepDaySummary } from '@/types/sleep';

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
