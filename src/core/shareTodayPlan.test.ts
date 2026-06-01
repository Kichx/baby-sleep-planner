import { describe, expect, it } from 'vitest';

import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { buildTodayPlanShareText } from '@/core/shareTodayPlan';
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

function sleepSession(
  id: string,
  kind: SleepKind,
  startHour: number,
  startMinute: number,
  endHour: number | null,
  endMinute: number | null,
): SleepSession {
  return sleepSessionWithDayOffsets(
    id,
    kind,
    0,
    startHour,
    startMinute,
    endHour === null ? null : 0,
    endHour,
    endMinute,
  );
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

describe('buildTodayPlanShareText', () => {
  it('builds a short note with current day facts and the remaining sleep schedule', () => {
    const message = buildTodayPlanShareText({
      childName: 'Миша',
      generatedAt: at(13, 8),
      plan: DEFAULT_SLEEP_PLAN,
      planName: 'Няня',
      sessions: [
        sleepSessionWithDayOffsets('night', 'night', -1, 22, 0, 0, 7, 0),
        sleepSession('nap-1', 'nap', 9, 34, 10, 4),
        sleepSession('nap-2', 'nap', 12, 38, 13, 8),
      ],
    });

    expect(message).toContain('Сон на сегодня: Миша');
    expect(message).toContain('Обновлено в 13:08. Ориентир: Няня');
    expect(message).toContain('• Подъём: 07:00');
    expect(message).toContain('• Сейчас бодрствует с 13:08 (0 мин)');
    expect(message).toContain('• Дневной сон: 1 ч, 2 из 3 снов');
    expect(message).toContain('• 1-й сон: 09:34-10:04, 30 мин');
    expect(message).toContain('• 2-й сон: 12:38-13:08, 30 мин');
    expect(message).toContain('• 3-й сон: 15:42-16:47');
    expect(message).toContain('• Отбой: 19:20');
  });

  it('keeps an active nap visible and projects the rest of the day', () => {
    const message = buildTodayPlanShareText({
      childName: 'Миша',
      generatedAt: at(10),
      plan: DEFAULT_SLEEP_PLAN,
      planName: 'Основной',
      sessions: [sleepSession('active-nap', 'nap', 9, 40, null, null)],
    });

    expect(message).toContain('• Сейчас спит с 09:40 (20 мин)');
    expect(message).toContain('• Дневной сон: 20 мин, 0 из 3 снов');
    expect(message).toContain('• 1-й сон: с 09:40, идёт 20 мин');
    expect(message).toContain('• Текущий сон: ориентир до 10:45');
    expect(message).toContain('• 2-й сон: 13:19-14:24');
    expect(message).toContain('• 3-й сон: 16:58-18:03');
    expect(message).toContain('• Отбой: 20:30');
  });

  it('handles a day without sleep records', () => {
    const message = buildTodayPlanShareText({
      childName: '',
      generatedAt: at(7, 30),
      plan: DEFAULT_SLEEP_PLAN,
      planName: '',
      sessions: [],
    });

    expect(message).toContain('Сон на сегодня: ребёнок');
    expect(message).toContain('Ориентир: Основной');
    expect(message).toContain('• Подъём: 07:00');
    expect(message).toContain('• Сейчас бодрствует с 07:00 (30 мин)');
    expect(message).toContain('• Дневных снов пока не было');
    expect(message).toContain('• 1-й сон: 09:34-10:39');
    expect(message).toContain('• 2-й сон: 13:13-14:18');
    expect(message).toContain('• 3-й сон: 16:52-17:57');
    expect(message).toContain('• Отбой: 20:30');
  });
});
