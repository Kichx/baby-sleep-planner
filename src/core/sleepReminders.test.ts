import { describe, expect, it } from 'vitest';

import { buildNextSleepReminder } from '@/core/sleepReminders';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 0, 15, hour, minute, 0, 0);
}

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
    2,
    '0',
  )}`;
}

describe('buildNextSleepReminder', () => {
  it('schedules a calm preparation reminder before the next nap', () => {
    const reminder = buildNextSleepReminder({
      nextSleepAt: at(9, 30),
      nextSleepKind: 'nap',
      now: at(8, 0),
      state: 'awake',
    });

    expect(reminder).toMatchObject({
      body: 'Сон примерно в 09:30. Можно спокойно начать подготовку.',
      isDueReminder: false,
      kind: 'nap',
      title: 'Ориентир на сон',
    });
    expect(reminder ? clock(reminder.triggerAt) : null).toBe('09:20');
  });

  it('schedules a bedtime reminder when the next sleep is night sleep', () => {
    const reminder = buildNextSleepReminder({
      nextSleepAt: at(20, 30),
      nextSleepKind: 'night',
      now: at(19, 0),
      state: 'awake',
    });

    expect(reminder).toMatchObject({
      body: 'Отбой примерно в 20:30. Можно начать спокойный вечер.',
      kind: 'night',
      title: 'Ориентир на отбой',
    });
    expect(reminder ? clock(reminder.triggerAt) : null).toBe('20:20');
  });

  it('uses the sleep time itself when the lead reminder has already passed', () => {
    const reminder = buildNextSleepReminder({
      nextSleepAt: at(9, 30),
      nextSleepKind: 'nap',
      now: at(9, 23),
      state: 'awake',
    });

    expect(reminder).toMatchObject({
      body: 'Сейчас ориентир на сон. Если ребёнок готов, можно укладывать.',
      isDueReminder: true,
    });
    expect(reminder ? clock(reminder.triggerAt) : null).toBe('09:30');
  });

  it('does not schedule a reminder while sleep is already active', () => {
    const reminder = buildNextSleepReminder({
      nextSleepAt: at(10, 0),
      nextSleepKind: 'nap',
      now: at(9, 0),
      state: 'sleeping',
    });

    expect(reminder).toBeNull();
  });

  it('does not schedule a reminder when the next sleep is already too close', () => {
    const reminder = buildNextSleepReminder({
      nextSleepAt: at(9, 0),
      nextSleepKind: 'nap',
      now: at(8, 59),
      state: 'awake',
    });

    expect(reminder).toBeNull();
  });
});

