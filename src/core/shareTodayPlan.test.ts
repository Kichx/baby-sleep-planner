import { describe, expect, it } from 'vitest';

import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { buildTodayPlanShareText } from '@/core/shareTodayPlan';
import type { SleepKind, SleepSession } from '@/types/sleep';

const CHILD_ID = 'default-child';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 0, 15, hour, minute, 0, 0);
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

describe('buildTodayPlanShareText', () => {
  it('builds a short shareable plan from completed sleeps and the current projection', () => {
    const message = buildTodayPlanShareText({
      childName: 'Миша',
      generatedAt: at(13, 8),
      plan: DEFAULT_SLEEP_PLAN,
      planName: 'Няня',
      sessions: [
        sleepSession('nap-1', 'nap', 9, 34, 10, 4),
        sleepSession('nap-2', 'nap', 12, 38, 13, 8),
      ],
    });

    expect(message).toContain('План сна на сегодня: Миша');
    expect(message).toContain('Обновлено: 13:08. План: Няня');
    expect(message).toContain('• Сон 1 | 09:34-10:04 | 30 мин');
    expect(message).toContain('• Сон 2 | 12:38-13:08 | 30 мин');
    expect(message).toContain('• Следующий сон: 15:42 (через 2 ч 34 мин)');
    expect(message).toContain('• Прогноз отбоя: 19:20');
    expect(message).toContain('• Дневного сна впереди по плану: 1 ч 5 мин');
  });

  it('explains that an active sleep should be finished before recalculating the plan', () => {
    const message = buildTodayPlanShareText({
      childName: 'Миша',
      generatedAt: at(10),
      plan: DEFAULT_SLEEP_PLAN,
      planName: 'Основной',
      sessions: [sleepSession('active-nap', 'nap', 9, 40, null, null)],
    });

    expect(message).toContain('Сейчас: Спит 20 мин с 09:40 сегодня');
    expect(message).toContain('• Сон 1 | с 09:40 сегодня | идёт 20 мин');
    expect(message).toContain('• Сейчас идёт сон, после пробуждения план пересчитается');
  });

  it('handles a day without sleep records', () => {
    const message = buildTodayPlanShareText({
      childName: '',
      generatedAt: at(7, 30),
      plan: DEFAULT_SLEEP_PLAN,
      planName: '',
      sessions: [],
    });

    expect(message).toContain('План сна на сегодня: ребёнок');
    expect(message).toContain('План: Основной');
    expect(message).toContain('• записей сна пока нет');
    expect(message).toContain('• Следующий сон: 09:34 (через 2 ч 4 мин)');
  });
});
