import type { SQLiteDatabase } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getOnboardingState: vi.fn(),
}));

const syncMocks = vi.hoisted(() => ({
  hideActiveSleepNotification: vi.fn(async () => undefined),
  hideBottleFeedingReminderNotification: vi.fn(async () => undefined),
  hideSleepReminderNotification: vi.fn(async () => undefined),
  loadExpoNotificationsModule: vi.fn(),
  resetBottleFeedingReminderNotificationRuntimeState: vi.fn(),
  resetExpoNotificationRuntimeState: vi.fn(),
  syncActiveSleepNotificationFromDatabase: vi.fn(async () => undefined),
  syncBottleFeedingReminderNotificationFromDatabase: vi.fn(async () => undefined),
  syncSleepReminderNotificationFromDatabase: vi.fn(async () => undefined),
}));

vi.mock('@/db', () => dbMocks);

vi.mock('@/notifications/activeSleepNotification', () => ({
  hideActiveSleepNotification: syncMocks.hideActiveSleepNotification,
  syncActiveSleepNotificationFromDatabase:
    syncMocks.syncActiveSleepNotificationFromDatabase,
}));

vi.mock('@/notifications/bottleFeedingReminderNotification', () => ({
  hideBottleFeedingReminderNotification:
    syncMocks.hideBottleFeedingReminderNotification,
  resetBottleFeedingReminderNotificationRuntimeState:
    syncMocks.resetBottleFeedingReminderNotificationRuntimeState,
  syncBottleFeedingReminderNotificationFromDatabase:
    syncMocks.syncBottleFeedingReminderNotificationFromDatabase,
}));

vi.mock('@/notifications/expoNotifications', () => ({
  loadExpoNotificationsModule: syncMocks.loadExpoNotificationsModule,
  resetExpoNotificationRuntimeState: syncMocks.resetExpoNotificationRuntimeState,
}));

vi.mock('@/notifications/sleepReminderNotification', () => ({
  hideSleepReminderNotification: syncMocks.hideSleepReminderNotification,
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
    syncMocks.loadExpoNotificationsModule.mockResolvedValue({
      cancelAllScheduledNotificationsAsync: vi.fn(async () => undefined),
      dismissAllNotificationsAsync: vi.fn(async () => undefined),
    });
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

  it('cancels scheduled notifications and clears runtime notification state after reset', async () => {
    const Notifications = {
      cancelAllScheduledNotificationsAsync: vi.fn(async () => undefined),
      dismissAllNotificationsAsync: vi.fn(async () => undefined),
    };
    syncMocks.loadExpoNotificationsModule.mockResolvedValue(Notifications);
    const { cancelAllLocalSleepNotifications } = await loadSubject();

    await cancelAllLocalSleepNotifications();

    expect(syncMocks.resetBottleFeedingReminderNotificationRuntimeState).toHaveBeenCalledTimes(1);
    expect(syncMocks.resetExpoNotificationRuntimeState).toHaveBeenCalledTimes(1);
    expect(syncMocks.hideActiveSleepNotification).toHaveBeenCalledTimes(1);
    expect(syncMocks.hideSleepReminderNotification).toHaveBeenCalledTimes(1);
    expect(syncMocks.hideBottleFeedingReminderNotification).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});
