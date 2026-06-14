import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

import type { OnboardingState } from '@/types/appSettings';

interface NativeChronometerMock {
  hide: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
}

function createNotificationsModuleMock() {
  return {
    AndroidImportance: {
      LOW: 'low',
    },
    AndroidNotificationPriority: {
      LOW: 'low',
    },
    dismissNotificationAsync: vi.fn(async () => undefined),
    scheduleNotificationAsync: vi.fn(async () => 'active-sleep-notification'),
    setNotificationChannelAsync: vi.fn(async () => null),
  };
}

async function loadSubject(
  onboardingState: OnboardingState,
  options: {
    nativeChronometer?: NativeChronometerMock | null;
    notificationPermission?: boolean;
  } = {},
) {
  vi.resetModules();

  const Notifications = createNotificationsModuleMock();
  const nativeChronometer = options.nativeChronometer ?? null;
  const getOnboardingState = vi.fn(async () => onboardingState);
  const getActiveSleepSession = vi.fn(async () => ({
    childId: 'default-child',
    endedAt: null,
    id: 'sleep-1',
    kind: 'nap',
    startedAt: '2026-06-05T15:00:00.000Z',
  }));
  const ensureExpoNotificationHandlerConfigured = vi.fn(async () => Notifications);
  const hasNotificationPermission = vi.fn(async () => options.notificationPermission ?? true);
  const loadExpoNotificationsModule = vi.fn(async () => Notifications);
  const requireOptionalNativeModule = vi.fn(() => nativeChronometer);

  vi.doMock('expo', () => ({
    requireOptionalNativeModule,
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
    nativeChronometer,
    Notifications,
    requireOptionalNativeModule,
    syncActiveSleepNotificationFromDatabase,
  };
}

describe('active sleep notification sync', () => {
  it('does not request notification permission before onboarding is completed', async () => {
    const {
      ensureExpoNotificationHandlerConfigured,
      getActiveSleepSession,
      getOnboardingState,
      hasNotificationPermission,
      syncActiveSleepNotificationFromDatabase,
    } = await loadSubject('not_started');

    await syncActiveSleepNotificationFromDatabase({} as SQLiteDatabase);

    expect(getOnboardingState).toHaveBeenCalledTimes(1);
    expect(getActiveSleepSession).not.toHaveBeenCalled();
    expect(ensureExpoNotificationHandlerConfigured).not.toHaveBeenCalled();
    expect(hasNotificationPermission).not.toHaveBeenCalled();
  });

  it.each(['tracking_only', 'plan_saved'] as const)(
    'syncs active sleep notification while onboarding is %s',
    async (onboardingState) => {
      const {
        getActiveSleepSession,
        getOnboardingState,
        hasNotificationPermission,
        Notifications,
        syncActiveSleepNotificationFromDatabase,
      } = await loadSubject(onboardingState);

      await syncActiveSleepNotificationFromDatabase(
        {} as SQLiteDatabase,
        new Date('2026-06-05T15:12:00.000Z'),
      );

      expect(getOnboardingState).toHaveBeenCalledTimes(1);
      expect(getActiveSleepSession).toHaveBeenCalledTimes(1);
      expect(hasNotificationPermission).toHaveBeenCalledTimes(1);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            autoDismiss: false,
            data: expect.objectContaining({
              sessionId: 'sleep-1',
              type: 'activeSleep',
            }),
            sticky: true,
          }),
          identifier: 'active-sleep-notification',
          trigger: {
            channelId: 'active-sleep',
          },
        }),
      );
    },
  );

  it('uses native chronometer instead of Expo fallback when it starts', async () => {
    const nativeChronometer = {
      hide: vi.fn(() => true),
      show: vi.fn(() => true),
    };
    const {
      Notifications,
      syncActiveSleepNotificationFromDatabase,
    } = await loadSubject('plan_saved', {
      nativeChronometer,
    });

    await syncActiveSleepNotificationFromDatabase(
      {} as SQLiteDatabase,
      new Date('2026-06-05T15:12:00.000Z'),
    );

    expect(nativeChronometer.show).toHaveBeenCalledWith(
      new Date('2026-06-05T15:00:00.000Z').getTime(),
      expect.any(String),
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
