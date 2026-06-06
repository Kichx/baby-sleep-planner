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

  it('checks notification permission without requesting it', async () => {
    const { hasNotificationPermission, loadExpoNotificationsModule } = await loadSubject({
      appOwnership: 'standalone',
      platform: 'android',
    });
    const Notifications = await loadExpoNotificationsModule();

    if (!Notifications) {
      throw new Error('Expected notifications module');
    }

    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: false,
      status: 'denied',
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    await expect(hasNotificationPermission(Notifications)).resolves.toBe(false);

    expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests notification permission only through the explicit helper', async () => {
    const { requestNotificationPermission, loadExpoNotificationsModule } = await loadSubject({
      appOwnership: 'standalone',
      platform: 'android',
    });
    const Notifications = await loadExpoNotificationsModule();

    if (!Notifications) {
      throw new Error('Expected notifications module');
    }

    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: false,
      status: 'denied',
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: true,
      status: 'granted',
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);

    await expect(requestNotificationPermission()).resolves.toBe(true);

    expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('reports whether the app can still ask for notification permission', async () => {
    const { canAskForNotificationPermission, loadExpoNotificationsModule } =
      await loadSubject({
        appOwnership: 'standalone',
        platform: 'android',
      });
    const Notifications = await loadExpoNotificationsModule();

    if (!Notifications) {
      throw new Error('Expected notifications module');
    }

    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: false,
      status: 'denied',
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    await expect(canAskForNotificationPermission()).resolves.toBe(true);

    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      canAskAgain: false,
      expires: 'never',
      granted: false,
      status: 'denied',
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    await expect(canAskForNotificationPermission()).resolves.toBe(false);
  });
});
