import { describe, expect, it } from 'vitest';

import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { buildSleepDaySummary, buildTodaySleepSnapshot } from '@/core/sleepCalculations';
import type { SleepKind, SleepSession } from '@/types/sleep';

const CHILD_ID = 'default-child';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 0, 15, hour, minute, 0, 0);
}

function atDay(dayOffset: number, hour: number, minute = 0): Date {
  const date = at(hour, minute);
  date.setDate(date.getDate() + dayOffset);

  return date;
}

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
    2,
    '0',
  )}`;
}

function sleepSession(
  id: string,
  kind: SleepKind,
  startHour: number,
  startMinute: number,
  endHour: number | null,
  endMinute: number | null,
): SleepSession {
  return {
    childId: CHILD_ID,
    endedAt: endHour === null || endMinute === null ? null : at(endHour, endMinute).toISOString(),
    id,
    kind,
    startedAt: at(startHour, startMinute).toISOString(),
  };
}

function sleepSessionWithDayOffsets(
  id: string,
  kind: SleepKind,
  startDayOffset: number,
  startHour: number,
  startMinute: number,
  endDayOffset: number | null,
  endHour: number | null,
  endMinute: number | null,
): SleepSession {
  return {
    childId: CHILD_ID,
    endedAt:
      endDayOffset === null || endHour === null || endMinute === null
        ? null
        : atDay(endDayOffset, endHour, endMinute).toISOString(),
    id,
    kind,
    startedAt: atDay(startDayOffset, startHour, startMinute).toISOString(),
  };
}

describe('buildTodaySleepSnapshot bedtime projection', () => {
  it('keeps a normal 3-nap day near the target bedtime', () => {
    const snapshot = buildTodaySleepSnapshot(
      [
        sleepSession('nap-1', 'nap', 9, 34, 10, 39),
        sleepSession('nap-2', 'nap', 13, 13, 14, 18),
        sleepSession('nap-3', 'nap', 16, 52, 17, 57),
      ],
      at(17, 57),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.nextSleepAt)).toBe('20:30');
    expect(snapshot.nextSleepKind).toBe('night');
    expect(clock(snapshot.predictedBedtimeAt)).toBe('20:30');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(0);
  });

  it('adds the remaining planned naps after an early morning wake', () => {
    const snapshot = buildTodaySleepSnapshot([], at(7, 30), DEFAULT_SLEEP_PLAN);

    expect(clock(snapshot.nextSleepAt)).toBe('09:34');
    expect(snapshot.nextSleepKind).toBe('nap');
    expect(clock(snapshot.predictedBedtimeAt)).toBe('20:30');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(195);
  });

  it('does not try to recover all missed sleep after a short first nap', () => {
    const snapshot = buildTodaySleepSnapshot(
      [sleepSession('nap-1', 'nap', 9, 34, 10, 4)],
      at(10, 4),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.predictedBedtimeAt)).toBe('19:55');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(130);
  });

  it('limits projected sleep to one remaining slot after two short naps', () => {
    const snapshot = buildTodaySleepSnapshot(
      [
        sleepSession('nap-1', 'nap', 9, 34, 10, 4),
        sleepSession('nap-2', 'nap', 12, 38, 13, 8),
      ],
      at(13, 8),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.predictedBedtimeAt)).toBe('19:20');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(65);
  });

  it('allows a late third nap when it still fits before the evening nap cutoff', () => {
    const snapshot = buildTodaySleepSnapshot(
      [
        sleepSession('nap-1', 'nap', 9, 34, 10, 39),
        sleepSession('nap-2', 'nap', 13, 13, 14, 18),
      ],
      at(17, 30),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.nextSleepAt)).toBe('17:30');
    expect(snapshot.nextSleepKind).toBe('nap');
    expect(clock(snapshot.predictedBedtimeAt)).toBe('20:30');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(65);
  });

  it('projects the rest of an active daytime nap and the remaining planned naps', () => {
    const snapshot = buildTodaySleepSnapshot(
      [sleepSession('active-nap', 'nap', 9, 40, null, null)],
      at(10, 0),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.predictedBedtimeAt)).toBe('20:30');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(175);
  });

  it('adds a micro-nap after planned nap slots are exhausted when the final wake window is too long', () => {
    const snapshot = buildTodaySleepSnapshot(
      [
        sleepSession('nap-1', 'nap', 8, 30, 9, 0),
        sleepSession('nap-2', 'nap', 11, 30, 12, 0),
        sleepSession('nap-3', 'nap', 14, 30, 15, 0),
      ],
      at(17, 30),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.nextSleepAt)).toBe('17:34');
    expect(snapshot.nextSleepKind).toBe('nap');
    expect(clock(snapshot.predictedBedtimeAt)).toBe('19:05');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(20);
  });

  it('uses early bedtime when a remaining planned nap no longer fits', () => {
    const snapshot = buildTodaySleepSnapshot(
      [
        sleepSession('nap-1', 'nap', 9, 34, 10, 39),
        sleepSession('nap-2', 'nap', 13, 13, 14, 18),
      ],
      at(19, 10),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.nextSleepAt)).toBe('19:25');
    expect(snapshot.nextSleepKind).toBe('night');
    expect(clock(snapshot.predictedBedtimeAt)).toBe('19:25');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(0);
  });

  it('shows bedtime as the next sleep when a late micro-nap would no longer fit', () => {
    const snapshot = buildTodaySleepSnapshot(
      [
        sleepSession('nap-1', 'nap', 7, 50, 8, 30),
        sleepSession('nap-2', 'nap', 10, 40, 11, 20),
        sleepSession('nap-3', 'nap', 13, 30, 14, 20),
        sleepSession('nap-4', 'nap', 16, 35, 17, 30),
      ],
      at(19, 20),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.nextSleepAt)).toBe('20:20');
    expect(snapshot.nextSleepKind).toBe('night');
    expect(clock(snapshot.predictedBedtimeAt)).toBe('20:20');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(0);
  });

  it('returns the actual start when night sleep is already active', () => {
    const snapshot = buildTodaySleepSnapshot(
      [
        sleepSession('nap-1', 'nap', 9, 34, 10, 39),
        sleepSession('nap-2', 'nap', 13, 13, 14, 18),
        sleepSession('night', 'night', 19, 10, null, null),
      ],
      at(20, 10),
      DEFAULT_SLEEP_PLAN,
    );

    expect(clock(snapshot.predictedBedtimeAt)).toBe('19:10');
    expect(snapshot.projectedRemainingDaySleepMinutes).toBe(0);
  });
});

describe('buildSleepDaySummary retrospective summary', () => {
  const referenceDate = at(12);
  const afterSleepDay = atDay(1, 12);

  it('summarizes a normal 3-nap day as close to the plan', () => {
    const summary = buildSleepDaySummary(
      [
        sleepSessionWithDayOffsets('nap-1', 'nap', 0, 9, 34, 0, 10, 39),
        sleepSessionWithDayOffsets('nap-2', 'nap', 0, 13, 13, 0, 14, 18),
        sleepSessionWithDayOffsets('nap-3', 'nap', 0, 16, 52, 0, 17, 57),
        sleepSessionWithDayOffsets('night', 'night', 0, 20, 30, 1, 7, 0),
      ],
      referenceDate,
      afterSleepDay,
      DEFAULT_SLEEP_PLAN,
    );

    expect(summary.totalAwakeMinutes).toBe(DEFAULT_SLEEP_PLAN.targetAwakeMinutes);
    expect(summary.totalDaySleepMinutes).toBe(DEFAULT_SLEEP_PLAN.targetDaySleepMinutes);
    expect(summary.totalNightSleepMinutes).toBe(630);
    expect(summary.targetAwakeDeltaMinutes).toBe(0);
    expect(summary.targetDaySleepDeltaMinutes).toBe(0);
    expect(summary.napCountDelta).toBe(0);
    expect(summary.targetBedtimeDeltaMinutes).toBe(0);
    expect(summary.verdictLabel).toBe('День близко к плану');
    expect(summary.feedbackLines).toEqual(['Основные показатели близко к плану']);
    expect(summary.bedtimeAt ? clock(summary.bedtimeAt) : null).toBe('20:30');
    expect(summary.wakeUpAt ? clock(summary.wakeUpAt) : null).toBe('07:00');
  });

  it('highlights a day with too little awake time', () => {
    const summary = buildSleepDaySummary(
      [
        sleepSessionWithDayOffsets('nap-1', 'nap', 0, 9, 0, 0, 10, 30),
        sleepSessionWithDayOffsets('nap-2', 'nap', 0, 12, 30, 0, 14, 0),
        sleepSessionWithDayOffsets('nap-3', 'nap', 0, 16, 0, 0, 17, 30),
        sleepSessionWithDayOffsets('night', 'night', 0, 19, 30, 1, 7, 0),
      ],
      referenceDate,
      afterSleepDay,
      DEFAULT_SLEEP_PLAN,
    );

    expect(summary.targetAwakeDeltaMinutes).toBe(-135);
    expect(summary.verdictLabel).toBe('Бодрствования меньше цели');
    expect(summary.feedbackLines[0]).toBe('Бодрствования на 2 ч 15 мин меньше цели');
  });

  it('highlights a day with too much awake time', () => {
    const summary = buildSleepDaySummary(
      [
        sleepSessionWithDayOffsets('nap-1', 'nap', 0, 9, 34, 0, 10, 39),
        sleepSessionWithDayOffsets('nap-2', 'nap', 0, 13, 13, 0, 14, 18),
        sleepSessionWithDayOffsets('nap-3', 'nap', 0, 16, 52, 0, 17, 57),
        sleepSessionWithDayOffsets('night', 'night', 0, 22, 0, 1, 6, 0),
      ],
      referenceDate,
      afterSleepDay,
      DEFAULT_SLEEP_PLAN,
    );

    expect(summary.targetAwakeDeltaMinutes).toBe(150);
    expect(summary.verdictLabel).toBe('Бодрствования больше цели');
    expect(summary.feedbackLines[0]).toBe('Бодрствования на 2 ч 30 мин больше цели');
  });

  it('highlights short daytime sleep even when total awake time is close', () => {
    const summary = buildSleepDaySummary(
      [
        sleepSessionWithDayOffsets('nap-1', 'nap', 0, 9, 30, 0, 10, 0),
        sleepSessionWithDayOffsets('nap-2', 'nap', 0, 12, 30, 0, 13, 0),
        sleepSessionWithDayOffsets('nap-3', 'nap', 0, 16, 0, 0, 16, 30),
        sleepSessionWithDayOffsets('night', 'night', 0, 18, 45, 1, 7, 0),
      ],
      referenceDate,
      afterSleepDay,
      DEFAULT_SLEEP_PLAN,
    );

    expect(summary.totalAwakeMinutes).toBe(DEFAULT_SLEEP_PLAN.targetAwakeMinutes);
    expect(summary.targetDaySleepDeltaMinutes).toBe(-105);
    expect(summary.verdictLabel).toBe('Дневного сна меньше цели');
    expect(summary.feedbackLines[0]).toBe('Дневного сна на 1 ч 45 мин меньше цели');
  });

  it('adds feedback for a late bedtime', () => {
    const summary = buildSleepDaySummary(
      [
        sleepSessionWithDayOffsets('nap-1', 'nap', 0, 9, 34, 0, 10, 39),
        sleepSessionWithDayOffsets('nap-2', 'nap', 0, 13, 13, 0, 14, 18),
        sleepSessionWithDayOffsets('nap-3', 'nap', 0, 16, 52, 0, 17, 57),
        sleepSessionWithDayOffsets('night', 'night', 0, 22, 20, 1, 8, 0),
      ],
      referenceDate,
      afterSleepDay,
      DEFAULT_SLEEP_PLAN,
    );

    expect(summary.targetBedtimeDeltaMinutes).toBe(50);
    expect(summary.feedbackLines).toContain('Отбой на 50 мин позже плана');
    expect(summary.bedtimeAt ? clock(summary.bedtimeAt) : null).toBe('22:20');
    expect(summary.wakeUpAt ? clock(summary.wakeUpAt) : null).toBe('08:00');
  });

  it('keeps an empty day calm and explicit', () => {
    const summary = buildSleepDaySummary([], referenceDate, afterSleepDay, DEFAULT_SLEEP_PLAN);

    expect(summary.sleepSessionCount).toBe(0);
    expect(summary.bedtimeAt).toBeNull();
    expect(summary.wakeUpAt).toBeNull();
    expect(summary.targetBedtimeDeltaMinutes).toBeNull();
    expect(summary.verdictLabel).toBe('Нет записей сна');
    expect(summary.feedbackLines).toEqual(['Итоги появятся после первой записи сна.']);
  });
});
