import { describe, expect, it } from 'vitest';

import {
  buildBottleFeedingReminder,
  buildBottleFeedingReminderSuppressionState,
  EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
  resolveSuppressedBottleFeedingReminder,
  shouldSuppressBottleFeedingReminderPresentation,
} from '@/core/bottleFeedingReminders';
import { formatLocalClock } from '@/core/localDateTime';
import type { BottleFeeding } from '@/types/bottleFeeding';

function feeding(startedAt: string, id = 'feeding-1', volumeMl = 120): BottleFeeding {
  return {
    childId: 'default-child',
    createdAt: startedAt,
    id,
    startedAt,
    updatedAt: startedAt,
    volumeMl,
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

  it('does not schedule when bottle feeding is disabled', () => {
    expect(
      buildBottleFeedingReminder({
        isSleeping: false,
        latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
        now: new Date('2026-06-01T08:30:00.000Z'),
        settings: {
          bottleFeedingEnabled: false,
          notifyDuringSleep: true,
          reminderIntervalMinutes: 180,
          remindersEnabled: true,
        },
      }),
    ).toBeNull();
  });

  it('does not schedule without a feeding', () => {
    expect(
      buildBottleFeedingReminder({
        isSleeping: false,
        latestFeeding: null,
        now: new Date('2026-06-01T08:30:00.000Z'),
        settings: {
          bottleFeedingEnabled: true,
          notifyDuringSleep: true,
          reminderIntervalMinutes: 180,
          remindersEnabled: true,
        },
      }),
    ).toBeNull();
  });

  it('schedules from the latest feeding and selected interval', () => {
    const reminder = buildBottleFeedingReminder({
      isSleeping: false,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z', 'latest-feeding', 150),
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
    expect(reminder?.latestFeedingId).toBe('latest-feeding');
    expect(reminder?.title).toBe('Прошло 2 часа 30 минут с последнего кормления');
    expect(reminder?.body).toBe(
      `Последнее: 150 мл в ${formatLocalClock(new Date('2026-06-01T06:00:00.000Z'))}`,
    );
  });

  it('does not schedule an overdue reminder', () => {
    expect(
      buildBottleFeedingReminder({
        isSleeping: false,
        latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
        now: new Date('2026-06-01T09:01:00.000Z'),
        settings: {
          bottleFeedingEnabled: true,
          notifyDuringSleep: true,
          reminderIntervalMinutes: 180,
          remindersEnabled: true,
        },
      }),
    ).toBeNull();
  });

  it('keeps a future reminder scheduled during sleep so due-time can decide', () => {
    const reminder = buildBottleFeedingReminder({
      isSleeping: true,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
      now: new Date('2026-06-01T08:15:00.000Z'),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: false,
        reminderIntervalMinutes: 180,
        remindersEnabled: true,
      },
    });

    expect(reminder).toMatchObject({
      kind: 'schedule',
    });
    expect(reminder?.triggerAt.toISOString()).toBe('2026-06-01T09:00:00.000Z');
  });

  it('schedules normally during sleep when sleep-time notifications are enabled', () => {
    const reminder = buildBottleFeedingReminder({
      isSleeping: true,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
      now: new Date('2026-06-01T08:15:00.000Z'),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: true,
        reminderIntervalMinutes: 180,
        remindersEnabled: true,
      },
    });

    expect(reminder).toMatchObject({
      kind: 'schedule',
    });
    expect(reminder?.triggerAt.toISOString()).toBe('2026-06-01T09:00:00.000Z');
  });

  it('suppresses an overdue reminder during active sleep when sleep notifications are off', () => {
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
    expect(reminder?.triggerAt.toISOString()).toBe('2026-06-01T09:00:00.000Z');
  });

  it('uses notification presentation suppression only when active sleep blocks it', () => {
    const scheduledReminderAt = new Date('2026-06-01T09:00:00.000Z');

    expect(
      shouldSuppressBottleFeedingReminderPresentation({
        isSleeping: true,
        notifyDuringSleep: false,
        scheduledReminderAt,
      }),
    ).toBe(true);
    expect(
      shouldSuppressBottleFeedingReminderPresentation({
        isSleeping: true,
        notifyDuringSleep: true,
        scheduledReminderAt,
      }),
    ).toBe(false);
    expect(
      shouldSuppressBottleFeedingReminderPresentation({
        isSleeping: false,
        notifyDuringSleep: false,
        scheduledReminderAt,
      }),
    ).toBe(false);
  });

  it('shows a suppressed reminder immediately after sleep ends without a newer feeding', () => {
    const resolution = resolveSuppressedBottleFeedingReminder({
      isSleeping: false,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z', 'feeding-before-sleep', 120),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: false,
        reminderIntervalMinutes: 180,
        remindersEnabled: true,
      },
      state: buildBottleFeedingReminderSuppressionState(
        new Date('2026-06-01T09:00:00.000Z'),
      ),
    });

    expect(resolution.kind).toBe('showSuppressedNow');

    if (resolution.kind === 'showSuppressedNow') {
      expect(resolution.reminder.kind).toBe('showNow');
      expect(resolution.reminder.latestFeedingId).toBe('feeding-before-sleep');
      expect(resolution.reminder.triggerAt.toISOString()).toBe(
        '2026-06-01T09:00:00.000Z',
      );
      expect(resolution.state).toEqual(EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE);
    }
  });

  it('keeps a suppressed reminder while sleep is still active', () => {
    const state = buildBottleFeedingReminderSuppressionState(
      new Date('2026-06-01T09:00:00.000Z'),
    );
    const resolution = resolveSuppressedBottleFeedingReminder({
      isSleeping: true,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: false,
        reminderIntervalMinutes: 180,
        remindersEnabled: true,
      },
      state,
    });

    expect(resolution).toEqual({
      kind: 'keepSuppressed',
      state,
    });
  });

  it('clears a suppressed reminder when a newer feeding happened after it was due', () => {
    const resolution = resolveSuppressedBottleFeedingReminder({
      isSleeping: false,
      latestFeeding: feeding('2026-06-01T09:30:00.000Z', 'new-feeding', 90),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: false,
        reminderIntervalMinutes: 180,
        remindersEnabled: true,
      },
      state: buildBottleFeedingReminderSuppressionState(
        new Date('2026-06-01T09:00:00.000Z'),
      ),
    });

    expect(resolution).toEqual({
      kind: 'clearSuppressed',
      state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
    });
  });

  it('clears a suppressed reminder when reminders are turned off', () => {
    const resolution = resolveSuppressedBottleFeedingReminder({
      isSleeping: false,
      latestFeeding: feeding('2026-06-01T06:00:00.000Z'),
      settings: {
        bottleFeedingEnabled: true,
        notifyDuringSleep: false,
        reminderIntervalMinutes: 180,
        remindersEnabled: false,
      },
      state: buildBottleFeedingReminderSuppressionState(
        new Date('2026-06-01T09:00:00.000Z'),
      ),
    });

    expect(resolution).toEqual({
      kind: 'clearSuppressed',
      state: EMPTY_BOTTLE_FEEDING_REMINDER_PLANNER_STATE,
    });
  });
});
