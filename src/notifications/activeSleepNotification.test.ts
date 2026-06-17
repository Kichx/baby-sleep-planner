import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

import type { OnboardingState } from '@/types/appSettings';
import type { SleepSession } from '@/types/sleep';

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
    cancelScheduledNotificationAsync: vi.fn(async () => undefined),
    dismissNotificationAsync: vi.fn(async () => undefined),
    scheduleNotificationAsync: vi.fn(async () => 'active-sleep-notification'),
    setNotificationChannelAsync: vi.fn(async () => null),
  };
}

const activeSleepSessionFixture: SleepSession = {
  childId: 'default-child',
  endedAt: null,
  id: 'sleep-1',
  kind: 'nap',
  startedAt: '2026-06-05T15:00:00.000Z',
};

async function loadSubject(
  onboardingState: OnboardingState,
  options: {
    activeSleepSession?: SleepSession | null;
    expoNotificationsAvailable?: boolean;
    liveActivityStarts?: boolean;
    nativeChronometer?: NativeChronometerMock | null;
    notificationPermission?: boolean;
    platform?: 'android' | 'ios';
  } = {},
) {
  vi.resetModules();

  const platform = options.platform ?? 'android';
  const Notifications = createNotificationsModuleMock();
  const nativeChronometer = options.nativeChronometer ?? null;
  const getOnboardingState = vi.fn(async () => onboardingState);
  const getActiveSleepSession = vi.fn(async () =>
    options.activeSleepSession === undefined
      ? activeSleepSessionFixture
      : options.activeSleepSession,
  );
  const ensureExpoNotificationHandlerConfigured = vi.fn(async () =>
    options.expoNotificationsAvailable === false ? null : Notifications,
  );
  const hasNotificationPermission = vi.fn(async () => options.notificationPermission ?? true);
  const loadExpoNotificationsModule = vi.fn(async () => Notifications);
  const requireOptionalNativeModule = vi.fn(() => nativeChronometer);
  const liveActivityMocks = {
    hideActiveSleepLiveActivity: vi.fn(async () => undefined),
    showActiveSleepLiveActivity: vi.fn(async () => options.liveActivityStarts ?? true),
  };

  vi.doMock('expo', () => ({
    requireOptionalNativeModule,
  }));
  vi.doMock('react-native', () => ({
    Platform: {
      OS: platform,
    },
  }));
  vi.doMock('@/db', () => ({
    getActiveSleepSession,
    getOnboardingState,
  }));
  vi.doMock('@/notifications/expoNotifications', () => ({
    canUseAndroidNativeNotifications: vi.fn(() => platform === 'android'),
    ensureExpoNotificationHandlerConfigured,
    hasNotificationPermission,
    loadExpoNotificationsModule,
  }));
  vi.doMock('@/notifications/activeSleepLiveActivity', () => liveActivityMocks);

  const { syncActiveSleepNotificationFromDatabase } = await import(
    '@/notifications/activeSleepNotification'
  );

  return {
    ensureExpoNotificationHandlerConfigured,
    getActiveSleepSession,
    getOnboardingState,
    hasNotificationPermission,
    liveActivityMocks,
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

  it('tries native chronometer before loading the Expo notification module', async () => {
    const nativeChronometer = {
      hide: vi.fn(() => true),
      show: vi.fn(() => true),
    };
    const {
      hasNotificationPermission,
      Notifications,
      syncActiveSleepNotificationFromDatabase,
    } = await loadSubject('plan_saved', {
      expoNotificationsAvailable: false,
      nativeChronometer,
    });

    await syncActiveSleepNotificationFromDatabase(
      {} as SQLiteDatabase,
      new Date('2026-06-05T15:12:00.000Z'),
    );

    expect(nativeChronometer.show).toHaveBeenCalledTimes(1);
    expect(hasNotificationPermission).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('falls back to Expo notification when native chronometer throws', async () => {
    const nativeChronometer = {
      hide: vi.fn(() => true),
      show: vi.fn(() => {
        throw new Error('Native bridge failed');
      }),
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

    expect(nativeChronometer.show).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'active-sleep-notification',
      }),
    );
  });

  it('starts iOS Live Activity without using Android native chronometer or Expo fallback', async () => {
    const {
      hasNotificationPermission,
      liveActivityMocks,
      Notifications,
      requireOptionalNativeModule,
      syncActiveSleepNotificationFromDatabase,
    } = await loadSubject('plan_saved', {
      platform: 'ios',
    });

    await syncActiveSleepNotificationFromDatabase(
      {} as SQLiteDatabase,
      new Date('2026-06-05T15:12:00.000Z'),
    );

    expect(liveActivityMocks.showActiveSleepLiveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sleep-1',
      }),
    );
    expect(requireOptionalNativeModule).not.toHaveBeenCalled();
    expect(hasNotificationPermission).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not use Expo fallback on iOS when Live Activity start fails', async () => {
    const {
      hasNotificationPermission,
      liveActivityMocks,
      Notifications,
      syncActiveSleepNotificationFromDatabase,
    } = await loadSubject('plan_saved', {
      liveActivityStarts: false,
      platform: 'ios',
    });

    await syncActiveSleepNotificationFromDatabase(
      {} as SQLiteDatabase,
      new Date('2026-06-05T15:12:00.000Z'),
    );

    expect(liveActivityMocks.showActiveSleepLiveActivity).toHaveBeenCalledTimes(1);
    expect(hasNotificationPermission).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('ends iOS Live Activity when there is no active sleep session', async () => {
    const {
      liveActivityMocks,
      syncActiveSleepNotificationFromDatabase,
    } = await loadSubject('plan_saved', {
      activeSleepSession: null,
      platform: 'ios',
    });

    await syncActiveSleepNotificationFromDatabase({} as SQLiteDatabase);

    expect(liveActivityMocks.hideActiveSleepLiveActivity).toHaveBeenCalledTimes(1);
    expect(liveActivityMocks.showActiveSleepLiveActivity).not.toHaveBeenCalled();
  });
});
