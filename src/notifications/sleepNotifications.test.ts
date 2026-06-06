import type { SQLiteDatabase } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getOnboardingState: vi.fn(),
}));

const syncMocks = vi.hoisted(() => ({
  syncActiveSleepNotificationFromDatabase: vi.fn(async () => undefined),
  syncBottleFeedingReminderNotificationFromDatabase: vi.fn(async () => undefined),
  syncSleepReminderNotificationFromDatabase: vi.fn(async () => undefined),
}));

vi.mock('@/db', () => dbMocks);

vi.mock('@/notifications/activeSleepNotification', () => ({
  syncActiveSleepNotificationFromDatabase:
    syncMocks.syncActiveSleepNotificationFromDatabase,
}));

vi.mock('@/notifications/bottleFeedingReminderNotification', () => ({
  syncBottleFeedingReminderNotificationFromDatabase:
    syncMocks.syncBottleFeedingReminderNotificationFromDatabase,
}));

vi.mock('@/notifications/sleepReminderNotification', () => ({
  syncSleepReminderNotificationFromDatabase:
    syncMocks.syncSleepReminderNotificationFromDatabase,
}));

const db = {} as SQLiteDatabase;

async function loadSubject() {
  vi.resetModules();

  return import('@/notifications/sleepNotifications');
}

describe('sleep notification sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getOnboardingState.mockResolvedValue('plan_saved');
  });

  it.each(['not_started', 'tracking_only'] as const)(
    'does not sync notifications while onboarding is %s',
    async (onboardingState) => {
      dbMocks.getOnboardingState.mockResolvedValue(onboardingState);
      const { syncSleepNotificationsFromDatabase } = await loadSubject();

      await syncSleepNotificationsFromDatabase(db);

      expect(dbMocks.getOnboardingState).toHaveBeenCalledTimes(1);
      expect(syncMocks.syncActiveSleepNotificationFromDatabase).not.toHaveBeenCalled();
      expect(
        syncMocks.syncBottleFeedingReminderNotificationFromDatabase,
      ).not.toHaveBeenCalled();
      expect(syncMocks.syncSleepReminderNotificationFromDatabase).not.toHaveBeenCalled();
    },
  );

  it('syncs notifications after a day plan is saved', async () => {
    const now = new Date('2026-06-05T08:00:00.000Z');
    const { syncSleepNotificationsFromDatabase } = await loadSubject();

    await syncSleepNotificationsFromDatabase(db, now, {
      showOverdueBottleFeedingReminder: true,
    });

    expect(dbMocks.getOnboardingState).toHaveBeenCalledTimes(1);
    expect(syncMocks.syncActiveSleepNotificationFromDatabase).toHaveBeenCalledWith(db, now);
    expect(syncMocks.syncSleepReminderNotificationFromDatabase).toHaveBeenCalledWith(db, now);
    expect(syncMocks.syncBottleFeedingReminderNotificationFromDatabase).toHaveBeenCalledWith(
      db,
      now,
      {
        showOverdueReminder: true,
      },
    );
  });
});
