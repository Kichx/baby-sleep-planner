import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

async function loadSubject(onboardingState: 'not_started' | 'tracking_only' | 'plan_saved') {
  vi.resetModules();

  const getOnboardingState = vi.fn(async () => onboardingState);
  const getTargetDayPlan = vi.fn();
  const listSleepSessionsInRange = vi.fn();
  const ensureExpoNotificationHandlerConfigured = vi.fn();
  const hasNotificationPermission = vi.fn();
  const loadExpoNotificationsModule = vi.fn();

  vi.doMock('react-native', () => ({
    Platform: {
      OS: 'android',
    },
  }));
  vi.doMock('@/db', () => ({
    getOnboardingState,
    getTargetDayPlan,
    listSleepSessionsInRange,
  }));
  vi.doMock('@/notifications/expoNotifications', () => ({
    ensureExpoNotificationHandlerConfigured,
    hasNotificationPermission,
    loadExpoNotificationsModule,
  }));

  const { syncSleepReminderNotificationFromDatabase } = await import(
    '@/notifications/sleepReminderNotification'
  );

  return {
    ensureExpoNotificationHandlerConfigured,
    getOnboardingState,
    getTargetDayPlan,
    hasNotificationPermission,
    listSleepSessionsInRange,
    syncSleepReminderNotificationFromDatabase,
  };
}

describe('sleep reminder notification sync', () => {
  it.each(['not_started', 'tracking_only'] as const)(
    'does not request notification permission while onboarding is %s',
    async (onboardingState) => {
      const {
        ensureExpoNotificationHandlerConfigured,
        getOnboardingState,
        getTargetDayPlan,
        hasNotificationPermission,
        listSleepSessionsInRange,
        syncSleepReminderNotificationFromDatabase,
      } = await loadSubject(onboardingState);

      await syncSleepReminderNotificationFromDatabase({} as SQLiteDatabase);

      expect(getOnboardingState).toHaveBeenCalledTimes(1);
      expect(ensureExpoNotificationHandlerConfigured).not.toHaveBeenCalled();
      expect(hasNotificationPermission).not.toHaveBeenCalled();
      expect(getTargetDayPlan).not.toHaveBeenCalled();
      expect(listSleepSessionsInRange).not.toHaveBeenCalled();
    },
  );

  it('keeps reminder sync enabled after a day plan is saved', async () => {
    vi.resetModules();

    const getOnboardingState = vi.fn(async () => 'plan_saved');
    const getTargetDayPlan = vi.fn();
    const listSleepSessionsInRange = vi.fn();
    const ensureExpoNotificationHandlerConfigured = vi.fn(async () => null);
    const hasNotificationPermission = vi.fn();
    const loadExpoNotificationsModule = vi.fn();

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
      },
    }));
    vi.doMock('@/db', () => ({
      getOnboardingState,
      getTargetDayPlan,
      listSleepSessionsInRange,
    }));
    vi.doMock('@/notifications/expoNotifications', () => ({
      ensureExpoNotificationHandlerConfigured,
      hasNotificationPermission,
      loadExpoNotificationsModule,
    }));

    const { syncSleepReminderNotificationFromDatabase } = await import(
      '@/notifications/sleepReminderNotification'
    );

    await syncSleepReminderNotificationFromDatabase({} as SQLiteDatabase);

    expect(getOnboardingState).toHaveBeenCalledTimes(1);
    expect(ensureExpoNotificationHandlerConfigured).toHaveBeenCalledTimes(1);
    expect(hasNotificationPermission).not.toHaveBeenCalled();
    expect(getTargetDayPlan).not.toHaveBeenCalled();
    expect(listSleepSessionsInRange).not.toHaveBeenCalled();
  });
});
