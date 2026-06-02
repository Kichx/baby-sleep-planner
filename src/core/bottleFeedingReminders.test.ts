import { describe, expect, it } from 'vitest';

import { buildBottleFeedingReminder } from '@/core/bottleFeedingReminders';
import type { BottleFeeding } from '@/types/bottleFeeding';

function feeding(startedAt: string): BottleFeeding {
  return {
    childId: 'default-child',
    createdAt: startedAt,
    id: 'feeding-1',
    startedAt,
    updatedAt: startedAt,
    volumeMl: 120,
  };
}

describe('bottle feeding reminders', () => {
  it('does not schedule when reminders are disabled', () => {
    expect(
      buildBottleFeedingReminder({
        isSleeping: false,
        latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
        now: new Date('2026-06-01T08:30:00.000Z'),
        settings: {
          bottleFeedingEnabled: true,
          notifyDuringSleep: true,
          reminderIntervalMinutes: 180,
          remindersEnabled: false,
        },
      }),
    ).toBeNull();
  });

  it('schedules from the last feeding and selected interval', () => {
    const reminder = buildBottleFeedingReminder({
      isSleeping: false,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
      now: new Date('2026-06-01T08:30:00.000Z'),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: true,
        reminderIntervalMinutes: 150,
        remindersEnabled: true,
      },
    });

    expect(reminder?.kind).toBe('schedule');
    expect(reminder?.triggerAt.toISOString()).toBe('2026-06-01T08:30:00.000Z');
  });

  it('suppresses an overdue reminder during sleep when configured', () => {
    const reminder = buildBottleFeedingReminder({
      isSleeping: true,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
      now: new Date('2026-06-01T09:15:00.000Z'),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: false,
        reminderIntervalMinutes: 180,
        remindersEnabled: true,
      },
    });

    expect(reminder).toMatchObject({
      kind: 'suppressUntilWake',
    });
  });
});
