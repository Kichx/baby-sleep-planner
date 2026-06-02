import { beforeEach, describe, expect, it, vi } from 'vitest';

type PlatformName = 'android' | 'ios' | 'web';
type AppOwnershipName = 'expo' | 'standalone';

const notificationModuleFactory = vi.fn(() => ({
  AndroidNotificationPriority: {
    DEFAULT: 'DEFAULT',
    LOW: 'LOW',
  },
  IosAuthorizationStatus: {
    PROVISIONAL: 'PROVISIONAL',
  },
  getPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  setNotificationHandler: vi.fn(),
}));

async function loadSubject({
  appOwnership,
  platform,
}: {
  appOwnership: AppOwnershipName;
  platform: PlatformName;
}) {
  vi.resetModules();
  vi.doMock('react-native', () => ({
    Platform: {
      OS: platform,
    },
  }));
  vi.doMock('expo-constants', () => ({
    AppOwnership: {
      Expo: 'expo',
    },
    default: {
      appOwnership,
    },
  }));
  vi.doMock('expo-notifications', notificationModuleFactory);

  return import('@/notifications/expoNotifications');
}

describe('expo notification module loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not import expo-notifications in Android Expo Go', async () => {
    const { canUseAndroidNativeNotifications, loadExpoNotificationsModule } =
      await loadSubject({
        appOwnership: 'expo',
        platform: 'android',
      });

    await expect(loadExpoNotificationsModule()).resolves.toBeNull();

    expect(canUseAndroidNativeNotifications()).toBe(false);
    expect(notificationModuleFactory).not.toHaveBeenCalled();
  });

  it('does not import expo-notifications on web', async () => {
    const { loadExpoNotificationsModule } = await loadSubject({
      appOwnership: 'standalone',
      platform: 'web',
    });

    await expect(loadExpoNotificationsModule()).resolves.toBeNull();

    expect(notificationModuleFactory).not.toHaveBeenCalled();
  });

  it('loads expo-notifications in an Android development build', async () => {
    const { canUseAndroidNativeNotifications, loadExpoNotificationsModule } =
      await loadSubject({
        appOwnership: 'standalone',
        platform: 'android',
      });

    await expect(loadExpoNotificationsModule()).resolves.toMatchObject({
      AndroidNotificationPriority: {
        DEFAULT: 'DEFAULT',
      },
    });

    expect(canUseAndroidNativeNotifications()).toBe(true);
    expect(notificationModuleFactory).toHaveBeenCalledTimes(1);
  });
});
