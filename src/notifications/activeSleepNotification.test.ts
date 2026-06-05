import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

async function loadSubject(onboardingState: 'not_started' | 'tracking_only' | 'plan_saved') {
  vi.resetModules();

  const getOnboardingState = vi.fn(async () => onboardingState);
  const getActiveSleepSession = vi.fn(async () => ({
    childId: 'default-child',
    endedAt: null,
    id: 'sleep-1',
    kind: 'nap',
    startedAt: '2026-06-05T15:00:00.000Z',
  }));
  const ensureExpoNotificationHandlerConfigured = vi.fn(async () => null);
  const hasNotificationPermission = vi.fn();
  const loadExpoNotificationsModule = vi.fn();

  vi.doMock('expo', () => ({
    requireOptionalNativeModule: vi.fn(() => null),
  }));
  vi.doMock('@/db', () => ({
    getActiveSleepSession,
    getOnboardingState,
  }));
  vi.doMock('@/notifications/expoNotifications', () => ({
    canUseAndroidNativeNotifications: vi.fn(() => true),
    ensureExpoNotificationHandlerConfigured,
    hasNotificationPermission,
    loadExpoNotificationsModule,
  }));

  const { syncActiveSleepNotificationFromDatabase } = await import(
    '@/notifications/activeSleepNotification'
  );

  return {
    ensureExpoNotificationHandlerConfigured,
    getActiveSleepSession,
    getOnboardingState,
    hasNotificationPermission,
    syncActiveSleepNotificationFromDatabase,
  };
}

describe('active sleep notification sync', () => {
  it.each(['not_started', 'tracking_only'] as const)(
    'does not request notification permission while onboarding is %s',
    async (onboardingState) => {
      const {
        ensureExpoNotificationHandlerConfigured,
        getActiveSleepSession,
        getOnboardingState,
        hasNotificationPermission,
        syncActiveSleepNotificationFromDatabase,
      } = await loadSubject(onboardingState);

      await syncActiveSleepNotificationFromDatabase({} as SQLiteDatabase);

      expect(getOnboardingState).toHaveBeenCalledTimes(1);
      expect(getActiveSleepSession).not.toHaveBeenCalled();
      expect(ensureExpoNotificationHandlerConfigured).not.toHaveBeenCalled();
      expect(hasNotificationPermission).not.toHaveBeenCalled();
    },
  );

  it('keeps active sleep notification sync enabled after a day plan is saved', async () => {
    const {
      ensureExpoNotificationHandlerConfigured,
      getActiveSleepSession,
      getOnboardingState,
      syncActiveSleepNotificationFromDatabase,
    } = await loadSubject('plan_saved');

    await syncActiveSleepNotificationFromDatabase({} as SQLiteDatabase);

    expect(getOnboardingState).toHaveBeenCalledTimes(1);
    expect(getActiveSleepSession).toHaveBeenCalledTimes(1);
    expect(ensureExpoNotificationHandlerConfigured).toHaveBeenCalledTimes(1);
  });
});
