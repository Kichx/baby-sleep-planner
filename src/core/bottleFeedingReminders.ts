import type { BottleFeeding } from '@/types/bottleFeeding';

export interface BottleFeedingReminderSettings {
  bottleFeedingEnabled: boolean;
  remindersEnabled: boolean;
  reminderIntervalMinutes: number;
  notifyDuringSleep: boolean;
}

export interface BottleFeedingReminderDecision {
  triggerAt: Date;
  kind: 'schedule' | 'suppressUntilWake';
}

export function buildBottleFeedingReminder(params: {
  latestFeeding: BottleFeeding | null;
  now: Date;
  settings: BottleFeedingReminderSettings;
  isSleeping: boolean;
}): BottleFeedingReminderDecision | null {
  const { latestFeeding, now, settings, isSleeping } = params;

  if (
    !settings.bottleFeedingEnabled ||
    !settings.remindersEnabled ||
    !latestFeeding ||
    !Number.isInteger(settings.reminderIntervalMinutes) ||
    settings.reminderIntervalMinutes <= 0
  ) {
    return null;
  }

  const triggerAt = new Date(
    new Date(latestFeeding.startedAt).getTime() +
      settings.reminderIntervalMinutes * 60_000,
  );

  if (Number.isNaN(triggerAt.getTime())) {
    return null;
  }

  if (isSleeping && !settings.notifyDuringSleep) {
    return {
      kind: 'suppressUntilWake',
      triggerAt,
    };
  }

  return {
    kind: 'schedule',
    triggerAt,
  };
}
